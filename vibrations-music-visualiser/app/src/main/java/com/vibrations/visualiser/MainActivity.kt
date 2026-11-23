package com.vibrations.visualiser

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PixelFormat
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.vibrations.visualiser.audio.AudioEngine
import com.vibrations.visualiser.gl.RecordableConfigChooser
import com.vibrations.visualiser.gl.VisualRenderer
import com.vibrations.visualiser.model.ArtStore
import com.vibrations.visualiser.model.Aspect
import com.vibrations.visualiser.model.Catalog
import com.vibrations.visualiser.model.Look
import com.vibrations.visualiser.model.Output
import com.vibrations.visualiser.model.Preset
import com.vibrations.visualiser.model.PresetStore
import com.vibrations.visualiser.model.Symmetry
import com.vibrations.visualiser.model.TextPlacement
import com.vibrations.visualiser.record.MediaSaver
import com.vibrations.visualiser.ui.Chip
import com.vibrations.visualiser.ui.Glyph
import com.vibrations.visualiser.ui.GlyphButton
import com.vibrations.visualiser.ui.LabeledSlider
import com.vibrations.visualiser.ui.Segmented
import com.vibrations.visualiser.ui.Swatch
import com.vibrations.visualiser.ui.Ui
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.roundToInt

class MainActivity : Activity(), AudioEngine.Listener, VisualRenderer.Events {

    companion object {
        private const val REQ_AUDIO_FILE = 11
        private const val REQ_MIC = 12
        private const val REQ_IMAGE = 13
        private const val HIDE_DELAY = 4000L
    }

    private enum class Sheet { SOURCE, ART, LOOK, FRAME, PRESETS }

    private lateinit var catalog: Catalog
    private lateinit var presets: PresetStore
    private lateinit var artStore: ArtStore
    private var artInfo = ""
    private var artLoaded = false
    private var artBusy = false
    private lateinit var artButton: GlyphButton
    private lateinit var audio: AudioEngine
    private lateinit var renderer: VisualRenderer
    private lateinit var glView: GLSurfaceView
    private val main = Handler(Looper.getMainLooper())

    private var look = Look()
    private var output = Output()
    private var locked = false
    private var recording = false
    private var recordingLoop = false
    private var recordStartMs = 0L
    private var micWasOn = false

    // views
    private lateinit var root: FrameLayout
    private lateinit var controls: LinearLayout
    private lateinit var topBar: LinearLayout
    private lateinit var sceneLabel: TextView
    private lateinit var quickPalettes: HorizontalScrollView
    private lateinit var recButton: GlyphButton
    private lateinit var lockButton: GlyphButton
    private lateinit var sourceButton: GlyphButton
    private lateinit var recInfo: TextView
    private lateinit var trackInfo: TextView
    private lateinit var playButton: GlyphButton
    private lateinit var hud: LinearLayout
    private lateinit var hudText: TextView
    private lateinit var hudSub: TextView
    private lateinit var sheetHost: FrameLayout
    private lateinit var snack: LinearLayout
    private lateinit var flash: View
    private var guide: View? = null
    private var openSheet: Sheet? = null
    private var controlsVisible = false
    private var refreshSheetOnChange: (() -> Unit)? = null

    // ---------------------------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.setDecorFitsSystemWindows(false)

        catalog = Catalog(this)
        presets = PresetStore(this, catalog)
        artStore = ArtStore(this)
        look = presets.loadLook()
        output = presets.loadOutput()
        audio = AudioEngine(this).also { it.listener = this }
        renderer = VisualRenderer(this, catalog, audio, this)
        renderer.look = look
        renderer.output = output

        root = FrameLayout(this).apply { setBackgroundColor(0xFF000000.toInt()) }
        val am = getSystemService(ACTIVITY_SERVICE) as ActivityManager
        if (am.deviceConfigurationInfo.reqGlEsVersion < 0x30000) {
            root.addView(Ui.text(this, "Vibrations needs OpenGL ES 3.0, which this device doesn't support.", 16f).apply {
                gravity = Gravity.CENTER; setPadding(60, 0, 60, 0)
            }, FrameLayout.LayoutParams(-1, -1))
            setContentView(root)
            return
        }
        glView = GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            setEGLConfigChooser(RecordableConfigChooser())
            holder.setFormat(PixelFormat.RGBA_8888)
            preserveEGLContextOnPause = true
            setRenderer(renderer)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
        root.addView(glView, FrameLayout.LayoutParams(-1, -1))
        buildUi()
        setContentView(root)
        installGestures()
        applyInsets()
        refreshUi()
        hideControls(animate = false)
        showHint()
        if (artStore.hasArt) loadArtAsync(null)
        handleIncoming(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIncoming(intent)
    }

    private fun handleIncoming(intent: Intent?) {
        val uri: Uri = when (intent?.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND -> @Suppress("DEPRECATION") (intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri)
            else -> null
        } ?: return
        val type = intent?.type ?: contentResolver.getType(uri) ?: ""
        if (type.startsWith("image/")) loadArtAsync(uri) else audio.loadTrack(uri)
    }

    override fun onResume() {
        super.onResume()
        if (::glView.isInitialized) glView.onResume()
        immersive()
        if (micWasOn) { micWasOn = false; startMicChecked() }
    }

    override fun onPause() {
        if (::glView.isInitialized) {
            if (recording) {
                val latch = CountDownLatch(1)
                glView.queueEvent { renderer.stopRecording(); latch.countDown() }
                latch.await(800, TimeUnit.MILLISECONDS)
            }
            glView.onPause()
        }
        presets.saveSession(look, output)
        super.onPause()
    }

