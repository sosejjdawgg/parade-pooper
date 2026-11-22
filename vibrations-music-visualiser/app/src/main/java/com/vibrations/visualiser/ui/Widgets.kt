package com.vibrations.visualiser.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.min

object Ui {
    const val TEXT = 0xFFE9EAF0.toInt()
    const val TEXT_DIM = 0xFF8C8F9C.toInt()
    const val PANEL = 0xE60B0C11.toInt()
    const val LINE = 0x26FFFFFF
    const val ACCENT = 0xFFFFFFFF.toInt()
    const val REC = 0xFFFF4D5E.toInt()

    val light: Typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
    val regular: Typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    val medium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)

    fun dp(ctx: Context, v: Float): Float = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.resources.displayMetrics)
    fun dpi(ctx: Context, v: Float): Int = dp(ctx, v).toInt()

    fun rounded(color: Int, radius: Float, stroke: Int = 0, strokeColor: Int = 0) = GradientDrawable().apply {
        setColor(color); cornerRadius = radius
        if (stroke > 0) setStroke(stroke, strokeColor)
    }

    fun text(ctx: Context, s: String, sizeSp: Float, color: Int = TEXT, face: Typeface = regular, spacing: Float = 0f) =
        TextView(ctx).apply {
            text = s; setTextColor(color); textSize = sizeSp; typeface = face; letterSpacing = spacing
            includeFontPadding = false
        }

    /** Small spaced caps label used for section headings. */
    fun caption(ctx: Context, s: String) = text(ctx, s.uppercase(), 10.5f, TEXT_DIM, medium, 0.18f).apply {
        setPadding(0, dpi(ctx, 14f), 0, dpi(ctx, 8f))
    }

    fun row(ctx: Context, gravity: Int = Gravity.CENTER_VERTICAL) = LinearLayout(ctx).apply {
        orientation = LinearLayout.HORIZONTAL; this.gravity = gravity
    }

    fun column(ctx: Context) = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }

    fun lp(w: Int = ViewGroup.LayoutParams.WRAP_CONTENT, h: Int = ViewGroup.LayoutParams.WRAP_CONTENT, weight: Float = 0f) =
        LinearLayout.LayoutParams(w, h, weight)
}

/** Text pill that can be selected; used for segmented choices. */
@SuppressLint("ViewConstructor")
class Chip(ctx: Context, label: String, private val onTap: () -> Unit) : TextView(ctx) {
    init {
        text = label
        textSize = 13f
        typeface = Ui.regular
        letterSpacing = 0.02f
        gravity = Gravity.CENTER
        val h = Ui.dpi(ctx, 14f); val v = Ui.dpi(ctx, 8f)
        setPadding(h, v, h, v)
        minWidth = Ui.dpi(ctx, 44f)
        setOnClickListener { onTap() }
        setChecked(false)
    }

    var checked = false; private set

    fun setChecked(c: Boolean) {
        checked = c
        val r = Ui.dp(context, 18f)
        background = if (c) Ui.rounded(0x33FFFFFF, r, Ui.dpi(context, 1f), 0xCCFFFFFF.toInt())
        else Ui.rounded(0x0FFFFFFF, r, Ui.dpi(context, 1f), Ui.LINE)
        setTextColor(if (c) Ui.TEXT else Ui.TEXT_DIM)
    }
}

/** A row of mutually exclusive chips. */
class Segmented(ctx: Context, labels: List<String>, selected: Int, private val onSelect: (Int) -> Unit) : LinearLayout(ctx) {
    private val chips = labels.mapIndexed { i, s -> Chip(ctx, s) { select(i, true) } }
    init {
        orientation = HORIZONTAL
        chips.forEach { addView(it, Ui.lp().apply { marginEnd = Ui.dpi(ctx, 8f) }) }
        select(selected, false)
    }
    fun select(i: Int, notify: Boolean) {
        chips.forEachIndexed { j, c -> c.setChecked(i == j) }
        if (notify) onSelect(i)
    }
    fun setEnabledAll(e: Boolean) { chips.forEach { it.isEnabled = e; it.alpha = if (e) 1f else 0.35f } }
}

