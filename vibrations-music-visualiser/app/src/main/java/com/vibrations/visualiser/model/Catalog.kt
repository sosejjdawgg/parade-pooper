package com.vibrations.visualiser.model

import android.content.Context
import android.graphics.Color
import org.json.JSONArray

class SceneInfo(val id: String, val name: String, val kind: String, val scale: Float)

class Palette(val name: String, val colors: IntArray, val punch: Float) {
    /** 12 floats: bg, primary, secondary, highlight as linear-ish RGB 0..1. */
    val rgb: FloatArray = FloatArray(12).also { out ->
        for (i in 0 until 4) {
            out[i * 3] = Color.red(colors[i]) / 255f
            out[i * 3 + 1] = Color.green(colors[i]) / 255f
            out[i * 3 + 2] = Color.blue(colors[i]) / 255f
        }
    }
}

/** Scene + palette definitions, shared with the desktop shader preview via assets JSON. */
class Catalog(context: Context) {
    val scenes: List<SceneInfo>
    val palettes: List<Palette>

    init {
        val assets = context.assets
        val sj = JSONArray(assets.open("scenes.json").bufferedReader().use { it.readText() })
        scenes = (0 until sj.length()).map {
            val o = sj.getJSONObject(it)
            SceneInfo(o.getString("id"), o.getString("name"), o.getString("kind"), o.getDouble("scale").toFloat())
        }
        val pj = JSONArray(assets.open("palettes.json").bufferedReader().use { it.readText() })
        palettes = (0 until pj.length()).map {
            val o = pj.getJSONObject(it)
            val c = o.getJSONArray("colors")
            Palette(o.getString("name"), IntArray(4) { i -> Color.parseColor(c.getString(i)) }, o.getDouble("punch").toFloat())
        }
    }

    fun sceneIndex(id: String): Int = scenes.indexOfFirst { it.id == id }.coerceAtLeast(0)
    fun paletteIndex(name: String): Int = palettes.indexOfFirst { it.name == name }.coerceAtLeast(0)
}
