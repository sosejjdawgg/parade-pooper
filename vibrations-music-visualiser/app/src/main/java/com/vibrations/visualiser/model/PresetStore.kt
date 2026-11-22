package com.vibrations.visualiser.model

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class Preset(val name: String, val look: Look, val aspect: Aspect?, val builtIn: Boolean = false)

/** Named looks the user saves, plus the last session's state. */
class PresetStore(context: Context, private val catalog: Catalog) {
    private val prefs = context.getSharedPreferences("vibrations", Context.MODE_PRIVATE)

    val starters: List<Preset> = listOf(
        Preset("Afterglow", Look(scene = catalog.sceneIndex("silk"), palette = catalog.paletteIndex("Dusk"), trails = 0.55f, glow = 0.7f), null, true),
        Preset("Night drive", Look(scene = catalog.sceneIndex("beams"), palette = catalog.paletteIndex("Neon"), glow = 0.8f, sensitivity = 1.2f), null, true),
        Preset("Glass", Look(scene = catalog.sceneIndex("prism"), palette = catalog.paletteIndex("Glacier"), symmetry = Symmetry.SIX, glow = 0.5f), null, true),
        Preset("Low tide", Look(scene = catalog.sceneIndex("tide"), palette = catalog.paletteIndex("Mono"), glow = 0.35f, grain = 0.4f), Aspect.SQUARE, true),
        Preset("Cover art", Look(scene = catalog.sceneIndex("void"), palette = catalog.paletteIndex("Pearl"), glow = 0.5f, textOn = true, title = "Untitled", subtitle = "Single", textPlacement = TextPlacement.BOTTOM), Aspect.SQUARE, true),
        Preset("Dust", Look(scene = catalog.sceneIndex("motes"), palette = catalog.paletteIndex("Ember"), trails = 0.35f, glow = 0.7f), null, true),
    )

    fun userPresets(): List<Preset> {
        val arr = runCatching { JSONArray(prefs.getString("presets", "[]")) }.getOrElse { JSONArray() }
        return (0 until arr.length()).mapNotNull { i ->
            runCatching {
                val o = arr.getJSONObject(i)
                val aspect = if (o.has("aspect")) enumOr(o.getString("aspect"), Aspect.FULL) else null
                Preset(o.getString("name"), Look.fromJson(o.getJSONObject("look"), catalog), aspect)
            }.getOrNull()
        }
    }

    fun save(name: String, look: Look, aspect: Aspect) {
        val list = userPresets().filter { it.name != name } + Preset(name, look, aspect)
        write(list)
    }

    fun delete(name: String) = write(userPresets().filter { it.name != name })

    private fun write(list: List<Preset>) {
        val arr = JSONArray()
        list.forEach { p ->
            arr.put(JSONObject().apply {
                put("name", p.name)
                put("look", p.look.toJson(catalog))
                p.aspect?.let { put("aspect", it.name) }
            })
        }
        prefs.edit().putString("presets", arr.toString()).apply()
    }

    fun saveSession(look: Look, output: Output) {
        prefs.edit().putString("session_look", look.toJson(catalog).toString())
            .putString("session_output", output.toJson().toString()).apply()
    }

    fun loadLook(): Look = prefs.getString("session_look", null)
        ?.let { runCatching { Look.fromJson(JSONObject(it), catalog) }.getOrNull() } ?: Look()

    fun loadOutput(): Output = prefs.getString("session_output", null)
        ?.let { runCatching { Output.fromJson(JSONObject(it)) }.getOrNull() } ?: Output()

    var seenGestureGuide: Boolean
        get() = prefs.getBoolean("seen_guide", false)
        set(v) = prefs.edit().putBoolean("seen_guide", v).apply()
}