    override fun onStop() {
        super.onStop()
        if (!::glView.isInitialized) return
        audio.pause()
        if (audio.source == AudioEngine.Source.MIC) { micWasOn = true; audio.setAmbient() }
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        if (::audio.isInitialized) audio.release()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) immersive()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            guide != null -> dismissGuide()
            openSheet != null -> closeSheet()
            controlsVisible -> hideControls()
            else -> @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    private fun immersive() {
        window.insetsController?.let {
            it.hide(WindowInsets.Type.systemBars())
            it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun applyInsets() {
        root.setOnApplyWindowInsetsListener { _, insets ->
            val safe = insets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            val pad = dp(16f)
            controls.setPadding(pad + safe.left, 0, pad + safe.right, max(pad, safe.bottom + dp(6f)))
            topBar.setPadding(pad + safe.left, max(pad, safe.top + dp(4f)), pad + safe.right, 0)
            sheetHost.setPadding(safe.left, 0, safe.right, safe.bottom)
            insets
        }
    }

    private fun dp(v: Float) = Ui.dpi(this, v)

    // ---- UI construction ------------------------------------------------------------------

    private fun buildUi() {
        // top: recording timer · track
        topBar = Ui.row(this)
        recInfo = Ui.text(this, "", 12f, Ui.REC, Ui.medium, 0.08f).apply { visibility = View.GONE }
        playButton = GlyphButton(this, Glyph.PAUSE, "Play or pause") { audio.togglePlay(); poke() }.apply { size = 36f }
        trackInfo = Ui.text(this, "", 12.5f, Ui.TEXT_DIM, Ui.regular, 0.02f).apply {
            maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END
        }
        topBar.addView(recInfo, Ui.lp().apply { marginEnd = dp(12f) })
        topBar.addView(playButton)
        topBar.addView(trackInfo, Ui.lp(0, -2, 1f))
        lockButton = GlyphButton(this, Glyph.UNLOCK, "Lock scene") { toggleLock() }.apply { size = 38f }
        topBar.addView(lockButton)
        root.addView(topBar, FrameLayout.LayoutParams(-1, -2, Gravity.TOP))

        // centre HUD for transient feedback
        hud = Ui.column(this).apply { gravity = Gravity.CENTER_HORIZONTAL; alpha = 0f }
        hudText = Ui.text(this, "", 26f, Ui.TEXT, Ui.light, 0.04f).apply { setShadowLayer(18f, 0f, 0f, 0x99000000.toInt()) }
        hudSub = Ui.text(this, "", 11f, Ui.TEXT_DIM, Ui.medium, 0.22f).apply {
            setShadowLayer(12f, 0f, 0f, 0x99000000.toInt()); setPadding(0, dp(8f), 0, 0)
        }
        hud.addView(hudText); hud.addView(hudSub)
        root.addView(hud, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))

        // bottom controls
        controls = Ui.column(this).apply { gravity = Gravity.CENTER_HORIZONTAL }

        quickPalettes = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            visibility = View.GONE
            addView(Ui.row(this@MainActivity))
        }
        rebuildQuickPalettes()
        controls.addView(quickPalettes, Ui.lp().apply { bottomMargin = dp(6f) })

        val sceneRow = Ui.row(this, Gravity.CENTER)
        sceneRow.addView(GlyphButton(this, Glyph.PREV, "Previous scene") { stepScene(-1) })
        sceneLabel = Ui.text(this, "", 19f, Ui.TEXT, Ui.light, 0.06f).apply {
            gravity = Gravity.CENTER; minWidth = dp(150f)
            setShadowLayer(16f, 0f, 0f, 0xAA000000.toInt())
            setOnClickListener { toggleSheet(Sheet.LOOK) }
        }
        sceneRow.addView(sceneLabel)
        sceneRow.addView(GlyphButton(this, Glyph.NEXT, "Next scene") { stepScene(1) })
        controls.addView(sceneRow, Ui.lp().apply { bottomMargin = dp(8f) })

        val bar = Ui.row(this, Gravity.CENTER).apply {
            background = Ui.rounded(Ui.PANEL, Ui.dp(this@MainActivity, 32f), dp(1f), 0x1AFFFFFF)
            setPadding(dp(6f), dp(4f), dp(6f), dp(4f))
        }
        sourceButton = GlyphButton(this, Glyph.AMBIENT, "Audio source") { toggleSheet(Sheet.SOURCE) }
        recButton = GlyphButton(this, Glyph.RECORD, "Record") { onRecordTap() }.apply { size = 58f }
        artButton = GlyphButton(this, Glyph.ART, "Artwork") { toggleSheet(Sheet.ART) }
        bar.addView(sourceButton)
        bar.addView(artButton)
        bar.addView(GlyphButton(this, Glyph.LOOK, "Look") { toggleSheet(Sheet.LOOK) })
        bar.addView(recButton, Ui.lp().apply { marginStart = dp(4f); marginEnd = dp(4f) })
        bar.addView(GlyphButton(this, Glyph.STILL, "Save still") { onStillTap() })
        bar.addView(GlyphButton(this, Glyph.FRAME, "Frame and output") { toggleSheet(Sheet.FRAME) })
        bar.addView(GlyphButton(this, Glyph.PRESETS, "Presets") { toggleSheet(Sheet.PRESETS) })
        controls.addView(bar)
        root.addView(controls, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))

