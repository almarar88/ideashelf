package com.almarar.mahami.voice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** ما يصدر عن جلسة الاستماع */
sealed interface VoiceEvent {
    data object Ready : VoiceEvent
    /** نص جزئي يتغيّر أثناء الكلام */
    data class Partial(val text: String) : VoiceEvent
    /** مستوى الصوت من 0 إلى 1 — يغذّي الموجة المتحركة */
    data class Level(val value: Float) : VoiceEvent
    data class Final(val text: String) : VoiceEvent
    /** المعالجة على الجهاز غير متاحة لهذه اللغة — يُعاد المحاولة عبر الإنترنت */
    data object OfflineUnavailable : VoiceEvent
    data class Failed(val message: String, val recoverable: Boolean) : VoiceEvent
}

/**
 * غلاف حول SpeechRecognizer يحوّله إلى تدفّق أحداث.
 *
 * نستخدمه بدل نافذة النظام (ACTION_RECOGNIZE_SPEECH) لأن النافذة تحجب
 * الشاشة ولا تعطينا نصاً جزئياً ولا مستوى صوت، ولا تسمح بمراجعة ما فُهم
 * قبل الحفظ.
 */
class VoiceRecognizer(private val context: Context) {

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun hasPermission(): Boolean = ContextCompat.checkSelfPermission(
        context, Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED

    /**
     * يبدأ الاستماع ويُصدر الأحداث حتى يُلغى التدفّق.
     * يجب استدعاؤه من الخيط الرئيسي — SpeechRecognizer يشترط ذلك.
     */
    fun listen(
        languageTag: String = "ar-SA",
        preferOffline: Boolean = true
    ): Flow<VoiceEvent> = callbackFlow {
        if (!isAvailable()) {
            trySend(VoiceEvent.Failed(NO_ENGINE, recoverable = false))
            close()
            return@callbackFlow
        }

        val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
        var lastPartial = ""

        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: android.os.Bundle?) {
                trySend(VoiceEvent.Ready)
            }

            override fun onRmsChanged(rmsdB: Float) {
                // المدى العملي لـ rmsdB تقريباً من -2 إلى 10
                trySend(VoiceEvent.Level(((rmsdB + 2f) / 12f).coerceIn(0f, 1f)))
            }

            override fun onPartialResults(partialResults: android.os.Bundle?) {
                partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.takeIf { it.isNotBlank() }
                    ?.let {
                        lastPartial = it
                        trySend(VoiceEvent.Partial(it))
                    }
            }

            override fun onResults(results: android.os.Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.takeIf { it.isNotBlank() }
                    ?: lastPartial
                if (text.isBlank()) {
                    trySend(VoiceEvent.Failed(NOTHING_HEARD, recoverable = true))
                } else {
                    trySend(VoiceEvent.Final(text))
                }
                close()
            }

            override fun onError(error: Int) {
                when {
                    // لو سمعنا شيئاً قبل الخطأ فالأولى أن نعتمده بدل أن نضيّعه
                    lastPartial.isNotBlank() && error in SALVAGEABLE ->
                        trySend(VoiceEvent.Final(lastPartial))

                    // النموذج المحلي غير منزّل لهذه اللغة: نعيد المحاولة عبر
                    // الإنترنت بدل أن نُفشل الميزة كلها في وجه المستخدم
                    preferOffline && error in OFFLINE_MISSING ->
                        trySend(VoiceEvent.OfflineUnavailable)

                    else ->
                        trySend(VoiceEvent.Failed(describe(error), recoverable = error !in FATAL))
                }
                close()
            }

            override fun onEndOfSpeech() = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit
        })

        val intent = android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            // نفضّل المعالجة على الجهاز حين تتوفّر، فلا يغادر الصوت الهاتف
            if (preferOffline && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            }
            // مهلة صمت أطول قليلاً: إملاء المهام فيه وقفات تفكير
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2200L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2200L)
        }

        runCatching { recognizer.startListening(intent) }
            .onFailure {
                trySend(VoiceEvent.Failed(NO_ENGINE, recoverable = false))
                close()
            }

        awaitClose {
            runCatching {
                recognizer.stopListening()
                recognizer.destroy()
            }
        }
    }

    private fun describe(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "تعذّر التقاط الصوت من الميكروفون."
        SpeechRecognizer.ERROR_CLIENT -> "تعذّر بدء الاستماع، حاول مرة أخرى."
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "لم يُسمح للتطبيق باستخدام الميكروفون."
        SpeechRecognizer.ERROR_NETWORK -> "المحرّك يحتاج إنترنت ولا يوجد اتصال."
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "انتهت مهلة الاتصال بمحرّك التعرّف."
        SpeechRecognizer.ERROR_NO_MATCH -> NOTHING_HEARD
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "محرّك التعرّف مشغول، أعد المحاولة بعد لحظة."
        SpeechRecognizer.ERROR_SERVER -> "خطأ من خادم التعرّف على الكلام."
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "لم أسمع شيئاً — تحدّث بعد الضغط مباشرة."
        ERROR_TOO_MANY_REQUESTS -> "المحرّك مزدحم الآن، أعد المحاولة بعد قليل."
        ERROR_SERVER_DISCONNECTED -> "انقطع الاتصال بمحرّك التعرّف."
        ERROR_LANGUAGE_NOT_SUPPORTED ->
            "محرّك الإملاء في جهازك لا يدعم العربية. غيّره من: الإعدادات ← النظام ← اللغات والإدخال."
        ERROR_LANGUAGE_UNAVAILABLE ->
            "اللغة العربية غير منزّلة في محرّك الإملاء. نزّلها من إعدادات «التعرّف على الكلام» في جهازك."
        ERROR_CANNOT_CHECK_SUPPORT -> "تعذّر التحقق من دعم اللغة في المحرّك."
        else -> "تعذّر التعرّف على الكلام (رمز $error)."
    }

    companion object {
        const val NO_ENGINE =
            "لا يوجد محرّك إملاء صوتي على الجهاز. ثبّت «خدمات الصوت من Google» ثم أعد المحاولة."
        const val NOTHING_HEARD = "لم أسمع كلاماً واضحاً — جرّب مرة أخرى."

        /** أخطاء نعتمد عندها النص الجزئي إن وُجد بدل إسقاطه */
        private val SALVAGEABLE = setOf(
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT
        )

        /** أخطاء لا تُصلحها إعادة المحاولة */
        private val FATAL = setOf(
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS
        )

        // رموز أُضيفت في أندرويد 13 و14؛ نكتبها صراحةً لتعمل على الإصدارات الأقدم
        private const val ERROR_TOO_MANY_REQUESTS = 10
        private const val ERROR_SERVER_DISCONNECTED = 11
        private const val ERROR_LANGUAGE_NOT_SUPPORTED = 12
        private const val ERROR_LANGUAGE_UNAVAILABLE = 13
        private const val ERROR_CANNOT_CHECK_SUPPORT = 14

        /** أخطاء سببها غياب النموذج المحلي — تُحلّ بإعادة المحاولة عبر الإنترنت */
        private val OFFLINE_MISSING = setOf(
            ERROR_LANGUAGE_UNAVAILABLE,
            ERROR_LANGUAGE_NOT_SUPPORTED,
            ERROR_CANNOT_CHECK_SUPPORT,
            SpeechRecognizer.ERROR_CLIENT
        )
    }
}
