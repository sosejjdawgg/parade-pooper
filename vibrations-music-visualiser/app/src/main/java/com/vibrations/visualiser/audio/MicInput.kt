package com.vibrations.visualiser.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log

/** Microphone capture (unprocessed where available, so music isn't squashed by voice DSP). */
class MicInput(private val sink: PcmSink, private val onError: (String) -> Unit) {
    companion object { const val RATE = 44100 }

    @Volatile private var running = false
    @Volatile var framesRead = 0L; private set
    private var thread: Thread? = null

    @SuppressLint("MissingPermission")
    fun start() {
        running = true
        thread = Thread({
            var rec: AudioRecord? = null
            try {
                val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                rec = try {
                    AudioRecord(MediaRecorder.AudioSource.UNPROCESSED, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, min * 4)
                        .also { if (it.state != AudioRecord.STATE_INITIALIZED) { it.release(); throw IllegalStateException() } }
                } catch (e: Exception) {
                    AudioRecord(MediaRecorder.AudioSource.MIC, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, min * 4)
                }
                if (rec.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("Microphone unavailable")
                rec.startRecording()
                val buf = ShortArray(1024)
                while (running) {
                    val n = rec.read(buf, 0, buf.size)
                    if (n > 0) {
                        sink.onPcm(buf, n, 1, RATE, framesRead)
                        framesRead += n
                    } else if (n < 0) throw IllegalStateException("Microphone read failed ($n)")
                }
            } catch (e: Exception) {
                Log.e("MicInput", "mic failed", e)
                if (running) onError(e.message ?: "Microphone unavailable")
            } finally {
                runCatching { rec?.stop() }
                runCatching { rec?.release() }
            }
        }, "mic-input").apply { start() }
    }

    fun stop() {
        running = false
        thread?.join(1000)
    }
}
