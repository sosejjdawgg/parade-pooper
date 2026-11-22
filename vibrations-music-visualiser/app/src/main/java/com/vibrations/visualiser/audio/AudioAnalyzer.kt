package com.vibrations.visualiser.audio

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

/** One analysis hop. */
class AudioFrame {
    var pos = 0L
    val spec = FloatArray(AudioAnalyzer.BANDS)
    var bass = 0f
    var mid = 0f
    var high = 0f
    var level = 0f
    var onset = 0f   // kick strength, 0 if no kick in this hop

    fun copyFrom(o: AudioFrame) {
        pos = o.pos; System.arraycopy(o.spec, 0, spec, 0, spec.size)
        bass = o.bass; mid = o.mid; high = o.high; level = o.level; onset = o.onset
    }
}

/** What the renderer gets each frame. */
class Features {
    val spec = FloatArray(AudioAnalyzer.BANDS)
    var bass = 0f
    var mid = 0f
    var high = 0f
    var level = 0f
    var active = false
    var kick = 0f          // strength of the newest kick since the previous query (0 = none)
    var kickAgeSec = 0f    // how long ago (in audio time) that kick happened
}

/**
 * FFT analysis with auto gain and kick detection. Results go into a timeline keyed by
 * stream position so the renderer can ask "what is audible right now" and stay on the beat
 * despite the AudioTrack buffer latency.
 */
class AudioAnalyzer {
    companion object {
        const val N = 2048
        const val HOP = 512
        const val BANDS = 32
        private const val TIMELINE = 512
    }

    private val fft = Fft(N)
    private val window = FloatArray(N) { (0.5 - 0.5 * cos(2.0 * PI * it / (N - 1))).toFloat() }
    private val ring = FloatArray(N)
    private var ringPos = 0
    private var sinceHop = 0
    private val re = FloatArray(N)
    private val im = FloatArray(N)
    private val mag = FloatArray(N / 2)

    private var rate = 44100
    private val bandLo = IntArray(BANDS)
    private val bandHi = IntArray(BANDS)
    private val bandTilt = FloatArray(BANDS)
    private val bandHz = FloatArray(BANDS)
    private var kickLo = 1
    private var kickHi = 8
    private val prevLog = FloatArray(64)

    private var peakDb = -40f
    private val fluxHist = FloatArray(48)
    private var fluxN = 0
    private var lastOnsetPos = Long.MIN_VALUE / 2

    private val timeline = Array(TIMELINE) { AudioFrame() }
    private var tlCount = 0L
    private var lastQueryPos = Long.MIN_VALUE
    private val scratch = AudioFrame()

    init { reset(44100) }

    @Synchronized
    fun reset(sampleRate: Int) {
        rate = sampleRate
        ring.fill(0f); ringPos = 0; sinceHop = 0
        val binHz = rate.toFloat() / N
        val fLo = 35f; val fHi = min(15000f, rate / 2f - binHz)
        for (b in 0 until BANDS) {
            val f0 = fLo * (fHi / fLo).pow(b / BANDS.toFloat())
            val f1 = fLo * (fHi / fLo).pow((b + 1) / BANDS.toFloat())
            bandLo[b] = max(1, (f0 / binHz).toInt())
            bandHi[b] = max(bandLo[b] + 1, (f1 / binHz).toInt())
            bandHz[b] = sqrt(f0 * f1)
            bandTilt[b] = 3.5f * log2(bandHz[b] / 1000f)
        }
        kickLo = max(1, (40f / binHz).toInt())
        kickHi = min(prevLog.size - 1, max(kickLo + 2, (150f / binHz).toInt()))
        prevLog.fill(0f)
        peakDb = -40f; fluxN = 0; lastOnsetPos = Long.MIN_VALUE / 2
        tlCount = 0; lastQueryPos = Long.MIN_VALUE
    }

    /** Feed mono samples; [startPos] is the stream position of mono[0]. Called on audio threads. */
    fun process(mono: FloatArray, n: Int, startPos: Long) {
        for (i in 0 until n) {
            ring[ringPos] = mono[i]
            ringPos = (ringPos + 1) % N
            if (++sinceHop >= HOP) {
                sinceHop = 0
                analyse(startPos + i)
            }
        }
    }

