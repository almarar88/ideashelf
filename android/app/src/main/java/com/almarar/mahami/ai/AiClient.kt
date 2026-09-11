package com.almarar.mahami.ai

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** النماذج المتاحة داخل التطبيق */
enum class AiModel(val id: String, val label: String, val hint: String) {
    SONNET_5("claude-sonnet-5", "Claude Sonnet 5", "متوازن — الخيار الافتراضي"),
    OPUS_5("claude-opus-5", "Claude Opus 5", "الأقوى للتحليل المعقّد"),
    HAIKU_45("claude-haiku-4-5-20251001", "Claude Haiku 4.5", "الأسرع والأوفر");

    companion object {
        fun fromId(id: String?): AiModel = entries.firstOrNull { it.id == id } ?: SONNET_5
    }
}

/** عميل بسيط لواجهة Claude Messages API */
class AiClient(
    private val apiKeyProvider: () -> String?,
    /** يُستبدل في الاختبارات بخادم محلي */
    private val endpoint: String = DEFAULT_ENDPOINT
) {

    fun hasKey(): Boolean = !apiKeyProvider().isNullOrBlank()

    /** يرسل رسالة واحدة ويعيد النص الناتج */
    suspend fun complete(
        model: AiModel,
        system: String,
        userMessage: String,
        history: List<ChatMessage> = emptyList(),
        maxTokens: Int = 2000,
        temperature: Double = 0.3
    ): String = withContext(Dispatchers.IO) {
        val key = apiKeyProvider()
        if (key.isNullOrBlank()) throw AiException("لم يتم إدخال مفتاح Claude في الإعدادات.")

        val messages = JSONArray()
        history.takeLast(10).filter { !it.pending && it.text.isNotBlank() }.forEach { m ->
            messages.put(
                JSONObject()
                    .put("role", if (m.fromUser) "user" else "assistant")
                    .put("content", m.text)
            )
        }
        messages.put(JSONObject().put("role", "user").put("content", userMessage))

        val body = JSONObject()
            .put("model", model.id)
            .put("max_tokens", maxTokens)
            .put("temperature", temperature)
            .put("system", system)
            .put("messages", messages)
            .toString()

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20_000
            readTimeout = 90_000
            doOutput = true
            setRequestProperty("content-type", "application/json")
            setRequestProperty("x-api-key", key)
            setRequestProperty("anthropic-version", ANTHROPIC_VERSION)
        }

        try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()

            if (status !in 200..299) throw AiException(describeError(status, raw))

            val json = JSONObject(raw)
            val content = json.optJSONArray("content") ?: throw AiException("رد غير متوقع من الخدمة.")
            val text = buildString {
                for (i in 0 until content.length()) {
                    val part = content.optJSONObject(i) ?: continue
                    if (part.optString("type") == "text") append(part.optString("text"))
                }
            }
            if (text.isBlank()) throw AiException("لم يصل نص في رد الخدمة.")
            text.trim()
        } catch (e: AiException) {
            throw e
        } catch (e: Exception) {
            throw AiException("تعذّر الاتصال بخدمة Claude: ${e.message ?: "خطأ في الشبكة"}")
        } finally {
            connection.disconnect()
        }
    }

    private fun describeError(status: Int, raw: String): String {
        val apiMessage = runCatching {
            JSONObject(raw).optJSONObject("error")?.optString("message").orEmpty()
        }.getOrDefault("")
        val base = when (status) {
            401 -> "مفتاح Claude غير صحيح أو منتهي."
            403 -> "المفتاح لا يملك صلاحية الوصول لهذا النموذج."
            404 -> "النموذج المحدد غير متاح لحسابك."
            429 -> "تجاوزت حد الطلبات المسموح. أعد المحاولة بعد قليل."
            in 500..599 -> "الخدمة مشغولة حالياً. أعد المحاولة."
            else -> "فشل الطلب (رمز $status)."
        }
        return if (apiMessage.isBlank()) base else "$base\n$apiMessage"
    }

    companion object {
        const val DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages"
        private const val ANTHROPIC_VERSION = "2023-06-01"

        /** يستخرج أول كتلة JSON من نص قد يحتوي شرحاً حولها */
        fun extractJson(text: String): String {
            val fenced = Regex("""```(?:json)?\s*([\s\S]*?)```""").find(text)?.groupValues?.get(1)
            val candidate = fenced ?: text
            val start = candidate.indexOfFirst { it == '{' || it == '[' }
            val end = candidate.indexOfLast { it == '}' || it == ']' }
            return if (start >= 0 && end > start) candidate.substring(start, end + 1) else candidate.trim()
        }
    }
}
