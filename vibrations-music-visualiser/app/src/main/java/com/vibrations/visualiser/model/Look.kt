package com.vibrations.visualiser.model

import org.json.JSONObject

enum class Aspect(val label: String, val ratio: Float) {
    FULL("Full", 0f), WIDE("16:9", 16f / 9f), TALL("9:16", 9f / 16f), SQUARE("1:1", 1f)
}

enum class Symmetry(val label: String, val shaderValue: Int) {
    OFF("Off", 0), MIRROR("Mirror", 1), QUAD("Quad", 2), SIX("6", 6), EIGHT("8", 8)
}

enum class TextPlacement(val label: String) { BOTTOM_LEFT("Corner"), BOTTOM("Bottom"), CENTER("Centre") }

/** Everything that defines how the picture looks. Immutable; swapped atomically. */
data class Look(
    val scene: Int = 0,
    val palette: Int = 0,
    val sensitivity: Float = 1f,
    val symmetry: Symmetry = Symmetry.OFF,
    val trails: Float = 0f,
    val glow: Float = 0.6f,
    val motion: Float = 1f,
    val grain: Float = 0.25f,
    val soft: Boolean = false,
    val textOn: Boolean = false,
    val title: String = "",
    val subtitle: String = "",
    val textPlacement: TextPlacement = TextPlacement.BOTTOM_LEFT,
    // artwork
    val artOn: Boolean = false,
    val artMode: Int = 1,          // Neon
    val artFit: Float = 0f,        // 0 fill .. 1 fit
    val artAmount: Float = 1f,     // dry/wet of the mode
    val artTint: Float = 0f,       // 0 artwork colours .. 1 palette colours
    val artBehind: Float = 0f,     // scene showing behind the art
    val artLine: Float = 0.4f,     // neon line weight
    val artFill: Float = 0.12f,    // neon: picture left under the lines
    val artDetail: Float = 0.35f,  // neon: contour detail
    val artEnhance: Boolean = true,
) {
    fun toJson(catalog: Catalog): JSONObject = JSONObject().apply {
        put("scene", catalog.scenes[scene].id)
        put("palette", catalog.palettes[palette.coerceIn(0, catalog.palettes.size - 1)].name)
        put("sensitivity", sensitivity.toDouble())
        put("symmetry", symmetry.name)
        put("trails", trails.toDouble())
        put("glow", glow.toDouble())
        put("motion", motion.toDouble())
        put("grain", grain.toDouble())
        put("soft", soft)
        put("textOn", textOn)
        put("title", title)
        put("subtitle", subtitle)
        put("textPlacement", textPlacement.name)
        put("artOn", artOn); put("artMode", catalog.arts[artMode].id)
        put("artFit", artFit.toDouble()); put("artAmount", artAmount.toDouble()); put("artTint", artTint.toDouble())
        put("artBehind", artBehind.toDouble()); put("artLine", artLine.toDouble()); put("artFill", artFill.toDouble())
        put("artDetail", artDetail.toDouble()); put("artEnhance", artEnhance)
    }

    companion object {
        fun fromJson(o: JSONObject, catalog: Catalog): Look {
            val d = Look()
            return Look(
                scene = catalog.sceneIndex(o.optString("scene")),
                palette = catalog.paletteIndex(o.optString("palette")),
                sensitivity = o.optDouble("sensitivity", d.sensitivity.toDouble()).toFloat(),
                symmetry = enumOr(o.optString("symmetry"), d.symmetry),
                trails = o.optDouble("trails", d.trails.toDouble()).toFloat(),
                glow = o.optDouble("glow", d.glow.toDouble()).toFloat(),
                motion = o.optDouble("motion", d.motion.toDouble()).toFloat(),
                grain = o.optDouble("grain", d.grain.toDouble()).toFloat(),
                soft = o.optBoolean("soft", false),
                textOn = o.optBoolean("textOn", false),
                title = o.optString("title", ""),
                subtitle = o.optString("subtitle", ""),
                textPlacement = enumOr(o.optString("textPlacement"), d.textPlacement),
                artOn = o.optBoolean("artOn", false),
                artMode = if (o.has("artMode")) catalog.artIndex(o.getString("artMode")) else d.artMode,
                artFit = o.optDouble("artFit", d.artFit.toDouble()).toFloat(),
                artAmount = o.optDouble("artAmount", d.artAmount.toDouble()).toFloat(),
                artTint = o.optDouble("artTint", d.artTint.toDouble()).toFloat(),
                artBehind = o.optDouble("artBehind", d.artBehind.toDouble()).toFloat(),
                artLine = o.optDouble("artLine", d.artLine.toDouble()).toFloat(),
                artFill = o.optDouble("artFill", d.artFill.toDouble()).toFloat(),
                artDetail = o.optDouble("artDetail", d.artDetail.toDouble()).toFloat(),
                artEnhance = o.optBoolean("artEnhance", true),
            )
        }
    }
}

/** Output/recording settings. */
data class Output(
    val aspect: Aspect = Aspect.FULL,
    val loopSeconds: Int = 0,      // 0 = loop mode off
    val fps: Int = 30,
    val hd: Boolean = true,        // 1080p vs 720p
    val hideUiWhileRecording: Boolean = true,
) {
    val loopMode get() = loopSeconds > 0

    fun toJson(): JSONObject = JSONObject().apply {
        put("aspect", aspect.name); put("loopSeconds", loopSeconds); put("fps", fps)
        put("hd", hd); put("hideUi", hideUiWhileRecording)
    }

    companion object {
        fun fromJson(o: JSONObject): Output = Output(
            aspect = enumOr(o.optString("aspect"), Aspect.FULL),
            loopSeconds = o.optInt("loopSeconds", 0),
            fps = o.optInt("fps", 30),
            hd = o.optBoolean("hd", true),
            hideUiWhileRecording = o.optBoolean("hideUi", true),
        )
    }
}

inline fun <reified T : Enum<T>> enumOr(name: String?, fallback: T): T =
    enumValues<T>().firstOrNull { it.name == name } ?: fallback
