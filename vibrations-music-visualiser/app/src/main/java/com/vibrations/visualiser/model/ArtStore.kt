package com.vibrations.visualiser.model

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.net.Uri
import java.io.File
import kotlin.math.max
import kotlin.math.sqrt

/** The user's artwork: copied into app storage so it survives restarts, decoded on demand. */
class ArtStore(private val context: Context) {
    companion object {
        const val MAX_SIDE = 2560
    }

    class Loaded(val bitmap: Bitmap, val srcWidth: Int, val srcHeight: Int, val palette: Palette, val hasAlpha: Boolean)

    private val file = File(context.filesDir, "artwork")

    val hasArt: Boolean get() = file.exists() && file.length() > 0

    /** Copies [uri] into app storage and decodes it. Call off the main thread. */
    fun import(uri: Uri): Loaded {
        val tmp = File(context.filesDir, "artwork.tmp")
        context.contentResolver.openInputStream(uri)?.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            ?: throw IllegalStateException("Couldn't open that image")
        val loaded = decode(tmp)  // validate before replacing the current artwork
        tmp.renameTo(file)
        return loaded
    }

    fun load(): Loaded? = if (hasArt) runCatching { decode(file) }.getOrNull() else null

    fun clear() { file.delete() }

    private fun decode(f: File): Loaded {
        var srcW = 0; var srcH = 0
        val bmp = ImageDecoder.decodeBitmap(ImageDecoder.createSource(f)) { dec, info, _ ->
            srcW = info.size.width; srcH = info.size.height
            dec.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            dec.isMutableRequired = false
            val big = max(srcW, srcH)
            if (big > MAX_SIDE) {
                val s = MAX_SIDE.toFloat() / big
                dec.setTargetSize((srcW * s).toInt().coerceAtLeast(1), (srcH * s).toInt().coerceAtLeast(1))
            }
        }
        val argb = if (bmp.config == Bitmap.Config.ARGB_8888) bmp else bmp.copy(Bitmap.Config.ARGB_8888, false).also { bmp.recycle() }
        return Loaded(argb, srcW, srcH, extractPalette(argb), argb.hasAlpha())
    }

    /** k-means on a thumbnail → background (darkest, deepened), primary, secondary, highlight. */
    private fun extractPalette(b: Bitmap): Palette {
        val thumb = Bitmap.createScaledBitmap(b, 48, 48, true)
        val px = IntArray(48 * 48)
        thumb.getPixels(px, 0, 48, 0, 0, 48, 48)
        if (thumb != b) thumb.recycle()
        val pts = px.filter { Color.alpha(it) > 128 }.map { floatArrayOf(Color.red(it) / 255f, Color.green(it) / 255f, Color.blue(it) / 255f) }
        if (pts.size < 8) return Palette("Art", intArrayOf(0xFF07080D.toInt(), 0xFF7F93BA.toInt(), 0xFFCDB9DE.toInt(), 0xFFFFF4E6.toInt()), 0.3f)
        val k = 5
        val cent = Array(k) { pts[(it * pts.size) / k].copyOf() }
        val assign = IntArray(pts.size)
        repeat(12) {
            for (i in pts.indices) {
                var best = 0; var bd = Float.MAX_VALUE
                for (c in 0 until k) {
                    val d = dist(pts[i], cent[c]); if (d < bd) { bd = d; best = c }
                }
                assign[i] = best
            }
            for (c in 0 until k) {
                val m = pts.indices.filter { assign[it] == c }
                if (m.isEmpty()) continue
                for (ch in 0..2) cent[c][ch] = m.map { pts[it][ch] }.average().toFloat()
            }
        }
        fun lum(c: FloatArray) = 0.2126f * c[0] + 0.7152f * c[1] + 0.0722f * c[2]
        fun sat(c: FloatArray) = c.max() - c.min()
        val byLum = cent.sortedBy { lum(it) }
        val dark = byLum.first()
        val light = byLum.last()
        val mids = byLum.drop(1).dropLast(1).sortedByDescending { sat(it) * (0.5f + lum(it)) }
        val primary = mids.getOrElse(0) { byLum[byLum.size / 2] }
        val secondary = mids.getOrElse(1) { primary }
        fun col(c: FloatArray, gain: Float = 1f) = Color.rgb((c[0] * gain * 255).toInt().coerceIn(0, 255), (c[1] * gain * 255).toInt().coerceIn(0, 255), (c[2] * gain * 255).toInt().coerceIn(0, 255))
        // lift the highlight towards white so glows read
        val hl = FloatArray(3) { (light[it] * 0.6f + 0.4f) }
        val vivid = { c: FloatArray -> val m = max(c.max(), 0.05f); FloatArray(3) { c[it] / m * 0.95f } }
        val avgSat = cent.map { sat(it) }.average().toFloat()
        return Palette("Art", intArrayOf(col(dark, 0.12f), col(vivid(primary)), col(vivid(secondary)), col(hl)), if (avgSat > 0.35f) 0.6f else 0.2f)
    }

    private fun dist(a: FloatArray, b: FloatArray): Float {
        val r = a[0] - b[0]; val g = a[1] - b[1]; val bl = a[2] - b[2]
        return sqrt(r * r + g * g + bl * bl)
    }
}