    private fun analyse(pos: Long) {
        var energy = 0f
        for (k in 0 until N) {
            val s = ring[(ringPos + k) % N]
            energy += s * s
            re[k] = s * window[k]; im[k] = 0f
        }
        fft.transform(re, im)
        val norm = 4f / N
        for (k in 0 until N / 2) mag[k] = sqrt(re[k] * re[k] + im[k] * im[k]) * norm

        val f = scratch
        f.pos = pos
        val rms = sqrt(energy / N)
        val silent = rms < 1.5e-4f
        var maxDb = -200f
        for (b in 0 until BANDS) {
            var sum = 0f
            for (k in bandLo[b] until bandHi[b]) sum += mag[k]
            val avg = sum / (bandHi[b] - bandLo[b])
            val db = 20f * log10(avg + 1e-9f) + bandTilt[b]
            f.spec[b] = db
            if (db > maxDb) maxDb = db
        }
        // auto gain: follow the loudest band with a slow release (~5 dB/s)
        peakDb = if (maxDb > peakDb) maxDb else max(peakDb - 5f * HOP / rate, -60f)
        val floor = peakDb - 40f
        var bass = 0f; var nb = 0; var mid = 0f; var nm = 0; var high = 0f; var nh = 0; var all = 0f
        for (b in 0 until BANDS) {
            var v = if (silent) 0f else ((f.spec[b] - floor) / 40f).coerceIn(0f, 1f)
            v = v * v * (3f - 2f * v)
            f.spec[b] = v
            all += v
            val hz = bandHz[b]
            when {
                hz < 150f -> { bass += v; nb++ }
                hz in 250f..2000f -> { mid += v; nm++ }
                hz in 3000f..12000f -> { high += v; nh++ }
            }
        }
        f.bass = if (nb > 0) bass / nb else 0f
        f.mid = if (nm > 0) mid / nm else 0f
        f.high = if (nh > 0) high / nh else 0f
        f.level = all / BANDS

        // kick: spectral flux in the low bins against an adaptive threshold
        var flux = 0f
        for (k in kickLo..kickHi) {
            val l = ln(1f + 200f * mag[k])
            val d = l - prevLog[k]
            if (d > 0) flux += d
            prevLog[k] = l
        }
        var mean = 0f; var sd = 0f
        val cnt = min(fluxN, fluxHist.size)
        if (cnt > 0) {
            for (i in 0 until cnt) mean += fluxHist[i]
            mean /= cnt
            for (i in 0 until cnt) { val d = fluxHist[i] - mean; sd += d * d }
            sd = sqrt(sd / cnt)
        }
        fluxHist[fluxN % fluxHist.size] = flux
        fluxN++
        val thresh = mean + 1.5f * sd + 0.05f
        val refractory = (0.13f * rate).toLong()
        f.onset = 0f
        if (!silent && cnt >= 8 && flux > thresh && flux > mean * 1.35f && pos - lastOnsetPos > refractory && f.bass > 0.12f) {
            lastOnsetPos = pos
            f.onset = ((flux - mean) / (4f * sd + 0.2f)).coerceIn(0.35f, 1f)
        }

        synchronized(this) {
            timeline[(tlCount % TIMELINE).toInt()].copyFrom(f)
            tlCount++
        }
    }

    /** Features for the given playback position (latest analysed hop at or before it). */
    @Synchronized
    fun query(pos: Long, out: Features) {
        out.kick = 0f
        if (tlCount == 0L) { out.active = false; return }
        val oldest = max(0L, tlCount - TIMELINE)
        var best = -1L
        var i = tlCount - 1
        if (pos < lastQueryPos) lastQueryPos = Long.MIN_VALUE
        while (i >= oldest) {
            val fr = timeline[(i % TIMELINE).toInt()]
            if (fr.pos <= pos) {
                if (best < 0) best = i
                if (fr.pos <= lastQueryPos) break
                if (fr.onset > 0f && out.kick == 0f) {
                    out.kick = fr.onset
                    out.kickAgeSec = (pos - fr.pos).toFloat() / rate
                }
            }
            i--
        }
        if (best < 0) best = oldest
        val fr = timeline[(best % TIMELINE).toInt()]
        System.arraycopy(fr.spec, 0, out.spec, 0, BANDS)
        out.bass = fr.bass; out.mid = fr.mid; out.high = fr.high; out.level = fr.level
        out.active = true
        lastQueryPos = pos
    }
}