/** Thin, quiet slider. */
class Slider(
    ctx: Context,
    private val min: Float,
    private val max: Float,
    value: Float,
    private val onChange: (Float) -> Unit,
) : View(ctx) {
    var value = value.coerceIn(min, max); private set
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33FFFFFF; strokeWidth = Ui.dp(ctx, 2f); strokeCap = Paint.Cap.ROUND }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xDDFFFFFF.toInt(); strokeWidth = Ui.dp(ctx, 2f); strokeCap = Paint.Cap.ROUND }
    private val knob = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val pad = Ui.dp(ctx, 10f)

    fun set(v: Float) { value = v.coerceIn(min, max); invalidate() }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), Ui.dpi(context, 32f))
    }

    override fun onDraw(c: Canvas) {
        val y = height / 2f
        val x0 = pad; val x1 = width - pad
        val f = (value - min) / (max - min)
        val x = x0 + (x1 - x0) * f
        c.drawLine(x0, y, x1, y, track)
        c.drawLine(x0, y, x, y, fill)
        c.drawCircle(x, y, Ui.dp(context, 7f), knob)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> parent?.requestDisallowInterceptTouchEvent(true)
            MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP -> {}
            else -> return true
        }
        val f = ((e.x - pad) / (width - 2 * pad)).coerceIn(0f, 1f)
        value = min + (max - min) * f
        invalidate()
        onChange(value)
        return true
    }
}

/** Labelled slider with a live value readout. */
class LabeledSlider(
    ctx: Context, label: String, min: Float, max: Float, value: Float,
    private val format: (Float) -> String, onChange: (Float) -> Unit,
) : LinearLayout(ctx) {
    private val valueText = Ui.text(ctx, format(value), 12f, Ui.TEXT_DIM)
    val slider: Slider = Slider(ctx, min, max, value) { v -> valueText.text = format(v); onChange(v) }
    init {
        orientation = VERTICAL
        val head = Ui.row(ctx)
        head.addView(Ui.text(ctx, label, 13f, Ui.TEXT), Ui.lp(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        head.addView(valueText)
        head.setPadding(Ui.dpi(ctx, 10f), Ui.dpi(ctx, 6f), Ui.dpi(ctx, 10f), 0)
        addView(head, Ui.lp(ViewGroup.LayoutParams.MATCH_PARENT))
        addView(slider, Ui.lp(ViewGroup.LayoutParams.MATCH_PARENT))
    }
    fun set(v: Float) { slider.set(v); valueText.text = format(v) }
}

/** Round palette swatch: a soft gradient of the palette's colours. */
@SuppressLint("ViewConstructor")
class Swatch(ctx: Context, private val colors: IntArray, val label: String, onTap: () -> Unit) : View(ctx) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = Ui.dp(ctx, 1.5f); color = Color.WHITE }
    var picked = false
        set(v) { field = v; invalidate() }

    init { setOnClickListener { onTap() }; contentDescription = label }

    override fun onMeasure(w: Int, h: Int) { val s = Ui.dpi(context, 40f); setMeasuredDimension(s, s) }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        val inner = min(w, h) / 2f - Ui.dp(context, 5f)
        p.shader = LinearGradient(w / 2f - inner, h / 2f + inner, w / 2f + inner, h / 2f - inner,
            intArrayOf(colors[1], colors[2], colors[3]), floatArrayOf(0f, 0.6f, 1f), Shader.TileMode.CLAMP)
    }

    override fun onDraw(c: Canvas) {
        val r = min(width, height) / 2f
        val inner = r - Ui.dp(context, 5f)
        c.drawCircle(width / 2f, height / 2f, inner, p)
        if (picked) c.drawCircle(width / 2f, height / 2f, r - ring.strokeWidth, ring)
    }
}

enum class Glyph { MUSIC, MIC, AMBIENT, LOOK, FRAME, RECORD, STOP, STILL, PRESETS, LOCK, UNLOCK, PREV, NEXT, PLAY, PAUSE, CLOSE, SHARE, TRASH }

