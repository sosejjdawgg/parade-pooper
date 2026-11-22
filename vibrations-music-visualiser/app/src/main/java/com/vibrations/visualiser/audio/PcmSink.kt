package com.vibrations.visualiser.audio

/** Receives interleaved 16-bit PCM from a source, tagged with its stream position. */
fun interface PcmSink {
    fun onPcm(pcm: ShortArray, frames: Int, channels: Int, rate: Int, streamPos: Long)
}
