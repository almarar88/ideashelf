package com.almarar.mahami.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** خطأ قادم من خادم المزامنة برسالة عربية جاهزة للعرض */
class SyncException(message: String) : Exception(message)

/** استجابة خام من الخادم */
data class HttpResponse(val code: Int, val body: String) {
    val success: Boolean get() = code in 200..299

    fun asObject(): JSONObject = runCatching { JSONObject(body) }.getOrElse { JSONObject() }
    fun asArray(): JSONArray = runCatching { JSONArray(body) }.getOrElse { JSONArray() }
}

/** عميل HTTP بسيط بلا مكتبات خارجية */
object Http {

    suspend fun request(
        url: String,
        method: String,
        headers: Map<String, String> = emptyMap(),
        body: String? = null,
        timeoutMs: Int = 20_000
    ): HttpResponse = withContext(Dispatchers.IO) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            headers.forEach { (name, value) -> setRequestProperty(name, value) }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { payload ->
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
            HttpResponse(code, text)
        } catch (e: Exception) {
            throw SyncException("تعذّر الاتصال بالخادم: ${e.message ?: "تحقق من الإنترنت"}")
        } finally {
            connection.disconnect()
        }
    }

    /** يحوّل رسالة الخطأ القادمة من Supabase إلى نص عربي مفهوم */
    fun describe(response: HttpResponse): String {
        val json = response.asObject()
        val raw = listOf(
            json.optString("msg"),
            json.optString("message"),
            json.optString("error_description"),
            json.optString("error")
        ).firstOrNull { it.isNotBlank() }.orEmpty()

        return when {
            raw.contains("Invalid login", true) ||
                raw.contains("invalid_grant", true) -> "البريد أو كلمة المرور غير صحيحة."
            raw.contains("already registered", true) ||
                raw.contains("already been registered", true) -> "هذا البريد مسجّل مسبقاً — سجّل الدخول بدل إنشاء حساب."
            raw.contains("Password should be", true) -> "كلمة المرور قصيرة — استخدم ٦ أحرف على الأقل."
            raw.contains("Unable to validate email", true) ||
                raw.contains("invalid format", true) -> "صيغة البريد الإلكتروني غير صحيحة."
            raw.contains("Email not confirmed", true) -> "فعّل البريد من رسالة التأكيد ثم سجّل الدخول."
            raw.contains("rate limit", true) -> "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة."
            response.code == 401 || response.code == 403 -> "انتهت الجلسة — سجّل الدخول من جديد."
            response.code == 404 -> "الخادم غير مهيأ بالكامل — راجع خطوات الإعداد."
            raw.isNotBlank() -> raw
            else -> "تعذّر إتمام الطلب (رمز ${response.code})."
        }
    }
}
