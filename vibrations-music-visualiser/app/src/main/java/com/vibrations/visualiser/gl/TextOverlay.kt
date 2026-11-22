package com.vibrations.visualiser.gl

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.vibrations.visualiser.model.TextPlacement
import java.util.Locale
import kotlin.math.min

/** Renders the optional title / single line into a canvas-sized alpha bitmap. */
object TextOverlay {
    fun render(w: Int, h: Int, title: String, line: String, placement: TextPlacement): Bitmap {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val short = min(w, h).toFloat()
        val margin = short * 0.075f
        val maxW = w - margin * 2

        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
            textSize = short * 0.056f
            letterSpacing = 0.01f
            color = Color.WHITE
        }
        val sp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            textSize = short * 0.019f
            letterSpacing = 0.3f
            color = Color.argb(200, 255, 255, 255)
        }
        val sub = line.trim().uppercase(Locale.getDefault())
        val ttl = title.trim()
        fit(tp, ttl, maxW); fit(sp, sub, maxW)

        val align = if (placement == TextPlacement.BOTTOM_LEFT) Paint.Align.LEFT else Paint.Align.CENTER
        tp.textAlign = align; sp.textAlign = align
        val x = if (align == Paint.Align.LEFT) margin else w / 2f
        val gap = sp.textSize * 2.4f
        when (placement) {
            TextPlacement.CENTER -> {
                val ty = h / 2f + tp.textSize * 0.32f
                if (ttl.isNotEmpty()) c.drawText(ttl, x, ty, tp)
                if (sub.isNotEmpty()) c.drawText(sub, x, if (ttl.isNotEmpty()) ty + gap + sp.textSize * 0.4f else h / 2f, sp)
            }
            else -> {
                val bottom = h - margin
                if (sub.isNotEmpty()) c.drawText(sub, x, bottom, sp)
                if (ttl.isNotEmpty()) c.drawText(ttl, x, if (sub.isNotEmpty()) bottom - gap else bottom, tp)
            }
        }
        return bmp
    }

    private fun fit(p: Paint, text: String, maxW: Float) {
        if (text.isEmpty()) return
        val w = p.measureText(text)
        if (w > maxW) p.textSize *= maxW / w
    }
}
