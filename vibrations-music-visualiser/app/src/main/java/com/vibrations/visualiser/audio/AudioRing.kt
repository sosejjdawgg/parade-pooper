package com.vibrations.visualiser.audio

import kotlin.math.floor
import kotlin.math.max

/**
 * Stereo 44.1 kHz ring buffer feeding the clip recorder. Any source format is converted
 * (channel mapping + linear resampling). Keeps a few seconds of history so the recorder
 * can start reading from what is audible now rather than what was just decoded.
 */
class AudioRing(seconds: Int = 4) {
    companion object { const val RATE = 44100 }

    private val cap = RATE * seconds
    private val buf = ShortArray(cap * 2)
    private var writePos = 0L
    private var readPos = 0L

    private var srcRate = -1
    private var srcCh = -1
    private var resPos = 0.0
    private var prevL = 0f
    private var prevR = 0f

    @Synchronized
    fun write(pcm: ShortArray, frames: Int, channels: Int, rate: Int) {
        if (rate != srcRate || channels != srcCh) {
            srcRate = rate; srcCh = channels; resPos = 0.0; prevL = 0f; prevR = 0f
        }
        fun l(i: Int): Float = if (i < 0) prevL else pcm[i * channels].toFloat()
        fun r(i: Int): Float = if (i < 0) prevR else if (channels > 1) pcm[i * channels + 1].toFloat() else pcm[i * channels].toFloat()
        if (rate == RATE) {
            for (i in 0 until frames) push(l(i), r(i))
        } else {
            val step = rate.toDouble() / RATE
            while (resPos <= frames - 1) {
                val i = floor(resPos).toInt()
                val f = (resPos - i).toFloat()
                push(l(i) + (l(i + 1) - l(i)) * f, r(i) + (r(i + 1) - r(i)) * f)
                resPos += step
            }
            resPos -= frames
        }
        if (frames > 0) { prevL = l(frames - 1); prevR = r(frames - 1) }
    }

    private fun push(l: Float, r: Float) {
        val idx = ((writePos % cap) * 2).toInt()
        buf[idx] = l.toInt().coerceIn(-32768, 32767).toShort()
        buf[idx + 1] = r.toInt().coerceIn(-32768, 32767).toShort()
        writePos++
    }

    /** Start reading [latencyFrames] (at 44.1 kHz) behind the newest data. */
    @Synchronized
    fun beginRead(latencyFrames: Int) {
        readPos = max(writePos - latencyFrames.coerceIn(0, cap / 2), 0L)
    }

    /** Fills [dst] (interleaved stereo) with [frames] frames; missing data becomes silence. */
    @Synchronized
    fun read(dst: ShortArray, frames: Int) {
        if (writePos - readPos > cap) readPos = writePos - cap / 2
        for (i in 0 until frames) {
            if (readPos < writePos) {
                val idx = ((readPos % cap) * 2).toInt()
                dst[i * 2] = buf[idx]; dst[i * 2 + 1] = buf[idx + 1]
                readPos++
            } else {
                dst[i * 2] = 0; dst[i * 2 + 1] = 0
            }
        }
    }
}