/** Line-drawn icon button. */
@SuppressLint("ViewConstructor")
class GlyphButton(ctx: Context, glyph: Glyph, desc: String, onTap: () -> Unit) : View(ctx) {
    var glyph = glyph
        set(v) { field = v; invalidate() }
    var active = false
        set(v) { field = v; invalidate() }
    var size = 44f
    var recordProgress = -1f
        set(v) { field = v; invalidate() }

    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = Ui.dp(ctx, 1.6f); color = Ui.TEXT
        strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = Ui.TEXT }
    private val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x26FFFFFF }
    private val path = Path()
    private val rect = RectF()

    init {
        contentDescription = desc
        isClickable = true
        setOnClickListener { onTap() }
        background = null
    }

    override fun onMeasure(w: Int, h: Int) { val s = Ui.dpi(context, size); setMeasuredDimension(s, s) }

    override fun onDraw(c: Canvas) {
        val cx = width / 2f; val cy = height / 2f
        val u = Ui.dp(context, 1f)
        val col = if (isEnabled) (if (active) Ui.ACCENT else Ui.TEXT) else 0x55FFFFFF
        stroke.color = col; fill.color = col
        if (active && glyph != Glyph.RECORD && glyph != Glyph.STOP) {
            c.drawCircle(cx, cy, min(width, height) / 2f - u * 2, halo)
        }
        path.reset()
        when (glyph) {
            Glyph.MUSIC -> {
                c.drawCircle(cx - 4 * u, cy + 5 * u, 3 * u, fill)
                c.drawLine(cx - 1.2f * u, cy + 5 * u, cx - 1.2f * u, cy - 8 * u, stroke)
                path.moveTo(cx - 1.2f * u, cy - 8 * u); path.quadTo(cx + 3 * u, cy - 7 * u, cx + 6 * u, cy - 3 * u)
                c.drawPath(path, stroke)
            }
            Glyph.MIC -> {
                rect.set(cx - 3.5f * u, cy - 9 * u, cx + 3.5f * u, cy + 2 * u)
                c.drawRoundRect(rect, 3.5f * u, 3.5f * u, stroke)
                rect.set(cx - 7 * u, cy - 5 * u, cx + 7 * u, cy + 6 * u)
                c.drawArc(rect, 20f, 140f, false, stroke)
                c.drawLine(cx, cy + 6 * u, cx, cy + 9 * u, stroke)
            }
            Glyph.AMBIENT -> {
                path.moveTo(cx - 9 * u, cy)
                path.cubicTo(cx - 5 * u, cy - 6 * u, cx - 2 * u, cy - 6 * u, cx, cy)
                path.cubicTo(cx + 2 * u, cy + 6 * u, cx + 5 * u, cy + 6 * u, cx + 9 * u, cy)
                c.drawPath(path, stroke)
            }
            Glyph.LOOK -> {
                c.drawCircle(cx, cy, 8.5f * u, stroke)
                c.drawCircle(cx - 3 * u, cy - 3 * u, 1.6f * u, fill)
                c.drawCircle(cx + 3.2f * u, cy - 2.4f * u, 1.6f * u, fill)
                c.drawCircle(cx + 1.5f * u, cy + 3.6f * u, 1.6f * u, fill)
            }
            Glyph.FRAME -> {
                val s = 8 * u; val k = 3.5f * u
                for ((sx, sy) in listOf(-1f to -1f, 1f to -1f, -1f to 1f, 1f to 1f)) {
                    path.moveTo(cx + sx * s, cy + sy * (s - k)); path.lineTo(cx + sx * s, cy + sy * s); path.lineTo(cx + sx * (s - k), cy + sy * s)
                }
                c.drawPath(path, stroke)
            }
            Glyph.RECORD, Glyph.STOP -> {
                val r = min(width, height) / 2f - 3 * u
                stroke.color = Ui.TEXT
                c.drawCircle(cx, cy, r, stroke)
                if (recordProgress >= 0f) {
                    stroke.color = Ui.REC
                    rect.set(cx - r, cy - r, cx + r, cy + r)
                    c.drawArc(rect, -90f, 360f * recordProgress, false, stroke)
                }
                fill.color = Ui.REC
                if (glyph == Glyph.RECORD) c.drawCircle(cx, cy, r * 0.62f, fill)
                else { rect.set(cx - r * 0.38f, cy - r * 0.38f, cx + r * 0.38f, cy + r * 0.38f); c.drawRoundRect(rect, 3 * u, 3 * u, fill) }
            }
            Glyph.STILL -> {
                rect.set(cx - 9 * u, cy - 6 * u, cx + 9 * u, cy + 7 * u)
                c.drawRoundRect(rect, 2.5f * u, 2.5f * u, stroke)
                c.drawCircle(cx, cy + 0.5f * u, 3.6f * u, stroke)
                c.drawLine(cx - 3 * u, cy - 8.5f * u, cx + 3 * u, cy - 8.5f * u, stroke)
            }
            Glyph.PRESETS -> {
                for (i in 0..2) {
                    val y = cy - 6 * u + i * 6 * u
                    c.drawLine(cx - 8 * u, y, cx + 8 * u, y, stroke)
                }
                c.drawCircle(cx + 3 * u, cy - 6 * u, 2 * u, fill)
                c.drawCircle(cx - 3 * u, cy, 2 * u, fill)
                c.drawCircle(cx + 1 * u, cy + 6 * u, 2 * u, fill)
            }
            Glyph.LOCK, Glyph.UNLOCK -> {
                rect.set(cx - 7 * u, cy - 1 * u, cx + 7 * u, cy + 9 * u)
                c.drawRoundRect(rect, 2 * u, 2 * u, stroke)
                rect.set(cx - 4.5f * u, cy - 9 * u, cx + 4.5f * u, cy + 1 * u)
                if (glyph == Glyph.LOCK) c.drawArc(rect, 180f, 180f, false, stroke)
                else c.drawArc(rect, 180f, 150f, false, stroke)
                if (glyph == Glyph.LOCK) c.drawLine(cx - 4.5f * u, cy - 4 * u, cx - 4.5f * u, cy - 1 * u, stroke)
                c.drawLine(cx + 4.5f * u, cy - 4 * u, cx + 4.5f * u, cy - 1 * u, stroke)
            }
            Glyph.PREV, Glyph.NEXT -> {
                val d = if (glyph == Glyph.NEXT) 1f else -1f
                path.moveTo(cx - d * 3 * u, cy - 7 * u); path.lineTo(cx + d * 3 * u, cy); path.lineTo(cx - d * 3 * u, cy + 7 * u)
                c.drawPath(path, stroke)
            }
            Glyph.PLAY -> {
                path.moveTo(cx - 4 * u, cy - 7 * u); path.lineTo(cx + 7 * u, cy); path.lineTo(cx - 4 * u, cy + 7 * u); path.close()
                c.drawPath(path, fill)
            }
            Glyph.PAUSE -> {
                rect.set(cx - 6 * u, cy - 7 * u, cx - 2 * u, cy + 7 * u); c.drawRoundRect(rect, u, u, fill)
                rect.set(cx + 2 * u, cy - 7 * u, cx + 6 * u, cy + 7 * u); c.drawRoundRect(rect, u, u, fill)
            }
            Glyph.CLOSE -> {
                c.drawLine(cx - 6 * u, cy - 6 * u, cx + 6 * u, cy + 6 * u, stroke)
                c.drawLine(cx + 6 * u, cy - 6 * u, cx - 6 * u, cy + 6 * u, stroke)
            }
            Glyph.SHARE -> {
                c.drawCircle(cx + 6 * u, cy - 6 * u, 2.4f * u, stroke)
                c.drawCircle(cx - 6 * u, cy, 2.4f * u, stroke)
                c.drawCircle(cx + 6 * u, cy + 6 * u, 2.4f * u, stroke)
                c.drawLine(cx - 4 * u, cy - 1.2f * u, cx + 4 * u, cy - 5 * u, stroke)
                c.drawLine(cx - 4 * u, cy + 1.2f * u, cx + 4 * u, cy + 5 * u, stroke)
            }
            Glyph.TRASH -> {
                c.drawLine(cx - 7 * u, cy - 5 * u, cx + 7 * u, cy - 5 * u, stroke)
                rect.set(cx - 5 * u, cy - 5 * u, cx + 5 * u, cy + 8 * u); c.drawRoundRect(rect, 1.5f * u, 1.5f * u, stroke)
                c.drawLine(cx - 2 * u, cy - 8 * u, cx + 2 * u, cy - 8 * u, stroke)
            }
        }
    }
}
