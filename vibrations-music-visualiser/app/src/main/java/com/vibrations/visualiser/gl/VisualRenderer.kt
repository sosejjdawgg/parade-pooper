package com.vibrations.visualiser.gl

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.net.Uri
import android.opengl.EGL14
import android.opengl.EGLConfig as Egl14Config
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES30
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.util.Log
import com.vibrations.visualiser.audio.AudioEngine
import com.vibrations.visualiser.audio.AudioAnalyzer
import com.vibrations.visualiser.audio.Features
import com.vibrations.visualiser.model.Aspect
import com.vibrations.visualiser.model.Catalog
import com.vibrations.visualiser.model.Look
import com.vibrations.visualiser.model.Output
import com.vibrations.visualiser.model.Symmetry
import com.vibrations.visualiser.model.TextPlacement
import com.vibrations.visualiser.record.ClipRecorder
import com.vibrations.visualiser.record.MediaSaver
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Render pipeline (all on the GL thread):
 *   scene  -> [scene target, scaled per scene]
 *   feedback (scene crossfade + trails) -> trail ping-pong (canvas res, HDR)
 *   bloom: 1/4 and 1/8 res, separable blur
 *   composite (tone map, grain, text) -> canvas (RGBA8, exact output size)
 *   canvas -> screen (letterboxed over a soft ambient fill), -> encoder surface, -> PNG
 */