        // sheet
        sheetHost = FrameLayout(this).apply {
            background = Ui.rounded(Ui.PANEL, Ui.dp(this@MainActivity, 22f))
            visibility = View.GONE
            isClickable = true
        }
        root.addView(sheetHost, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))

        // snack
        snack = Ui.row(this).apply {
            background = Ui.rounded(Ui.PANEL, Ui.dp(this@MainActivity, 20f), dp(1f), 0x1AFFFFFF)
            setPadding(dp(16f), dp(4f), dp(6f), dp(4f))
            visibility = View.GONE
            minimumHeight = dp(44f)
        }
        root.addView(snack, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply { topMargin = dp(64f) })

        flash = View(this).apply { setBackgroundColor(0xFFFFFFFF.toInt()); alpha = 0f; isClickable = false }
        root.addView(flash, FrameLayout.LayoutParams(-1, -1))
    }

    // ---- state -----------------------------------------------------------------------------

    private fun update(f: (Look) -> Look) {
        look = f(look)
        renderer.look = look
        refreshUi()
    }

    private fun rebuildQuickPalettes() {
        val r = quickPalettes.getChildAt(0) as LinearLayout
        r.removeAllViews()
        catalog.palettes.forEachIndexed { i, p ->
            r.addView(Swatch(this, p.colors, p.name) { update { it.copy(palette = i) }; poke() })
        }
    }

    private val artActive get() = look.artOn && artLoaded

    private fun setOutput(o: Output) {
        output = o
        renderer.output = o
    }

    private fun refreshUi() {
        sceneLabel.text = if (artActive) catalog.arts[look.artMode].name else catalog.scenes[look.scene].name
        artButton.active = artActive
        lockButton.glyph = if (locked) Glyph.LOCK else Glyph.UNLOCK
        lockButton.active = locked
        sourceButton.glyph = when (audio.source) {
            AudioEngine.Source.TRACK -> Glyph.MUSIC
            AudioEngine.Source.MIC -> Glyph.MIC
            AudioEngine.Source.AMBIENT -> Glyph.AMBIENT
        }
        sourceButton.active = audio.source != AudioEngine.Source.AMBIENT
        val r = quickPalettes.getChildAt(0) as LinearLayout
        for (i in 0 until r.childCount) (r.getChildAt(i) as Swatch).picked = i == look.palette
        quickPalettes.visibility = if (recording) View.VISIBLE else View.GONE
        playButton.visibility = if (audio.source == AudioEngine.Source.TRACK) View.VISIBLE else View.GONE
        playButton.glyph = if (audio.isPlaying) Glyph.PAUSE else Glyph.PLAY
        trackInfo.text = when (audio.source) {
            AudioEngine.Source.TRACK -> audio.trackTitle ?: ""
            AudioEngine.Source.MIC -> "Listening · microphone"
            AudioEngine.Source.AMBIENT -> ""
        }
    }

    private fun stepScene(d: Int) {
        poke()
        if (locked) { showHud("Locked", "double-tap to unlock"); return }
        if (artActive) {
            // with artwork showing, swipes and arrows step through the art modes
            val n = catalog.arts.size
            update { it.copy(artMode = (it.artMode + d + n) % n) }
            showHud(catalog.arts[look.artMode].name, catalog.arts[look.artMode].desc)
        } else {
            val n = catalog.scenes.size
            update { it.copy(scene = (it.scene + d + n) % n) }
            showHud(catalog.scenes[look.scene].name, catalog.scenes[look.scene].kind)
        }
        refreshSheetOnChange?.invoke()
    }

    private fun toggleLock() {
        locked = !locked
        refreshUi()
        showHud(if (locked) "Scene locked" else "Unlocked", if (locked) "swipes and scene changes are ignored" else "")
        poke()
    }

    // ---- controls visibility ------------------------------------------------------------

    private val hideRunnable = Runnable { if (openSheet == null) hideControls() }

    private fun poke() {
        main.removeCallbacks(hideRunnable)
        main.postDelayed(hideRunnable, HIDE_DELAY)
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (controlsVisible && ev.actionMasked == MotionEvent.ACTION_DOWN) poke()
        return super.dispatchTouchEvent(ev)
    }

    private fun showControls() {
        controlsVisible = true
        refreshUi()
        for (v in listOf<View>(controls, topBar)) {
            v.visibility = View.VISIBLE
            v.animate().alpha(1f).translationY(0f).setDuration(220).start()
        }
        startTicker()
        poke()
    }

    private fun hideControls(animate: Boolean = true) {
        controlsVisible = false
        main.removeCallbacks(hideRunnable)
        for ((v, dy) in listOf<Pair<View, Float>>(controls to dp(24f).toFloat(), topBar to -dp(16f).toFloat())) {
            if (animate) v.animate().alpha(0f).translationY(dy).setDuration(260).withEndAction { if (!controlsVisible) v.visibility = View.GONE }.start()
            else { v.alpha = 0f; v.translationY = dy; v.visibility = View.GONE }
        }
        // the recording timer stays readable unless the user asked for a completely clean screen
        if (recording && !output.hideUiWhileRecording) {
            topBar.visibility = View.VISIBLE; topBar.alpha = 1f; topBar.translationY = 0f
        }
    }

    private fun toggleControls() = if (controlsVisible) hideControls() else showControls()

    private val ticker = object : Runnable {
        override fun run() {
            if (recording) {
                val s = (System.currentTimeMillis() - recordStartMs) / 1000
                recInfo.text = if (recordingLoop) "●  LOOP" else String.format(Locale.US, "●  %02d:%02d", s / 60, s % 60)
            }
            if (openSheet == Sheet.SOURCE) sourceProgress?.invoke()
            if (controlsVisible || recording || openSheet != null) main.postDelayed(this, 250)
        }
    }

    private fun startTicker() { main.removeCallbacks(ticker); main.post(ticker) }

    // ---- HUD / snack ---------------------------------------------------------------------

    private val hudHide = Runnable { hud.animate().alpha(0f).setDuration(500).start() }

    private fun showHud(title: String, sub: String = "", hold: Long = 1100) {
        hudText.text = title
        hudSub.text = sub.uppercase()
        hudSub.visibility = if (sub.isEmpty()) View.GONE else View.VISIBLE
        hud.animate().cancel()
        hud.animate().alpha(1f).setDuration(140).start()
        main.removeCallbacks(hudHide)
        main.postDelayed(hudHide, hold)
    }

    private val snackHide = Runnable { snack.animate().alpha(0f).setDuration(300).withEndAction { snack.visibility = View.GONE }.start() }

    private fun showSnack(message: String, shareUri: Uri? = null, mime: String = "") {
        snack.removeAllViews()
        snack.addView(Ui.text(this, message, 13f, Ui.TEXT), Ui.lp().apply { marginEnd = dp(10f) })
        if (shareUri != null) {
            snack.addView(GlyphButton(this, Glyph.SHARE, "Share") {
                val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, shareUri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(Intent.createChooser(send, "Share"))
            }.apply { size = 38f })
        } else snack.setPadding(dp(16f), dp(4f), dp(16f), dp(4f))
        snack.visibility = View.VISIBLE
        snack.alpha = 0f
        snack.animate().alpha(1f).setDuration(200).start()
        main.removeCallbacks(snackHide)
        main.postDelayed(snackHide, if (shareUri != null) 5000 else 3200)
    }

    private fun showHint() {
        if (!presets.seenGestureGuide) main.postDelayed({ showGuide() }, 1400)
        else main.postDelayed({ showHud("", "tap for controls", 1800) }, 900)
    }

    private fun showGuide() {
        if (guide != null) return
        presets.seenGestureGuide = true
        val card = Ui.column(this).apply {
            background = Ui.rounded(Ui.PANEL, Ui.dp(this@MainActivity, 22f), dp(1f), 0x1AFFFFFF)
            setPadding(dp(24f), dp(22f), dp(24f), dp(22f))
        }
        card.addView(Ui.text(this, "Vibrations", 22f, Ui.TEXT, Ui.light, 0.04f))
        card.addView(Ui.text(this, "Load a track or use the mic. Gestures:", 13f, Ui.TEXT_DIM).apply { setPadding(0, dp(6f), 0, dp(10f)) })
        listOf(
            "Tap" to "show / hide controls",
            "Swipe ← →" to "change scene",
            "Swipe ↑ ↓" to "sensitivity",
            "Long press" to "palette, symmetry, trails",
            "Double tap" to "lock the scene",
            "Two-finger hold" to "soften the response",
        ).forEach { (g, d) ->
            val r = Ui.row(this).apply { setPadding(0, dp(5f), 0, dp(5f)) }
            r.addView(Ui.text(this, g, 13.5f, Ui.TEXT, Ui.medium), Ui.lp(dp(128f)))
            r.addView(Ui.text(this, d, 13.5f, Ui.TEXT_DIM))
            card.addView(r)
        }
        card.addView(Ui.text(this, "TAP ANYWHERE TO START", 10.5f, Ui.TEXT_DIM, Ui.medium, 0.2f).apply { setPadding(0, dp(16f), 0, 0) })
        val scrim = FrameLayout(this).apply {
            setBackgroundColor(0x66000000)
            setOnClickListener { dismissGuide() }
            addView(card, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
            alpha = 0f
        }
        root.addView(scrim, FrameLayout.LayoutParams(-1, -1))
        scrim.animate().alpha(1f).setDuration(400).start()
        guide = scrim
    }

    private fun dismissGuide() {
        val g = guide ?: return
        guide = null
        g.animate().alpha(0f).setDuration(250).withEndAction { root.removeView(g) }.start()
    }

    // ---- gestures --------------------------------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private fun installGestures() {
        val slop = ViewConfiguration.get(this).scaledTouchSlop * 1.5f
        var downX = 0f; var downY = 0f; var lastY = 0f
        var axis = 0 // 0 undecided, 1 horizontal, 2 vertical
        var multi = false
        val detector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                if (openSheet != null) closeSheet() else toggleControls()
                return true
            }
            override fun onDoubleTap(e: MotionEvent): Boolean { toggleLock(); return true }
            override fun onLongPress(e: MotionEvent) {
                if (multi || axis != 0) return
                if (locked) { showHud("Locked", "double-tap to unlock"); return }
                glView.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                openSheetNow(Sheet.LOOK)
            }
        })
        glView.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { downX = e.x; downY = e.y; lastY = e.y; axis = 0; multi = false }
                MotionEvent.ACTION_POINTER_DOWN -> {
                    if (!multi) {
                        multi = true
                        val cancel = MotionEvent.obtain(e).apply { action = MotionEvent.ACTION_CANCEL }
                        detector.onTouchEvent(cancel); cancel.recycle()
                    }
                    renderer.softHeld = true
                    showHud("Softened", "release to restore", 100000)
                }
                MotionEvent.ACTION_POINTER_UP -> if (e.pointerCount <= 2 && renderer.softHeld) {
                    renderer.softHeld = false
                    showHud("Softened", "released", 300)
                }
                MotionEvent.ACTION_MOVE -> if (!multi) {
                    val dx = e.x - downX; val dy = e.y - downY
                    if (axis == 0 && (abs(dx) > slop || abs(dy) > slop)) axis = if (abs(dx) > abs(dy)) 1 else 2
                    if (axis == 2) {
                        if (locked) showHud("Locked", "double-tap to unlock")
                        else {
                            val s = (look.sensitivity * exp(-(e.y - lastY) / root.height * 2.6f)).coerceIn(0.2f, 3f)
                            update { it.copy(sensitivity = s) }
                            showHud(String.format(Locale.US, "%.1f×", s), "sensitivity", 900)
                        }
                    }
                    lastY = e.y
                }
                MotionEvent.ACTION_UP -> {
                    if (!multi && axis == 1 && abs(e.x - downX) > dp(64f)) stepScene(if (e.x < downX) 1 else -1)
                    if (renderer.softHeld) { renderer.softHeld = false; showHud("Softened", "released", 300) }
                    if (axis == 2) refreshSheetOnChange?.invoke()
                }
                MotionEvent.ACTION_CANCEL -> renderer.softHeld = false
            }
            if (!multi && axis == 0) detector.onTouchEvent(e)
            else if (!multi && e.actionMasked == MotionEvent.ACTION_UP) detector.onTouchEvent(MotionEvent.obtain(e).apply { action = MotionEvent.ACTION_CANCEL })
            true
        }
    }

    // ---- recording / stills ------------------------------------------------------------

    private fun onRecordTap() {
        poke()
        if (recording) { glView.queueEvent { renderer.stopRecording() }; return }
        val target = try {
            MediaSaver.createVideo(this, MediaSaver.stamp(if (output.loopMode) "Vibrations_loop" else "Vibrations"))
        } catch (e: Exception) {
            showSnack("Can't save video: ${e.message}"); return
        }
        recButton.isEnabled = false
        glView.queueEvent { renderer.startRecording(target) }
    }

    private fun onStillTap() {
        poke()
        flash.alpha = 0.22f
        flash.animate().alpha(0f).setDuration(380).start()
        glView.queueEvent { renderer.requestStill() }
    }

    override fun onRecordingStarted(loop: Boolean) = runOnUiThread {
        recording = true
        recordingLoop = loop
        recordStartMs = System.currentTimeMillis()
        recButton.isEnabled = true
        recButton.glyph = Glyph.STOP
        recButton.recordProgress = if (loop) 0f else -1f
        recInfo.visibility = View.VISIBLE
        refreshUi()
        rebuildOpenSheet()
        startTicker()
        if (loop) showHud("Loop", "easing in · ${output.loopSeconds}s", 1400) else showHud("Recording", "", 700)
        if (output.hideUiWhileRecording) { closeSheet(); hideControls() }
    }

    override fun onLoopProgress(fraction: Float) {
        val p = (fraction * 100).roundToInt() / 100f
        main.post { if (recording && recButton.recordProgress != p) recButton.recordProgress = p }
    }

    override fun onRecordingFinished(uri: Uri?, error: String?) = runOnUiThread {
        recording = false
        recordingLoop = false
        recButton.isEnabled = true
        recButton.glyph = Glyph.RECORD
        recButton.recordProgress = -1f
        recInfo.visibility = View.GONE
        refreshUi()
        rebuildOpenSheet()
        when {
            uri != null -> showSnack(error ?: "Clip saved · Movies/Vibrations", uri, "video/mp4")
            error != null -> showSnack(error)
        }
    }

    override fun onStillSaved(uri: Uri?, error: String?) = runOnUiThread {
        if (uri != null) showSnack("Still saved · Pictures/Vibrations", uri, "image/png") else showSnack(error ?: "Couldn't save still")
    }

    override fun onRendererError(message: String) = runOnUiThread { showSnack(message) }

    override fun onArtInfo(srcW: Int, srcH: Int, outW: Int, outH: Int, enhanced: Boolean) = runOnUiThread {
        artInfo = if (outW > srcW) "$srcW × $srcH → $outW × $outH" + (if (enhanced) " · enhanced" else " · plain")
        else "$srcW × $srcH · shown at $outW × $outH"
        if (openSheet == Sheet.ART) rebuildOpenSheet()
    }

    // ---- artwork -----------------------------------------------------------------------------

    private fun pickImage() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
        @Suppress("DEPRECATION") startActivityForResult(i, REQ_IMAGE)
    }

    /** Imports [uri] (or reloads the saved artwork when null) off the main thread. */
    private fun loadArtAsync(uri: Uri?) {
        if (artBusy) return
        artBusy = true
        if (uri != null) showHud("Loading artwork", "", 4000)
        Thread {
            val result = runCatching { if (uri != null) artStore.import(uri) else artStore.load() }
            runOnUiThread {
                artBusy = false
                val loaded = result.getOrNull()
                if (loaded == null) {
                    if (uri != null) showSnack("Couldn't open that image" + (result.exceptionOrNull()?.message?.let { ": $it" } ?: ""))
                    return@runOnUiThread
                }
                catalog.setArtPalette(loaded.palette)
                rebuildQuickPalettes()
                renderer.setArt(loaded.bitmap)
                artLoaded = true
                if (uri != null) {
                    update { it.copy(artOn = true, palette = catalog.artPaletteIndex) }
                    showHud(catalog.arts[look.artMode].name, "swipe to change art mode", 1600)
                } else {
                    if (presets.sessionPaletteName() == "Art") update { it.copy(palette = catalog.artPaletteIndex) }
                    refreshUi()
                }
                if (openSheet == Sheet.ART) rebuildOpenSheet()
            }
        }.start()
    }

    private fun removeArt() {
        artStore.clear()
        renderer.setArt(null)
        artLoaded = false
        artInfo = ""
        val usedArtPalette = look.palette == catalog.artPaletteIndex
        catalog.setArtPalette(null)
        rebuildQuickPalettes()
        update { it.copy(artOn = false, palette = if (usedArtPalette) 0 else it.palette.coerceIn(0, catalog.palettes.size - 1)) }
        rebuildOpenSheet()
    }

    // ---- audio ----------------------------------------------------------------------------

    override fun onSourceChanged(source: AudioEngine.Source, title: String?) {
        runOnUiThread {
            refreshUi()
            if (openSheet == Sheet.SOURCE) rebuildOpenSheet()
            when (source) {
                AudioEngine.Source.TRACK -> showHud(title ?: "Track", "now playing", 1600)
                AudioEngine.Source.MIC -> showHud("Microphone", "listening", 1200)
                AudioEngine.Source.AMBIENT -> {}
            }
        }
    }

    override fun onPlayStateChanged(playing: Boolean) = runOnUiThread {
        refreshUi()
        if (openSheet == Sheet.SOURCE) rebuildOpenSheet()
    }

    override fun onAudioError(message: String) = runOnUiThread { showSnack(message) }

    private fun pickTrack() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("audio/*")
        @Suppress("DEPRECATION") startActivityForResult(i, REQ_AUDIO_FILE)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_AUDIO_FILE && resultCode == RESULT_OK) data?.data?.let { audio.loadTrack(it) }
        if (requestCode == REQ_IMAGE && resultCode == RESULT_OK) data?.data?.let { loadArtAsync(it) }
    }

    private fun startMicChecked() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) audio.startMic()
        else requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_MIC) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) audio.startMic()
            else showSnack("Microphone permission is needed to listen")
        }
    }

    // ---- sheets -----------------------------------------------------------------------------

    private var sourceProgress: (() -> Unit)? = null

    private fun toggleSheet(s: Sheet) { if (openSheet == s) closeSheet() else openSheetNow(s) }

    private fun openSheetNow(s: Sheet) {
        val wasOpen = openSheet != null
        openSheet = s
        main.removeCallbacks(hideRunnable)
        rebuildOpenSheet()
        if (controlsVisible) {
            controls.animate().alpha(0f).setDuration(150).withEndAction { if (openSheet != null) controls.visibility = View.GONE }.start()
        }
        if (!wasOpen) {
            sheetHost.visibility = View.VISIBLE
            sheetHost.translationY = dp(60f).toFloat(); sheetHost.alpha = 0f
            sheetHost.animate().translationY(0f).alpha(1f).setDuration(240).start()
        }
        startTicker()
    }

    private fun closeSheet() {
        if (openSheet == null) return
        openSheet = null
        refreshSheetOnChange = null
        sourceProgress = null
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(root.windowToken, 0)
        sheetHost.animate().translationY(dp(60f).toFloat()).alpha(0f).setDuration(200).withEndAction {
            if (openSheet == null) { sheetHost.visibility = View.GONE; sheetHost.removeAllViews() }
        }.start()
        immersive()
        if (controlsVisible) showControls()
    }

    private fun rebuildOpenSheet() {
        val s = openSheet ?: return
        val scroll = ScrollView(this).apply { isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER }
        val prevScroll = (sheetHost.getChildAt(0) as? ScrollView)?.scrollY ?: 0
        val col = Ui.column(this).apply { setPadding(dp(20f), dp(10f), dp(20f), dp(18f)) }
        val head = Ui.row(this)
        val title = when (s) { Sheet.SOURCE -> "Sound"; Sheet.ART -> "Artwork"; Sheet.LOOK -> "Look"; Sheet.FRAME -> "Frame & output"; Sheet.PRESETS -> "Presets" }
        head.addView(Ui.text(this, title, 20f, Ui.TEXT, Ui.light, 0.03f), Ui.lp(0, -2, 1f))
        head.addView(GlyphButton(this, Glyph.CLOSE, "Close") { closeSheet() })
        col.addView(head)
        refreshSheetOnChange = null
        sourceProgress = null
        when (s) {
            Sheet.SOURCE -> buildSourceSheet(col)
            Sheet.LOOK -> buildLookSheet(col)
            Sheet.FRAME -> buildFrameSheet(col)
            Sheet.PRESETS -> buildPresetSheet(col)
            Sheet.ART -> buildArtSheet(col)
        }
        scroll.addView(col)
        sheetHost.removeAllViews()
        sheetHost.addView(scroll, FrameLayout.LayoutParams(-1, -2))
        val maxH = (root.height * 0.62f).toInt().coerceAtLeast(dp(320f))
        scroll.layoutParams = FrameLayout.LayoutParams(-1, -2)
        scroll.post {
            if (scroll.height > maxH) scroll.layoutParams = FrameLayout.LayoutParams(-1, maxH)
            scroll.scrollTo(0, prevScroll)
        }
    }

    private fun hScroll(child: View) = HorizontalScrollView(this).apply {
        isHorizontalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER; addView(child)
    }

    private fun buildSourceSheet(col: LinearLayout) {
        col.addView(Ui.caption(this, "Input"))
        val sel = when (audio.source) { AudioEngine.Source.TRACK -> 0; AudioEngine.Source.MIC -> 1; AudioEngine.Source.AMBIENT -> 2 }
        col.addView(Segmented(this, listOf("Open track…", "Microphone", "Ambient"), sel) { i ->
            when (i) {
                0 -> pickTrack()
                1 -> startMicChecked()
                2 -> audio.setAmbient()
            }
        })
        if (audio.source == AudioEngine.Source.TRACK) {
            col.addView(Ui.caption(this, "Now playing"))
            col.addView(Ui.text(this, audio.trackTitle ?: "Track", 15f, Ui.TEXT).apply { maxLines = 2 })
            val r = Ui.row(this).apply { setPadding(0, dp(6f), 0, 0) }
            val play = GlyphButton(this, if (audio.isPlaying) Glyph.PAUSE else Glyph.PLAY, "Play or pause") { audio.togglePlay() }
            val time = Ui.text(this, "", 12f, Ui.TEXT_DIM)
            var dragging = false
            val seek = com.vibrations.visualiser.ui.Slider(this, 0f, 1f, 0f) { f ->
                dragging = true
                main.removeCallbacksAndMessages("seek")
                main.postAtTime({
                    audio.seekTo((f * audio.durationUs).toLong()); dragging = false
                }, "seek", android.os.SystemClock.uptimeMillis() + 180)
            }
            r.addView(play)
            r.addView(seek, Ui.lp(0, -2, 1f))
            r.addView(time, Ui.lp().apply { marginStart = dp(4f) })
            col.addView(r)
            sourceProgress = {
                val d = audio.durationUs
                val p = audio.positionUs.coerceAtMost(if (d > 0) d else Long.MAX_VALUE)
                if (!dragging && d > 0) seek.set(p.toFloat() / d)
                time.text = String.format(Locale.US, "%d:%02d / %d:%02d", p / 60_000_000, (p / 1_000_000) % 60, d / 60_000_000, (d / 1_000_000) % 60)
            }
            sourceProgress?.invoke()
            val rep = Chip(this, "Repeat track") {}
            rep.setChecked(audio.repeat)
            rep.setOnClickListener { audio.repeat = !audio.repeat; rep.setChecked(audio.repeat) }
            col.addView(rep, Ui.lp().apply { topMargin = dp(10f) })
        } else if (audio.source == AudioEngine.Source.AMBIENT) {
            col.addView(Ui.text(this, "No input — the field drifts on its own. Open a track or use the microphone to make it react.", 13f, Ui.TEXT_DIM).apply {
                setPadding(0, dp(14f), 0, 0); setLineSpacing(0f, 1.25f)
            })
        } else {
            col.addView(Ui.text(this, "Listening to the room. Swipe up or down on the picture to change sensitivity.", 13f, Ui.TEXT_DIM).apply {
                setPadding(0, dp(14f), 0, 0); setLineSpacing(0f, 1.25f)
            })
        }
    }

    private fun buildArtSheet(col: LinearLayout) {
        val actions = Ui.row(this)
        actions.addView(Chip(this, if (artLoaded) "Replace image…" else "Add your image…") { pickImage() }, Ui.lp().apply { marginEnd = dp(8f) })
        if (artLoaded) {
            val show = Chip(this, "Show artwork") {}
            show.setChecked(look.artOn)
            show.setOnClickListener {
                update { it.copy(artOn = !it.artOn) }
                show.setChecked(look.artOn)
                showHud(if (look.artOn) catalog.arts[look.artMode].name else catalog.scenes[look.scene].name)
            }
            actions.addView(show, Ui.lp().apply { marginEnd = dp(8f) })
            actions.addView(GlyphButton(this, Glyph.TRASH, "Remove artwork") { removeArt() }.apply { size = 40f })
        }
        col.addView(hScroll(actions))
        if (!artLoaded) {
            col.addView(Ui.text(this, "Bring in a cover, photo, drawing or logo. It's enlarged and cleaned up for the output size, then played by the music: redraw it in neon, melt it, print it, scatter it. Transparent PNG logos outline cleanly.", 13f, Ui.TEXT_DIM).apply {
                setPadding(dp(2f), dp(14f), 0, 0); setLineSpacing(0f, 1.25f)
            })
            return
        }
        if (artInfo.isNotEmpty()) col.addView(Ui.text(this, artInfo, 12f, Ui.TEXT_DIM).apply { setPadding(dp(2f), dp(10f), 0, 0) })

        val cap = Ui.caption(this, "Mode · ${catalog.arts[look.artMode].desc}")
        col.addView(cap)
        val modeRow = Ui.row(this)
        catalog.arts.forEachIndexed { i, m ->
            val c = Chip(this, m.name) {
                update { it.copy(artMode = i, artOn = true) }
                rebuildOpenSheet()
            }
            c.setChecked(i == look.artMode)
            modeRow.addView(c, Ui.lp().apply { marginEnd = dp(8f) })
        }
        col.addView(hScroll(modeRow))

        col.addView(Ui.caption(this, "Up-res"))
        val up = Ui.row(this)
        up.addView(Segmented(this, listOf("Plain", "Enhanced"), if (look.artEnhance) 1 else 0) { i -> update { it.copy(artEnhance = i == 1) } })
        col.addView(up)
        val save = Ui.row(this).apply { setPadding(0, dp(8f), 0, 0) }
        save.addView(Ui.text(this, "Save image", 13f, Ui.TEXT_DIM), Ui.lp().apply { marginEnd = dp(10f) })
        for (f in listOf(2, 4)) save.addView(Chip(this, "${f}× PNG") {
            showHud("Up-res ${f}×", "saving", 900)
            glView.queueEvent { renderer.requestUpres(f) }
        }, Ui.lp().apply { marginEnd = dp(8f) })
        col.addView(save)

        if (catalog.arts[look.artMode].id == "neon") {
            col.addView(Ui.caption(this, "Neon"))
            col.addView(LabeledSlider(this, "Line weight", 0f, 1f, look.artLine, { pct(it) }) { v -> update { it.copy(artLine = v) } })
            col.addView(LabeledSlider(this, "Detail", 0f, 1f, look.artDetail, { pct(it) }) { v -> update { it.copy(artDetail = v) } })
            col.addView(LabeledSlider(this, "Picture under lines", 0f, 1f, look.artFill, { pct(it) }) { v -> update { it.copy(artFill = v) } })
        }

        col.addView(Ui.caption(this, "Picture"))
        col.addView(LabeledSlider(this, "Effect amount", 0f, 1f, look.artAmount, { pct(it) }) { v -> update { it.copy(artAmount = v) } })
        col.addView(LabeledSlider(this, "Fit (crop ↔ whole)", 0f, 1f, look.artFit, { pct(it) }) { v -> update { it.copy(artFit = v) } })
        col.addView(LabeledSlider(this, "Palette colours", 0f, 1f, look.artTint, { pct(it) }) { v -> update { it.copy(artTint = v) } })
        col.addView(LabeledSlider(this, "Scene behind", 0f, 1f, look.artBehind, { pct(it) }) { v -> update { it.copy(artBehind = v) } })
        col.addView(Ui.text(this, "\"Scene behind\" shows ${catalog.scenes[look.scene].name} through transparent or dark parts of the art. The Art palette is taken from your image; pick it in Look. Swipe left/right to change art mode.", 12f, Ui.TEXT_DIM).apply {
            setPadding(dp(2f), dp(10f), 0, 0); setLineSpacing(0f, 1.25f)
        })
    }

    private fun buildLookSheet(col: LinearLayout) {
        col.addView(Ui.caption(this, if (locked) "Scene · locked" else "Scene"))
        val sceneRow = Ui.row(this)
        val sceneChips = ArrayList<Chip>()
        catalog.scenes.forEachIndexed { i, sc ->
            val c = Chip(this, sc.name) {
                if (locked) { showHud("Locked", "double-tap to unlock"); return@Chip }
                update { it.copy(scene = i) }
                sceneChips.forEachIndexed { j, cc -> cc.setChecked(j == i) }
            }
            c.setChecked(i == look.scene)
            if (locked) c.alpha = 0.5f
            sceneChips.add(c)
            sceneRow.addView(c, Ui.lp().apply { marginEnd = dp(8f) })
        }
        col.addView(hScroll(sceneRow))

        val palCaption = Ui.caption(this, "Palette · ${catalog.palettes[look.palette].name}")
        col.addView(palCaption)
        val palRow = Ui.row(this)
        val sw = ArrayList<Swatch>()
        catalog.palettes.forEachIndexed { i, p ->
            val s = Swatch(this, p.colors, p.name) {
                update { it.copy(palette = i) }
                sw.forEachIndexed { j, x -> x.picked = j == i }
                palCaption.text = "PALETTE · ${p.name.uppercase()}"
            }
            s.picked = i == look.palette
            sw.add(s)
            palRow.addView(s, Ui.lp().apply { marginEnd = dp(4f) })
        }
        col.addView(hScroll(palRow))

        col.addView(Ui.caption(this, "Symmetry"))
        col.addView(hScroll(Segmented(this, Symmetry.entries.map { it.label }, look.symmetry.ordinal) { i ->
            update { it.copy(symmetry = Symmetry.entries[i]) }
        }))

        col.addView(Ui.caption(this, "Response"))
        val sens = LabeledSlider(this, "Sensitivity", 0.2f, 3f, look.sensitivity, { String.format(Locale.US, "%.1f×", it) }) { v -> update { it.copy(sensitivity = v) } }
        col.addView(sens)
        refreshSheetOnChange = { sens.set(look.sensitivity); sceneChips.forEachIndexed { j, c -> c.setChecked(j == look.scene) } }
        val soft = Chip(this, "Soft response") {}
        soft.setChecked(look.soft)
        soft.setOnClickListener { update { it.copy(soft = !it.soft) }; soft.setChecked(look.soft) }
        val softRow = Ui.row(this).apply { setPadding(dp(4f), dp(6f), 0, dp(4f)) }
        softRow.addView(soft)
        softRow.addView(Ui.text(this, "or hold two fingers", 12f, Ui.TEXT_DIM).apply { setPadding(dp(12f), 0, 0, 0) })
        col.addView(softRow)

        col.addView(Ui.caption(this, "Atmosphere"))
        col.addView(LabeledSlider(this, "Motion", 0.25f, 2f, look.motion, { String.format(Locale.US, "%.2f×", it) }) { v -> update { it.copy(motion = v) } })
        col.addView(LabeledSlider(this, "Trails", 0f, 1f, look.trails, { pct(it) }) { v -> update { it.copy(trails = v) } })
        col.addView(LabeledSlider(this, "Glow", 0f, 1.5f, look.glow, { pct(it / 1.5f) }) { v -> update { it.copy(glow = v) } })
        col.addView(LabeledSlider(this, "Grain", 0f, 1f, look.grain, { pct(it) }) { v -> update { it.copy(grain = v) } })
    }

    private fun pct(v: Float) = "${(v * 100).roundToInt()}%"

    private fun editField(hint: String, value: String, onChange: (String) -> Unit) = EditText(this).apply {
        setText(value)
        this.hint = hint
        setHintTextColor(0x66FFFFFF)
        setTextColor(Ui.TEXT)
        textSize = 15f
        isSingleLine = true
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        imeOptions = EditorInfo.IME_ACTION_DONE
        background = Ui.rounded(0x12FFFFFF, Ui.dp(this@MainActivity, 12f), dp(1f), Ui.LINE)
        setPadding(dp(14f), dp(10f), dp(14f), dp(10f))
        addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) = onChange(s?.toString() ?: "")
        })
        setOnEditorActionListener { v, _, _ ->
            (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(v.windowToken, 0)
            v.clearFocus(); immersive(); true
        }
    }

    private fun buildFrameSheet(col: LinearLayout) {
        col.addView(Ui.caption(this, if (recording) "Aspect · fixed while recording" else "Aspect"))
        val aspect = Segmented(this, Aspect.entries.map { it.label }, output.aspect.ordinal) { i ->
            setOutput(output.copy(aspect = Aspect.entries[i]))
        }
        aspect.setEnabledAll(!recording)
        col.addView(hScroll(aspect))

        col.addView(Ui.caption(this, "Loop clip"))
        val loops = listOf(0, 4, 6, 8, 12)
        val loop = Segmented(this, loops.map { if (it == 0) "Off" else "${it}s" }, loops.indexOf(output.loopSeconds).coerceAtLeast(0)) { i ->
            setOutput(output.copy(loopSeconds = loops[i]))
        }
        loop.setEnabledAll(!recording)
        col.addView(hScroll(loop))
        col.addView(Ui.text(this, "Loop mode makes all motion repeat exactly. Recording then captures one seamless cycle (video only), easing the audio response in and out so the ends join — ready for GIF conversion.", 12f, Ui.TEXT_DIM).apply {
            setPadding(dp(2f), dp(10f), 0, 0); setLineSpacing(0f, 1.25f)
        })

        col.addView(Ui.caption(this, "Text overlay"))
        val textToggle = Chip(this, "Show text") {}
        textToggle.setChecked(look.textOn)
        textToggle.setOnClickListener { update { it.copy(textOn = !it.textOn) }; textToggle.setChecked(look.textOn) }
        col.addView(textToggle, Ui.lp())
        col.addView(editField("Title", look.title) { s -> update { it.copy(title = s) } }, Ui.lp(-1).apply { topMargin = dp(10f) })
        col.addView(editField("Single line", look.subtitle) { s -> update { it.copy(subtitle = s) } }, Ui.lp(-1).apply { topMargin = dp(8f) })
        col.addView(Segmented(this, TextPlacement.entries.map { it.label }, look.textPlacement.ordinal) { i ->
            update { it.copy(textPlacement = TextPlacement.entries[i]) }
        }, Ui.lp().apply { topMargin = dp(10f) })

        col.addView(Ui.caption(this, "Recording"))
        val fps = Segmented(this, listOf("30 fps", "60 fps"), if (output.fps == 60) 1 else 0) { i -> setOutput(output.copy(fps = if (i == 1) 60 else 30)) }
        fps.setEnabledAll(!recording)
        col.addView(fps)
        val q = Segmented(this, listOf("720p", "1080p"), if (output.hd) 1 else 0) { i -> setOutput(output.copy(hd = i == 1)) }
        q.setEnabledAll(!recording)
        col.addView(q, Ui.lp().apply { topMargin = dp(8f) })
        val hide = Chip(this, "Hide all controls while recording") {}
        hide.setChecked(output.hideUiWhileRecording)
        hide.setOnClickListener { setOutput(output.copy(hideUiWhileRecording = !output.hideUiWhileRecording)); hide.setChecked(output.hideUiWhileRecording) }
        col.addView(hide, Ui.lp().apply { topMargin = dp(8f) })
        col.addView(Ui.text(this, "Clips save to Movies/Vibrations, stills to Pictures/Vibrations. The picture is recorded clean — controls never appear in exports.", 12f, Ui.TEXT_DIM).apply {
            setPadding(dp(2f), dp(10f), 0, 0); setLineSpacing(0f, 1.25f)
        })
        col.addView(Ui.text(this, "Gesture guide", 13f, Ui.TEXT).apply {
            setPadding(dp(2f), dp(16f), 0, dp(4f))
            setOnClickListener { closeSheet(); showGuide() }
        })
    }

    private fun buildPresetSheet(col: LinearLayout) {
        col.addView(Ui.caption(this, "Save current look"))
        val r = Ui.row(this)
        var name = ""
        val field = editField("Name", "") { name = it }
        r.addView(field, Ui.lp(0, -2, 1f))
        r.addView(Chip(this, "Save") {
            val n = name.trim().ifEmpty { "${catalog.scenes[look.scene].name} · ${catalog.palettes[look.palette].name}" }
            presets.save(n, look, output.aspect)
            (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(field.windowToken, 0)
            showHud(n, "saved")
            rebuildOpenSheet()
        }, Ui.lp().apply { marginStart = dp(8f) })
        col.addView(r)

        val mine = presets.userPresets()
        col.addView(Ui.caption(this, "Your looks"))
        if (mine.isEmpty()) col.addView(Ui.text(this, "Nothing saved yet.", 13f, Ui.TEXT_DIM))
        mine.forEach { p ->
            val row = Ui.row(this).apply { minimumHeight = dp(44f) }
            row.addView(Ui.text(this, p.name, 15f, Ui.TEXT).apply {
                setOnClickListener { applyPreset(p) }
                setPadding(dp(4f), dp(10f), 0, dp(10f))
            }, Ui.lp(0, -2, 1f))
            row.addView(Ui.text(this, "${catalog.scenes[p.look.scene].name} · ${catalog.palettes[p.look.palette].name}", 12f, Ui.TEXT_DIM))
            row.addView(GlyphButton(this, Glyph.TRASH, "Delete ${p.name}") { presets.delete(p.name); rebuildOpenSheet() }.apply { size = 40f })
            col.addView(row)
        }

        col.addView(Ui.caption(this, "Starting points"))
        val sr = Ui.row(this)
        presets.starters.forEach { p -> sr.addView(Chip(this, p.name) { applyPreset(p) }, Ui.lp().apply { marginEnd = dp(8f) }) }
        col.addView(hScroll(sr))
    }

    private fun applyPreset(p: Preset) {
        if (locked && p.look.scene != look.scene) { showHud("Locked", "double-tap to unlock"); return }
        update { cur -> if (p.builtIn && !p.look.textOn) p.look.copy(title = cur.title, subtitle = cur.subtitle, textPlacement = cur.textPlacement) else p.look }
        if (p.aspect != null && !recording) setOutput(output.copy(aspect = p.aspect))
        showHud(p.name, "${catalog.scenes[look.scene].name} · ${catalog.palettes[look.palette].name}")
    }
}
