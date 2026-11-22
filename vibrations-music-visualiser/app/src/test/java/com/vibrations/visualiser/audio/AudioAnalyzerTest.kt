package com.vibrations.visualiser.audio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

class AudioAnalyzerTest {
    private val rate = 44100

    /** 120 BPM: pitched-down kick on every beat, hats on the off-beats, a quiet pad throughout. */
    private fun synth(seconds: Double): FloatArray {
        val n = (seconds * rate).toInt()
        val out = FloatArray(n)
        val rnd = Random(7)
        for (i in 0 until n) {
            val t = i.toDouble() / rate
            val beatT = t % 0.5
            var s = 0.0
            // kick: 110 -> 45 Hz sweep, fast decay
            val ph = 2 * PI * (45 * beatT + 65 * 0.03 * (1 - exp(-beatT / 0.03)))
            s += 0.8 * sin(ph) * exp(-beatT / 0.12)
            // hat on the off-beat
            val hatT = (t + 0.25) % 0.5
            s += 0.12 * (rnd.nextDouble() * 2 - 1) * exp(-hatT / 0.02)
            // pad
            s += 0.05 * sin(2 * PI * 220 * t) + 0.04 * sin(2 * PI * 330 * t)
            out[i] = s.toFloat()
        }
        return out
    }

    @Test
    fun fftFindsSinePeak() {
        val n = 1024
        val fft = Fft(n)
        val re = FloatArray(n) { sin(2 * PI * 50 * it / n).toFloat() }
        val im = FloatArray(n)
        fft.transform(re, im)
        val mags = (0 until n / 2).map { re[it] * re[it] + im[it] * im[it] }
        assertEquals(50, mags.indices.maxBy { mags[it] })
    }

    @Test
    fun kicksLandOnTheBeat() {
        val a = AudioAnalyzer()
        a.reset(rate)
        val pcm = synth(8.0)
        val out = Features()
        val kicks = ArrayList<Double>()
        var pos = 0
        val chunk = 1024
        var nextQuery = 0L
        val queryStep = rate / 60L // render at 60 fps
        while (pos < pcm.size) {
            val n = minOf(chunk, pcm.size - pos)
            a.process(pcm.copyOfRange(pos, pos + n), n, pos.toLong())
            pos += n
            while (nextQuery <= pos) {
                a.query(nextQuery, out)
                if (out.kick > 0f) kicks.add(nextQuery.toDouble() / rate - out.kickAgeSec)
                nextQuery += queryStep
            }
        }
        // ignore the first second while the adaptive threshold warms up
        val settled = kicks.filter { it > 1.0 }
        val expected = (3..15).map { it * 0.5 } // beats from 1.5 s .. 7.5 s
        val hits = expected.count { b -> settled.any { abs(it - b) < 0.035 } }
        val false_ = settled.count { k -> expected.none { abs(k - it) < 0.035 } && k < 7.6 }
        println("kicks: ${settled.map { String.format("%.3f", it) }}")
        assertTrue("hit $hits of ${expected.size}", hits >= expected.size - 1)
        assertTrue("false positives $false_", false_ <= 1)
    }

    @Test
    fun bassRespondsAndSilenceIsQuiet() {
        val a = AudioAnalyzer()
        a.reset(rate)
        val pcm = synth(3.0)
        a.process(pcm, pcm.size, 0)
        val out = Features()
        a.query((2.5 * rate).toLong() + 2000, out) // just after a kick
        assertTrue("bass ${out.bass}", out.bass > 0.4f)

        val b = AudioAnalyzer()
        b.reset(rate)
        val silence = FloatArray(rate)
        b.process(silence, silence.size, 0)
        b.query(rate.toLong(), out)
        assertEquals(0f, out.level, 1e-6f)
        assertEquals(0f, out.kick, 1e-6f)
    }

    @Test
    fun ringResamplesToRecorderRate() {
        val ring = AudioRing()
        val frames48 = 48000
        val pcm = ShortArray(frames48 * 2) { (1000 * sin(2 * PI * 440 * (it / 2) / 48000.0)).toInt().toShort() }
        // write in uneven chunks to exercise the carry-over between blocks
        var off = 0
        val sizes = intArrayOf(1000, 333, 4096, 17)
        var k = 0
        ring.beginRead(0)
        while (off < frames48) {
            val n = minOf(sizes[k++ % sizes.size], frames48 - off)
            ring.write(pcm.copyOfRange(off * 2, (off + n) * 2), n, 2, 48000)
            off += n
        }
        val dst = ShortArray(44100 * 2)
        ring.read(dst, 44100)
        // one second of 48 kHz becomes ~44100 frames: the last frames should be filled
        assertTrue(dst.slice(44000 * 2 until 44090 * 2).any { it.toInt() != 0 })
        // and the waveform should stay smooth (no discontinuities from chunk boundaries)
        var maxStep = 0
        for (i in 1 until 44090) maxStep = maxOf(maxStep, abs(dst[i * 2] - dst[(i - 1) * 2]))
        assertTrue("max step $maxStep", maxStep < 80)
    }
}
