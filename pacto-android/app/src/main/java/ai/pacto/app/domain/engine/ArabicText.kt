package ai.pacto.app.domain.engine

/**
 * Normalisation shared by every text engine. Spoken transcripts and pasted chat text arrive
 * with Arabic-Indic digits, tatweel, inconsistent hamza forms and stray diacritics; all of the
 * matching below assumes a single normalised shape.
 */
object ArabicText {

    private val DIACRITICS = Regex("[\\u064B-\\u0652\\u0670\\u0640]")

    fun normalize(input: String): String {
        val sb = StringBuilder(input.length)
        for (ch in input) {
            val mapped = when (ch) {
                in '٠'..'٩' -> ('0' + (ch - '٠'))       // ٠-٩
                in '۰'..'۹' -> ('0' + (ch - '۰'))       // ۰-۹ (extended)
                'أ', 'إ', 'آ', 'ٱ' -> 'ا'
                'ى' -> 'ي'
                'ة' -> 'ه'
                'ؤ' -> 'و'
                'ئ' -> 'ي'
                ' ' -> ' '
                else -> ch
            }
            sb.append(mapped)
        }
        return DIACRITICS.replace(sb.toString(), "")
            .replace(Regex("[\\t\\r]+"), " ")
            .replace(Regex(" {2,}"), " ")
            .trim()
    }

    /** Normalised text with punctuation flattened, for keyword containment checks. */
    fun flatten(input: String): String =
        normalize(input).replace(Regex("[،,.!?؟:;\\-_/\\\\()\\[\\]\"']"), " ")
            .replace(Regex(" {2,}"), " ")

    fun containsAny(haystack: String, needles: Collection<String>): Boolean {
        val flat = flatten(haystack)
        return needles.any { flat.contains(normalize(it)) }
    }
}
