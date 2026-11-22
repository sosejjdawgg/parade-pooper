package com.vibrations.visualiser.record

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import com.vibrations.visualiser.audio.AudioRing
import java.io.FileDescriptor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.roundToInt

/**
 * H.264 video from an input Surface (drawn by the GL thread) plus optional AAC audio pulled
 * from an [AudioRing] at real-time pace. Muxed to MP4.
 */
class ClipRecorder(
    val width: Int,
    val height: Int,
    val fps: Int,
    fd: FileDescriptor,
    private val ring: AudioRing?,
    private val startNanos: Long,
) {
    companion object {
        private const val TAG = "ClipRecorder"
        private const val VIDEO_MIME = MediaFormat.MIMETYPE_VIDEO_AVC
        private const val AUDIO_MIME = MediaFormat.MIMETYPE_AUDIO_AAC

        private fun videoCaps(): MediaCodecInfo.VideoCapabilities? =
            MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos
                .firstOrNull { it.isEncoder && it.supportedTypes.any { t -> t.equals(VIDEO_MIME, true) } }
                ?.getCapabilitiesForType(VIDEO_MIME)?.videoCapabilities

        /** Shrinks (w, h) until the device encoder accepts it, keeping aspect and even sizes. */
        fun fitSize(w: Int, h: Int, fps: Int): Pair<Int, Int> {
            val caps = videoCaps() ?: return w to h
            var sw = w; var sh = h
            var scale = 1f
            repeat(20) {
                val ok = runCatching { caps.areSizeAndRateSupported(sw, sh, fps.toDouble()) }.getOrDefault(false) ||
                    runCatching { caps.isSizeSupported(sw, sh) }.getOrDefault(false)
                if (ok) return sw to sh
                scale *= 0.9f
                sw = ((w * scale) / 16f).roundToInt() * 16
                sh = ((h * scale) / 16f).roundToInt() * 16
            }
            return sw to sh
        }

        private fun bitrateFor(w: Int, h: Int, fps: Int): Int {
            val want = (w.toLong() * h * fps * 0.28).toInt().coerceIn(4_000_000, 40_000_000)
            val range = videoCaps()?.bitrateRange ?: return want
            return range.clamp(want)
        }
    }

    private val muxer = MediaMuxer(fd, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    private val videoCodec: MediaCodec = MediaCodec.createEncoderByType(VIDEO_MIME)
    private val audioCodec: MediaCodec? = if (ring != null) MediaCodec.createEncoderByType(AUDIO_MIME) else null
    val inputSurface: Surface

    private val lock = Object()
    private var videoTrack = -1
    private var audioTrack = -1
    private var muxerStarted = false
    private var videoDone = false
    private var audioDone = ring == null
    private var samplesWritten = 0
    private val pending = ArrayList<Triple<Boolean, ByteArray, MediaCodec.BufferInfo>>()

    private val videoThread = HandlerThread("enc-video").apply { start() }
    private var audioThread: Thread? = null
    @Volatile private var stopAudio = false

    init {
        val vf = MediaFormat.createVideoFormat(VIDEO_MIME, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, bitrateFor(width, height, fps))
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
        videoCodec.setCallback(object : MediaCodec.Callback() {
            override fun onInputBufferAvailable(codec: MediaCodec, index: Int) {}
            override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
                val buf = codec.getOutputBuffer(index)
                if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
                if (info.size > 0 && buf != null) write(true, buf, info)
                codec.releaseOutputBuffer(index, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    synchronized(lock) { videoDone = true; lock.notifyAll() }
                }
            }
            override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
                synchronized(lock) { videoTrack = muxer.addTrack(format); maybeStartMuxer() }
            }
            override fun onError(codec: MediaCodec, e: MediaCodec.CodecException) {
                Log.e(TAG, "video encoder error", e)
                synchronized(lock) { videoDone = true; lock.notifyAll() }
            }
        }, Handler(videoThread.looper))
        videoCodec.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        inputSurface = videoCodec.createInputSurface()

        audioCodec?.configure(MediaFormat.createAudioFormat(AUDIO_MIME, AudioRing.RATE, 2).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, 192_000)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
        }, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    }

    fun start(latencyFrames: Int) {
        videoCodec.start()
        val ac = audioCodec ?: return
        ac.start()
        ring!!.beginRead(latencyFrames)
        audioThread = Thread({ audioLoop(ac, ring) }, "enc-audio").apply { start() }
    }

    private fun maybeStartMuxer() {
        if (muxerStarted || videoTrack < 0 || (audioCodec != null && audioTrack < 0)) return
        muxer.start()
        muxerStarted = true
        for ((isVideo, data, info) in pending) {
            muxer.writeSampleData(if (isVideo) videoTrack else audioTrack, ByteBuffer.wrap(data), info)
        }
        pending.clear()
    }

    private fun write(isVideo: Boolean, buf: ByteBuffer, info: MediaCodec.BufferInfo) {
        synchronized(lock) {
            buf.position(info.offset); buf.limit(info.offset + info.size)
            if (muxerStarted) {
                muxer.writeSampleData(if (isVideo) videoTrack else audioTrack, buf, info)
            } else {
                val copy = ByteArray(info.size); buf.get(copy)
                val ci = MediaCodec.BufferInfo().apply { set(0, info.size, info.presentationTimeUs, info.flags) }
                pending.add(Triple(isVideo, copy, ci))
            }
            if (isVideo) samplesWritten++
        }
    }

    private fun audioLoop(codec: MediaCodec, ring: AudioRing) {
        val chunk = 1024
        val pcm = ShortArray(chunk * 2)
        var written = 0L
        val info = MediaCodec.BufferInfo()
        var eosQueued = false
        try {
            while (true) {
                if (!eosQueued) {
                    val target = (System.nanoTime() - startNanos) * AudioRing.RATE / 1_000_000_000L
                    while (written + chunk <= target && !stopAudio) {
                        val ib = codec.dequeueInputBuffer(10_000)
                        if (ib < 0) break
                        ring.read(pcm, chunk)
                        val buf = codec.getInputBuffer(ib)!!
                        buf.clear()
                        buf.order(ByteOrder.nativeOrder()).asShortBuffer().put(pcm, 0, chunk * 2)
                        codec.queueInputBuffer(ib, 0, chunk * 4, written * 1_000_000L / AudioRing.RATE, 0)
                        written += chunk
                    }
                    if (stopAudio) {
                        val ib = codec.dequeueInputBuffer(10_000)
                        if (ib >= 0) {
                            codec.queueInputBuffer(ib, 0, 0, written * 1_000_000L / AudioRing.RATE, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            eosQueued = true
                        }
                    }
                }
                var ob = codec.dequeueOutputBuffer(info, if (eosQueued) 10_000 else 0)
                while (ob != MediaCodec.INFO_TRY_AGAIN_LATER) {
                    if (ob == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        synchronized(lock) { audioTrack = muxer.addTrack(codec.outputFormat); maybeStartMuxer() }
                    } else if (ob >= 0) {
                        if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
                        val buf = codec.getOutputBuffer(ob)
                        if (info.size > 0 && buf != null) write(false, buf, info)
                        codec.releaseOutputBuffer(ob, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            synchronized(lock) { audioDone = true; lock.notifyAll() }
                            return
                        }
                    }
                    ob = codec.dequeueOutputBuffer(info, 0)
                }
                if (!eosQueued) Thread.sleep(8)
            }
        } catch (e: Exception) {
            Log.e(TAG, "audio encoder error", e)
            synchronized(lock) { audioDone = true; lock.notifyAll() }
        }
    }

    /**
     * Ends the streams and finalises the file. Call from any thread after the GL side has stopped
     * drawing to [inputSurface]. Returns true if the file contains video.
     */
    fun finish(): Boolean {
        runCatching { videoCodec.signalEndOfInputStream() }
        stopAudio = true
        val deadline = System.currentTimeMillis() + 4000
        synchronized(lock) {
            while ((!videoDone || !audioDone) && System.currentTimeMillis() < deadline) lock.wait(200)
        }
        audioThread?.join(500)
        val ok = synchronized(lock) { muxerStarted && samplesWritten > 0 }
        runCatching { videoCodec.stop() }; runCatching { videoCodec.release() }
        runCatching { audioCodec?.stop() }; runCatching { audioCodec?.release() }
        runCatching { if (muxerStarted) muxer.stop() }
        runCatching { muxer.release() }
        runCatching { inputSurface.release() }
        videoThread.quitSafely()
        return ok
    }
}
