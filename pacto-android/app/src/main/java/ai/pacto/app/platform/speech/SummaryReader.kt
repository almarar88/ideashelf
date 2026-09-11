package ai.pacto.app.platform.speech

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/** Reads the term sheet aloud, for a party who would rather hear the deal than read it. */
class SummaryReader(context: Context) {

    private var ready = false
    private val tts = TextToSpeech(context.applicationContext) { status ->
        ready = status == TextToSpeech.SUCCESS
    }

    fun speak(text: String, languageTag: String = "ar") {
        if (!ready) return
        runCatching { tts.language = Locale.forLanguageTag(languageTag) }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "pacto_summary")
    }

    fun stop() {
        runCatching { tts.stop() }
    }

    fun release() {
        runCatching { tts.stop() }
        runCatching { tts.shutdown() }
    }
}
