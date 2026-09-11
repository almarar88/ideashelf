package ai.pacto.app.platform.vision

/**
 * Reads a serial or VIN off a captured photo.
 *
 * The shipped implementation is [ManualSerialReader]: the operator types what they see and the
 * photo is stored alongside it as the proof. An OCR model implements the same interface without
 * any caller changing; nothing in the evidence chain depends on which one is installed, because
 * the photo and its hash are the record either way.
 */
interface SerialReader {
    data class Reading(val serial: String, val confidence: Float, val automatic: Boolean)

    fun read(imagePath: String, typedFallback: String?): Reading?
}

class ManualSerialReader : SerialReader {
    override fun read(imagePath: String, typedFallback: String?): SerialReader.Reading? {
        val value = typedFallback?.trim()?.uppercase()?.replace(" ", "")
        if (value.isNullOrBlank()) return null
        return SerialReader.Reading(value, confidence = 1f, automatic = false)
    }
}
