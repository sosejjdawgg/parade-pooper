package com.vibrations.visualiser.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Log
import java.nio.ByteOrder

/**
 * Decodes an audio file with MediaCodec and plays it through an AudioTrack, handing every
 * block of PCM to [sink] for analysis and recording.
 */
class TrackPlayer(
    private val context: Context,
    private val uri: Uri,
    private val sink: PcmSink,
    private val listener: Listener,
) {
    interface Listener {
        fun onTrackReady(durationUs: Long)
        fun onTrackRestarted(rate: Int)   // stream positions reset (start / seek / repeat)
        fun onTrackEnded()
        fun onTrackError(message: String)
    }

    @Volatile var repeat = true
    @Volatile var durationUs = 0L; private set
    @Volatile var playing = true; private set

    private val lock = Object()
    @Volatile private var released = false
    @Volatile private var seekToUs = -1L
    private var thread: Thread? = null

    @Volatile private var track: AudioTrack? = null
    @Volatile private var rate = 44100
    @Volatile private var channels = 2
    @Volatile private var framesWritten = 0L
    @Volatile private var baseUs = 0L

    fun start() {
        thread = Thread({ run() }, "track-decoder").apply { start() }
    }

    fun setPlaying(p: Boolean) {
        synchronized(lock) { playing = p; lock.notifyAll() }
        track?.let { if (p) runCatching { it.play() } else runCatching { it.pause() } }
    }

    fun seekTo(us: Long) {
        synchronized(lock) { seekToUs = us.coerceAtLeast(0); lock.notifyAll() }
    }

    fun release() {
        synchronized(lock) { released = true; lock.notifyAll() }
        runCatching { track?.pause(); track?.flush() }
        thread?.join(1500)
    }

    /** Position of the sample currently leaving the speaker, in source frames since restart. */
    fun playbackFrame(): Long {
        val t = track ?: return 0L
        return (t.playbackHeadPosition.toLong() and 0xffffffffL)
    }

    fun positionUs(): Long = baseUs + playbackFrame() * 1_000_000L / rate

    /** Frames decoded but not yet heard, expressed at 44.1 kHz. */
    fun latencyFrames44k(): Int {
        val pending = (framesWritten - playbackFrame()).coerceAtLeast(0)
        return (pending * AudioRing.RATE / rate).toInt()
    }

    private fun newTrack() {
        track?.let { runCatching { it.pause(); it.flush(); it.release() } }
        val mask = if (channels == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
        val min = AudioTrack.getMinBufferSize(rate, mask, AudioFormat.ENCODING_PCM_16BIT)
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setChannelMask(mask)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
            .setBufferSizeInBytes(maxOf(min * 2, rate * channels * 2 / 8))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        framesWritten = 0
        if (playing) t.play()
        track = t
        listener.onTrackRestarted(rate)
    }

    private fun run() {
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(context, uri, null)
            val idx = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: throw IllegalStateException("No audio in this file")
            extractor.selectTrack(idx)
            val fmt = extractor.getTrackFormat(idx)
            durationUs = if (fmt.containsKey(MediaFormat.KEY_DURATION)) fmt.getLong(MediaFormat.KEY_DURATION) else 0L
            rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = if (fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT) >= 2) 2 else 1
            val c = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
            codec = c
            c.configure(fmt, null, null, 0)
            c.start()
            listener.onTrackReady(durationUs)
            newTrack()

            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var srcChannels = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var pcm = ShortArray(8192)
            var floatPcm = false
            while (!released) {
                synchronized(lock) {
                    while (!playing && !released && seekToUs < 0) lock.wait()
                }
                if (released) break
                val seek = seekToUs
                if (seek >= 0) {
                    seekToUs = -1
                    extractor.seekTo(seek, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
                    c.flush()
                    inputDone = false
                    baseUs = extractor.sampleTime.coerceAtLeast(0)
                    newTrack()
                    continue
                }
                if (!inputDone) {
                    val ib = c.dequeueInputBuffer(5000)
                    if (ib >= 0) {
                        val buf = c.getInputBuffer(ib)!!
                        val n = extractor.readSampleData(buf, 0)
                        if (n < 0) {
                            c.queueInputBuffer(ib, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            c.queueInputBuffer(ib, 0, n, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                val ob = c.dequeueOutputBuffer(info, 5000)
                when {
                    ob == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val of = c.outputFormat
                        val newRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        srcChannels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        floatPcm = of.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
                            of.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                        val newCh = if (srcChannels >= 2) 2 else 1
                        if (newRate != rate || newCh != channels) {
                            rate = newRate; channels = newCh
                            newTrack()
                        }
                    }
                    ob >= 0 -> {
                        val buf = c.getOutputBuffer(ob)!!.order(ByteOrder.nativeOrder())
                        buf.position(info.offset); buf.limit(info.offset + info.size)
                        val srcFrames = if (floatPcm) info.size / 4 / srcChannels else info.size / 2 / srcChannels
                        if (pcm.size < srcFrames * channels) pcm = ShortArray(srcFrames * channels)
                        if (floatPcm) {
                            val fb = buf.asFloatBuffer()
                            for (i in 0 until srcFrames) for (ch in 0 until channels)
                                pcm[i * channels + ch] = (fb.get(i * srcChannels + ch) * 32767f).toInt().coerceIn(-32768, 32767).toShort()
                        } else {
                            val sb = buf.asShortBuffer()
                            if (srcChannels == channels) sb.get(pcm, 0, srcFrames * channels)
                            else for (i in 0 until srcFrames) for (ch in 0 until channels)
                                pcm[i * channels + ch] = sb.get(i * srcChannels + ch)
                        }
                        c.releaseOutputBuffer(ob, false)
                        if (srcFrames > 0) writeOut(pcm, srcFrames)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            if (repeat && !released) {
                                waitForDrain()
                                seekToUs = 0
                            } else {
                                waitForDrain()
                                synchronized(lock) { playing = false }
                                listener.onTrackEnded()
                                // Park until a seek / release arrives.
                                synchronized(lock) { while (!released && seekToUs < 0) lock.wait() }
                                if (seekToUs >= 0) synchronized(lock) { playing = true }
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("TrackPlayer", "decode failed", e)
            if (!released) listener.onTrackError(e.message ?: "Could not play this file")
        } finally {
            runCatching { codec?.stop() }
            runCatching { codec?.release() }
            runCatching { extractor.release() }
            runCatching { track?.pause(); track?.flush(); track?.release() }
            track = null
        }
    }

    private fun writeOut(pcm: ShortArray, frames: Int) {
        val t = track ?: return
        sink.onPcm(pcm, frames, channels, rate, framesWritten)
        var off = 0
        val total = frames * channels
        while (off < total && !released && seekToUs < 0) {
            if (!playing) {
                synchronized(lock) { while (!playing && !released && seekToUs < 0) lock.wait() }
                continue
            }
            val n = t.write(pcm, off, minOf(total - off, 4096 * channels))
            if (n < 0) break
            off += n
        }
        framesWritten += frames
    }

    private fun waitForDrain() {
        val t = track ?: return
        var guard = 0
        while (!released && seekToUs < 0 && playbackFrame() < framesWritten && guard++ < 300) Thread.sleep(10)
    }
}
