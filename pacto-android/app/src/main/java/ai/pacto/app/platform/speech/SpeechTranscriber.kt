package ai.pacto.app.platform.speech

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * On-device dictation. [preferOffline] asks the recogniser to stay local, which keeps the
 * negotiation on the phone on devices whose recogniser supports it.
 */
class SpeechTranscriber(private val context: Context) {

    interface Callback {
        fun onPartial(text: String)
        fun onFinal(chunks: List<String>)
        fun onError(message: String)
    }

    private var recognizer: SpeechRecognizer? = null
    private val collected = mutableListOf<String>()

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun start(languageTag: String, preferOffline: Boolean, callback: Callback) {
        stop()
        collected.clear()
        if (!isAvailable()) {
            callback.onError("محرك التعرف على الكلام غير متاح على هذا الجهاز")
            return
        }
        val created = SpeechRecognizer.createSpeechRecognizer(context)
        created.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit

            override fun onError(error: Int) {
                callback.onError(describe(error))
            }

            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    .orEmpty()
                if (text.isNotBlank()) collected += text
                callback.onFinal(collected.toList())
            }

            override fun onPartialResults(partialResults: Bundle?) {
                partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.let(callback::onPartial)
            }

            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
        }
        created.startListening(intent)
        recognizer = created
    }

    fun stop() {
        recognizer?.let {
            runCatching { it.stopListening() }
            runCatching { it.destroy() }
        }
        recognizer = null
    }

    private fun describe(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "خطأ في التقاط الصوت"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "إذن الميكروفون غير ممنوح"
        SpeechRecognizer.ERROR_NO_MATCH -> "لم يتم التعرف على كلام واضح"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "تعذر الاتصال بمحرك التعرف"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "انتهت مهلة الانتظار دون كلام"
        else -> "تعذر التعرف على الكلام ($error)"
    }
}