class VisualRenderer(
    private val context: Context,
    private val catalog: Catalog,
    private val audio: AudioEngine,
    private val events: Events,
) : GLSurfaceView.Renderer {

    interface Events {
        fun onRecordingStarted(loop: Boolean)
        fun onRecordingFinished(uri: Uri?, error: String?)
        fun onLoopProgress(fraction: Float)
        fun onStillSaved(uri: Uri?, error: String?)
        fun onRendererError(message: String)
    }

    @Volatile var look = Look()
    @Volatile var output = Output()
    @Volatile var softHeld = false

    private val io = Executors.newSingleThreadExecutor()

    // ---- GL resources ----------------------------------------------------
    private lateinit var vs: String
    private lateinit var common: String
    private var feedbackP: Program? = null
    private var downP: Program? = null
    private var blurP: Program? = null
    private var compP: Program? = null
    private var blitP: Program? = null
    private var scenePrograms = arrayOfNulls<Program>(0)
    private val brokenScenes = HashSet<Int>()
    private var hdr = false
    private var textTex = 0

    private var sceneA: Target? = null
    private var sceneB: Target? = null
    private var trail0: Target? = null
    private var trail1: Target? = null
    private var trailFlip = false
    private var b1: Target? = null
    private var b1t: Target? = null
    private var b2: Target? = null
    private var b2t: Target? = null
    private var canvas: Target? = null

    private var screenW = 1
    private var screenH = 1
    var canvasW = 0; private set
    var canvasH = 0; private set
    private var canvasKey = ""
    private val fitCache = HashMap<String, Pair<Int, Int>>()

    // ---- animation state ---------------------------------------------------
    private var lastNanos = 0L
    private var sceneTime = 0.0
    private var period = 240.0
    private var shownScene = -1
    private var shownSym = Symmetry.OFF
    private var prevScene = -1
    private var prevSym = Symmetry.OFF
    private var fade = 0f
    private val pal = FloatArray(12)
    private var punch = 0f
    private var palInit = false
    private var textKey = ""
    private var prewarm = 0
    private var frameCount = 0L

    // ---- audio smoothing -----------------------------------------------------
    private val feat = Features()
    private val spec = FloatArray(AudioAnalyzer.BANDS)
    private val specOut = FloatArray(AudioAnalyzer.BANDS)
    private var bass = 0f
    private var mid = 0f
    private var high = 0f
    private var level = 0f
    private var energy = 0f
    private var kickStrength = 0f
    private var kickAge = 10f
    private var softAmt = 0f
    private var reactEnv = 1f

    // ---- recording -----------------------------------------------------------
    private class Capture(
        val recorder: ClipRecorder,
        val surface: EGLSurface,
        val target: MediaSaver.Target,
        val loopSeconds: Int,
        val startNanos: Long,
    ) {
        var lastEncode = 0L
        var preroll = 0f
        var recording = false      // loop: false while pre-rolling
        var loopStartWall = 0L
        var loopStartTime = 0.0
        var frame = 0
        val totalFrames get() = loopSeconds * recorder.fps
    }
    private var capture: Capture? = null
    private var stillRequested = false

    // ---------------------------------------------------------------------------

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // A new context: every old GL object is gone.
        sceneA = null; sceneB = null; trail0 = null; trail1 = null
        b1 = null; b1t = null; b2 = null; b2t = null; canvas = null; canvasKey = ""
        vs = loadAsset(context, "shaders/post/fullscreen.vert")
        common = loadAsset(context, "shaders/common.glsl")
        feedbackP = Program(vs, loadAsset(context, "shaders/post/feedback.frag"))
        downP = Program(vs, loadAsset(context, "shaders/post/down.frag"))
        blurP = Program(vs, loadAsset(context, "shaders/post/blur.frag"))
        compP = Program(vs, loadAsset(context, "shaders/post/composite.frag"))
        blitP = Program(vs, loadAsset(context, "shaders/post/blit.frag"))
        scenePrograms = arrayOfNulls(catalog.scenes.size)
        brokenScenes.clear()
        prewarm = 0
        val ext = GLES30.glGetString(GLES30.GL_EXTENSIONS) ?: ""
        hdr = ext.contains("GL_EXT_color_buffer_half_float") || ext.contains("GL_EXT_color_buffer_float")
        val t = IntArray(1)
        GLES30.glGenTextures(1, t, 0)
        textTex = t[0]
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, textTex)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexImage2D(GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA8, 1, 1, 0, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, ByteBuffer.allocateDirect(4))
        textKey = ""
        GLES30.glGenVertexArrays(1, t, 0)
        GLES30.glBindVertexArray(t[0])
        GLES30.glDisable(GLES30.GL_DEPTH_TEST)
        GLES30.glDisable(GLES30.GL_BLEND)
        lastNanos = 0L
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        screenW = max(1, width); screenH = max(1, height)
    }

    // ---- canvas sizing -------------------------------------------------------

    private fun round16(v: Float) = max(16, (v / 16f).roundToInt() * 16)

    private fun desiredCanvas(out: Output): Pair<Int, Int> {
        val short = if (out.hd) 1080 else 720
        val maxLong = if (out.hd) 1920 else 1280
        val ratio = if (out.aspect == Aspect.FULL) screenW.toFloat() / screenH else out.aspect.ratio
        var w: Int; var h: Int
        if (ratio < 1f) { w = short; h = round16(short / ratio) } else { h = short; w = round16(short * ratio) }
        if (max(w, h) > maxLong) {
            val s = maxLong.toFloat() / max(w, h)
            w = round16(w * s); h = round16(h * s)
        }
        if (out.aspect == Aspect.SQUARE) h = w
        val key = "$w x $h @ ${out.fps}"
        return fitCache.getOrPut(key) { ClipRecorder.fitSize(w, h, out.fps) }
    }

    private fun ensureTargets(out: Output) {
        if (capture != null && canvas != null) return  // size is frozen while recording
        val (w, h) = desiredCanvas(out)
        val key = "$w:$h:$hdr"
        if (key == canvasKey && canvas != null) return
        listOf(trail0, trail1, b1, b1t, b2, b2t, canvas).forEach { it?.release() }
        trail0 = null; trail1 = null; b1 = null; b1t = null; b2 = null; b2t = null; canvas = null
        canvasW = w; canvasH = h
        try {
            allocTargets(w, h)
        } catch (e: GlException) {
            if (!hdr) throw e
            // Some drivers advertise half-float rendering but reject the framebuffer: fall back to 8-bit.
            Log.w("VisualRenderer", "HDR targets unavailable, using RGBA8", e)
            listOf(trail0, trail1, b1, b1t, b2, b2t, canvas).forEach { it?.release() }
            sceneA?.release(); sceneB?.release(); sceneA = null; sceneB = null
            hdr = false
            allocTargets(w, h)
        }
        canvasKey = "$w:$h:$hdr"
        textKey = ""
    }

    private fun allocTargets(w: Int, h: Int) {
        trail0 = Target(w, h, hdr); trail1 = Target(w, h, hdr)
        b1 = Target(max(1, w / 4), max(1, h / 4), hdr); b1t = Target(max(1, w / 4), max(1, h / 4), hdr)
        b2 = Target(max(1, w / 8), max(1, h / 8), hdr); b2t = Target(max(1, w / 8), max(1, h / 8), hdr)
        canvas = Target(w, h, false)
    }

    private fun sceneTarget(existing: Target?, scene: Int): Target {
        val s = catalog.scenes[scene].scale
        val w = max(16, (canvasW * s).roundToInt())
        val h = max(16, (canvasH * s).roundToInt())
        if (existing != null && existing.w == w && existing.h == h) return existing
        existing?.release()
        return Target(w, h, hdr)
    }

    private fun sceneProgram(i: Int): Program? {
        if (i in brokenScenes) return null
        scenePrograms[i]?.let { return it }
        return try {
            val body = loadAsset(context, "shaders/scenes/${catalog.scenes[i].id}.glsl")
            Program(vs, "$common\n$body").also { scenePrograms[i] = it }
        } catch (e: Exception) {
            Log.e("VisualRenderer", "scene ${catalog.scenes[i].id} failed", e)
            brokenScenes.add(i)
            events.onRendererError("Scene ${catalog.scenes[i].name} isn't supported on this device")
            null
        }
    }

    // ---- frame -----------------------------------------------------------------

    override fun onDrawFrame(gl: GL10?) {
        val now = System.nanoTime()
        var dt = if (lastNanos == 0L) 1f / 60f else ((now - lastNanos) / 1e9f).coerceIn(0f, 0.1f)
        lastNanos = now
        frameCount++
        val lk = look
        val out = output
        ensureTargets(out)

        // --- period / loop timing ---
        val newPeriod = if (out.loopMode) out.loopSeconds * lk.motion.toDouble() else 240.0
        if (newPeriod != period) {
            sceneTime = sceneTime / period * newPeriod
            period = newPeriod
        }

        // --- capture state machine (decides scene time + reactivity envelope) ---
        val cap = capture
        var encodePts = -1L
        if (cap != null && cap.loopSeconds > 0) {
            if (!cap.recording) {
                cap.preroll += dt
                reactEnv = max(0f, reactEnv - dt / 0.45f)
                advanceTime(dt, lk, out, flow = false)
                if (cap.preroll >= 1.1f) {
                    cap.recording = true
                    cap.loopStartWall = now
                    cap.loopStartTime = sceneTime
                    cap.frame = 0
                }
            }
            if (cap.recording) {
                val fps = cap.recorder.fps
                val L = cap.loopSeconds.toFloat()
                val elapsed = (now - cap.loopStartWall) / 1e9
                val due = elapsed >= cap.frame.toDouble() / fps
                val s: Double = if (due) cap.frame.toDouble() / fps else elapsed
                sceneTime = (cap.loopStartTime + s * lk.motion) % period
                val sf = s.toFloat()
                reactEnv = min(smooth(0f, 0.6f, sf), 1f - smooth(L - 1.0f, L - 0.45f, sf))
                if (due) {
                    encodePts = cap.frame.toLong() * 1_000_000_000L / fps
                    cap.frame++
                    dt = 1f / fps
                }
            }
        } else {
            reactEnv = min(1f, reactEnv + dt / 0.6f)
            advanceTime(dt, lk, out, flow = !out.loopMode)
            if (cap != null) {
                val frameNs = 1_000_000_000L / cap.recorder.fps
                if (cap.lastEncode == 0L || now - cap.lastEncode >= frameNs * 85 / 100) {
                    cap.lastEncode = if (cap.lastEncode == 0L) now else max(cap.lastEncode + frameNs, now - frameNs)
                    encodePts = now - cap.startNanos
                }
            }
        }

        updateAudio(dt, lk)
        updatePalette(dt, lk)
        updateTransition(dt, lk)
        updateText(lk)

        renderPipeline(lk, dt)
        drawScreen()

        if (cap != null && encodePts >= 0) encodeFrame(cap, encodePts)
        if (cap != null && cap.loopSeconds > 0 && cap.recording) {
            events.onLoopProgress(cap.frame.toFloat() / cap.totalFrames)
            if (cap.frame >= cap.totalFrames) finishCapture()
        }
        if (stillRequested) { stillRequested = false; captureStill() }

        // Compile the remaining scenes gradually so switching is instant later.
        if (frameCount > 45 && prewarm < scenePrograms.size && frameCount % 6 == 0L) {
            if (scenePrograms[prewarm] == null) sceneProgram(prewarm)
            prewarm++
        }
    }

    private fun smooth(a: Float, b: Float, x: Float): Float {
        val t = ((x - a) / (b - a)).coerceIn(0f, 1f)
        return t * t * (3 - 2 * t)
    }

    private fun advanceTime(dt: Float, lk: Look, out: Output, flow: Boolean) {
        val push = if (flow) 1f + 0.7f * energy * reactEnv * (1f - 0.6f * softAmt) else 1f
        sceneTime = (sceneTime + dt * lk.motion * push) % period
    }

    private fun approach(cur: Float, target: Float, dt: Float, attack: Float, release: Float): Float {
        val tau = if (target > cur) attack else release
        return cur + (target - cur) * (1f - exp(-dt / tau))
    }

    private fun updateAudio(dt: Float, lk: Look) {
        audio.query(feat)
        val softTarget = if (lk.soft || softHeld) 1f else 0f
        softAmt = approach(softAmt, softTarget, dt, 0.25f, 0.4f)
        val attack = 0.03f + 0.2f * softAmt
        val release = 0.22f + 0.6f * softAmt
        val sens = lk.sensitivity
        val active = feat.active
        fun tgt(v: Float) = if (active) min(1.25f, v * sens) else 0f
        bass = approach(bass, tgt(feat.bass), dt, attack, release)
        mid = approach(mid, tgt(feat.mid), dt, attack, release)
        high = approach(high, tgt(feat.high), dt, attack * 0.7f, release * 0.8f)
        level = approach(level, tgt(feat.level), dt, attack, release)
        energy = approach(energy, if (active) feat.level else 0f, dt, 1.5f, 2.5f)
        for (i in spec.indices) spec[i] = approach(spec[i], tgt(feat.spec[i]), dt, attack, release * 0.8f)
        if (feat.kick > 0f) {
            kickStrength = min(1f, feat.kick * (0.55f + 0.45f * sens))
            kickAge = feat.kickAgeSec
        } else {
            kickAge = min(kickAge + dt, 10f)
        }
    }

    private fun updatePalette(dt: Float, lk: Look) {
        val p = catalog.palettes[lk.palette.coerceIn(0, catalog.palettes.size - 1)]
        if (!palInit) { System.arraycopy(p.rgb, 0, pal, 0, 12); punch = p.punch; palInit = true; return }
        val k = 1f - exp(-dt / 0.22f)
        for (i in 0 until 12) pal[i] += (p.rgb[i] - pal[i]) * k
        punch += (p.punch - punch) * k
    }

    private fun updateTransition(dt: Float, lk: Look) {
        val scene = lk.scene.coerceIn(0, catalog.scenes.size - 1)
        if (shownScene < 0) { shownScene = scene; shownSym = lk.symmetry }
        if (scene != shownScene || lk.symmetry != shownSym) {
            prevScene = shownScene; prevSym = shownSym
            shownScene = scene; shownSym = lk.symmetry
            fade = 1f
            // the two scene targets swap roles so the outgoing frame stays intact
            val t = sceneA; sceneA = sceneB; sceneB = t
        }
        if (fade > 0f) fade = max(0f, fade - dt / 0.9f)
    }

    private fun updateText(lk: Look) {
        val key = if (lk.textOn) "${lk.title}|${lk.subtitle}|${lk.textPlacement}|$canvasW|$canvasH" else "off"
        if (key == textKey) return
        textKey = key
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, textTex)
        if (!lk.textOn || (lk.title.isBlank() && lk.subtitle.isBlank())) {
            GLES30.glTexImage2D(GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA8, 1, 1, 0, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, ByteBuffer.allocateDirect(4))
            return
        }
        val bmp = TextOverlay.render(canvasW, canvasH, lk.title, lk.subtitle, lk.textPlacement)
        GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, bmp, 0)
        bmp.recycle()
    }

    // ---- passes ------------------------------------------------------------------

    private fun bindTex(unit: Int, tex: Int) {
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0 + unit)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
    }

    private fun draw() = GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)

    private fun renderScene(index: Int, sym: Symmetry, target: Target) {
        target.bind()
        val p = sceneProgram(index)
        if (p == null) {
            GLES30.glClearColor(pal[0], pal[1], pal[2], 1f); GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
            return
        }
        p.use()
        val e = reactEnv * (1f - 0.55f * softAmt)
        p.f2("uRes", target.w.toFloat(), target.h.toFloat())
        p.f("uTime", sceneTime.toFloat())
        p.f("uPeriod", period.toFloat())
        p.f("uLevel", level * e)
        p.f("uBass", bass * e)
        p.f("uMid", mid * e)
        p.f("uHigh", high * e)
        val kickDecay = 0.2f + 0.3f * softAmt
        p.f("uKick", kickStrength * exp(-kickAge / kickDecay) * e)
        p.f("uKickAge", kickAge)
        p.f("uEnergy", energy * e)
        for (i in spec.indices) specOut[i] = spec[i] * e
        p.fv("uSpec", specOut)
        p.f3v("uPal", pal)
        p.i("uSym", sym.shaderValue)
        val rot = if (output.loopMode) 0.0 else 2.0 * Math.PI * sceneTime / period
        p.f("uSymRot", rot.toFloat())
        draw()
    }

    private fun renderPipeline(lk: Look, dt: Float) {
        sceneA = sceneTarget(sceneA, shownScene)
        renderScene(shownScene, shownSym, sceneA!!)
        if (fade > 0f && prevScene >= 0) {
            sceneB = sceneTarget(sceneB, prevScene)
            renderScene(prevScene, prevSym, sceneB!!)
        }

        // feedback: crossfade + trails
        val src = if (trailFlip) trail1!! else trail0!!
        val dst = if (trailFlip) trail0!! else trail1!!
        trailFlip = !trailFlip
        dst.bind()
        val fb = feedbackP!!
        fb.use()
        bindTex(0, sceneA!!.tex); bindTex(1, (sceneB ?: sceneA!!).tex); bindTex(2, src.tex)
        fb.i("uCur", 0); fb.i("uPrev", 1); fb.i("uHist", 2)
        fb.f("uFade", if (prevScene >= 0) fade * fade * (3 - 2 * fade) else 0f)
        val frames = dt * 60f
        fb.f("uTrail", if (lk.trails > 0.01f) (lk.trails * 0.94f).pow(frames) else 0f)
        fb.f("uZoom", 0.0025f * lk.trails * frames)
        fb.f("uFloor", if (hdr) 0.0005f else 1.5f / 255f)
        draw()

        // bloom
        val d = downP!!; val bl = blurP!!
        d.use(); bindTex(0, dst.tex); d.i("uTex", 0)
        d.f2("uTexel", 1f / dst.w, 1f / dst.h); d.f("uKnee", 1f)
        b1!!.bind(); draw()
        bl.use(); bl.i("uTex", 0)
        b1t!!.bind(); bindTex(0, b1!!.tex); bl.f2("uDir", 1f / b1!!.w, 0f); draw()
        b1!!.bind(); bindTex(0, b1t!!.tex); bl.f2("uDir", 0f, 1f / b1!!.h); draw()
        d.use(); bindTex(0, b1!!.tex); d.f2("uTexel", 1f / b1!!.w, 1f / b1!!.h); d.f("uKnee", 0f)
        b2!!.bind(); draw()
        bl.use()
        repeat(2) {
            b2t!!.bind(); bindTex(0, b2!!.tex); bl.f2("uDir", 1.5f / b2!!.w, 0f); draw()
            b2!!.bind(); bindTex(0, b2t!!.tex); bl.f2("uDir", 0f, 1.5f / b2!!.h); draw()
        }

        // composite
        val c = compP!!
        canvas!!.bind()
        c.use()
        bindTex(0, dst.tex); bindTex(1, b1!!.tex); bindTex(2, b2!!.tex); bindTex(3, textTex)
        c.i("uScene", 0); c.i("uBloom1", 1); c.i("uBloom2", 2); c.i("uText", 3)
        c.f("uBloomAmt", lk.glow * 1.1f)
        c.f("uPunch", punch)
        c.f("uGrain", lk.grain)
        c.f("uTextAlpha", if (lk.textOn) 0.92f else 0f)
        c.f3("uTextColor", 0.25f + 0.75f * pal[9], 0.25f + 0.75f * pal[10], 0.25f + 0.75f * pal[11])
        c.f("uSeed", (frameCount % 997).toFloat())
        c.f2("uRes", canvasW.toFloat(), canvasH.toFloat())
        draw()
    }

    private fun blit(tex: Int, gain: Float, sx: Float, sy: Float) {
        val b = blitP!!
        b.use()
        bindTex(0, tex); b.i("uTex", 0)
        b.f("uGain", gain); b.f2("uUvScale", sx, sy); b.f2("uUvOffset", 0f, 0f)
        draw()
    }

    private fun drawScreen() {
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        GLES30.glViewport(0, 0, screenW, screenH)
        val cr = canvasW.toFloat() / canvasH
        val sr = screenW.toFloat() / screenH
        val vw: Int; val vh: Int
        if (cr > sr) { vw = screenW; vh = (screenW / cr).roundToInt() } else { vh = screenH; vw = (screenH * cr).roundToInt() }
        if (vw < screenW - 2 || vh < screenH - 2) {
            // soft ambient fill behind the letterbox, built from the widest bloom level
            if (cr > sr) blit(b2!!.tex, 0.32f, sr / cr, 1f) else blit(b2!!.tex, 0.32f, 1f, cr / sr)
        }
        GLES30.glViewport((screenW - vw) / 2, (screenH - vh) / 2, vw, vh)
        blit(canvas!!.tex, 1f, 1f, 1f)
    }

    // ---- recording ---------------------------------------------------------------

    /** GL thread. [target] was created by the UI thread. */
    fun startRecording(target: MediaSaver.Target) {
        if (capture != null) { MediaSaver.discard(context, target.uri); return }
        val out = output
        ensureTargets(out)
        val loop = out.loopSeconds
        try {
            val start = System.nanoTime()
            val rec = ClipRecorder(canvasW, canvasH, out.fps, target.pfd.fileDescriptor,
                if (loop > 0) null else audio.recordRing, start)
            val surface = createEncoderSurface(rec)
            rec.start(audio.latencyFrames44k())
            capture = Capture(rec, surface, target, loop, start)
            events.onRecordingStarted(loop > 0)
        } catch (e: Exception) {
            Log.e("VisualRenderer", "record start failed", e)
            runCatching { target.pfd.close() }
            MediaSaver.discard(context, target.uri)
            events.onRecordingFinished(null, "Couldn't start recording: ${e.message}")
        }
    }

    /** GL thread. */
    fun stopRecording() = finishCapture()

    val isRecording get() = capture != null

    private fun createEncoderSurface(rec: ClipRecorder): EGLSurface {
        val dpy = EGL14.eglGetCurrentDisplay()
        val ctx = EGL14.eglGetCurrentContext()
        val id = IntArray(1)
        EGL14.eglQueryContext(dpy, ctx, EGL14.EGL_CONFIG_ID, id, 0)
        val cfgs = arrayOfNulls<Egl14Config>(1)
        val num = IntArray(1)
        EGL14.eglChooseConfig(dpy, intArrayOf(EGL14.EGL_CONFIG_ID, id[0], EGL14.EGL_NONE), 0, cfgs, 0, 1, num, 0)
        val surf = EGL14.eglCreateWindowSurface(dpy, cfgs[0], rec.inputSurface, intArrayOf(EGL14.EGL_NONE), 0)
        if (surf == null || surf == EGL14.EGL_NO_SURFACE) {
            rec.finish()
            throw IllegalStateException("encoder surface unavailable (EGL ${EGL14.eglGetError()})")
        }
        return surf
    }

    private fun encodeFrame(cap: Capture, ptsNanos: Long) {
        val dpy = EGL14.eglGetCurrentDisplay()
        val ctx = EGL14.eglGetCurrentContext()
        val draw = EGL14.eglGetCurrentSurface(EGL14.EGL_DRAW)
        val read = EGL14.eglGetCurrentSurface(EGL14.EGL_READ)
        if (!EGL14.eglMakeCurrent(dpy, cap.surface, cap.surface, ctx)) return
        GLES30.glViewport(0, 0, canvasW, canvasH)
        blit(canvas!!.tex, 1f, 1f, 1f)
        EGLExt.eglPresentationTimeANDROID(dpy, cap.surface, ptsNanos)
        EGL14.eglSwapBuffers(dpy, cap.surface)
        EGL14.eglMakeCurrent(dpy, draw, read, ctx)
    }

    private fun finishCapture() {
        val cap = capture ?: return
        capture = null
        val dpy = EGL14.eglGetCurrentDisplay()
        EGL14.eglDestroySurface(dpy, cap.surface)
        val incompleteLoop = cap.loopSeconds > 0 && cap.frame < cap.totalFrames
        io.execute {
            val ok = runCatching { cap.recorder.finish() }.getOrDefault(false)
            runCatching { cap.target.pfd.close() }
            if (ok) {
                MediaSaver.publish(context, cap.target.uri)
                events.onRecordingFinished(cap.target.uri, if (incompleteLoop) "Loop stopped early — saved what was captured" else null)
            } else {
                MediaSaver.discard(context, cap.target.uri)
                events.onRecordingFinished(null, if (cap.loopSeconds > 0 && !cap.recording) null else "Nothing was recorded")
            }
        }
    }

    // ---- stills --------------------------------------------------------------------

    fun requestStill() { stillRequested = true }

    private fun captureStill() {
        val w = canvasW; val h = canvasH
        val buf = ByteBuffer.allocateDirect(w * h * 4).order(ByteOrder.nativeOrder())
        canvas!!.bind()
        GLES30.glReadPixels(0, 0, w, h, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, buf)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        io.execute {
            try {
                buf.rewind()
                val raw = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                raw.copyPixelsFromBuffer(buf)
                val flipped = Bitmap.createBitmap(raw, 0, 0, w, h, Matrix().apply { preScale(1f, -1f) }, false)
                raw.recycle()
                val uri = MediaSaver.savePng(context, flipped, MediaSaver.stamp("Vibrations"))
                flipped.recycle()
                events.onStillSaved(uri, null)
            } catch (e: Exception) {
                events.onStillSaved(null, e.message ?: "Couldn't save image")
            }
        }
    }
}
