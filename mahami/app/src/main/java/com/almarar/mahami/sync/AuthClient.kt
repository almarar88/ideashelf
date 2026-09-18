package com.almarar.mahami.sync

import android.content.Context
import org.json.JSONObject

/** نتيجة عملية مصادقة */
sealed interface AuthResult {
    data class Success(val email: String) : AuthResult
    data class NeedsEmailConfirmation(val email: String) : AuthResult
    data class Failure(val message: String) : AuthResult
}

/**
 * مصادقة المستخدم عبر Supabase Auth بالبريد وكلمة المرور.
 * الجلسة تُحفظ محلياً فيبقى المستخدم مسجّلاً بعد إغلاق التطبيق.
 */
class AuthClient(private val context: Context) {

    private val config = SyncConfig.get(context)

    private suspend fun headers(): Map<String, String> = mapOf(
        "apikey" to config.anonKey(),
        "Authorization" to "Bearer ${config.anonKey()}"
    )

    suspend fun signUp(email: String, password: String): AuthResult {
        if (!config.isConfigured()) return AuthResult.Failure(NOT_CONFIGURED)
        val response = Http.request(
            url = "${config.baseUrl()}/auth/v1/signup",
            method = "POST",
            headers = headers(),
            body = JSONObject()
                .put("email", email.trim())
                .put("password", password)
                .toString()
        )
        if (!response.success) return AuthResult.Failure(Http.describe(response))

        val json = response.asObject()
        val accessToken = json.optString("access_token")
        return if (accessToken.isBlank()) {
            // المشروع يطلب تأكيد البريد قبل تفعيل الحساب
            AuthResult.NeedsEmailConfirmation(email.trim())
        } else {
            persist(json, email.trim())
            AuthResult.Success(email.trim())
        }
    }

    suspend fun signIn(email: String, password: String): AuthResult {
        if (!config.isConfigured()) return AuthResult.Failure(NOT_CONFIGURED)
        val response = Http.request(
            url = "${config.baseUrl()}/auth/v1/token?grant_type=password",
            method = "POST",
            headers = headers(),
            body = JSONObject()
                .put("email", email.trim())
                .put("password", password)
                .toString()
        )
        if (!response.success) return AuthResult.Failure(Http.describe(response))
        persist(response.asObject(), email.trim())
        return AuthResult.Success(email.trim())
    }

    /** يجدّد رمز الوصول عند انتهائه */
    suspend fun refresh(): Boolean {
        val session = config.currentSession()
        if (session.refreshToken.isBlank() || !config.isConfigured()) return false
        val response = Http.request(
            url = "${config.baseUrl()}/auth/v1/token?grant_type=refresh_token",
            method = "POST",
            headers = headers(),
            body = JSONObject().put("refresh_token", session.refreshToken).toString()
        )
        if (!response.success) return false
        persist(response.asObject(), session.email)
        return true
    }

    /** يعيد رمز وصول صالحاً، ويجدّده تلقائياً إن لزم */
    suspend fun validAccessToken(): String? {
        val session = config.currentSession()
        if (!session.signedIn) return null
        if (!session.expired) return session.accessToken
        return if (refresh()) config.currentSession().accessToken else null
    }

    suspend fun sendPasswordReset(email: String): AuthResult {
        if (!config.isConfigured()) return AuthResult.Failure(NOT_CONFIGURED)
        val response = Http.request(
            url = "${config.baseUrl()}/auth/v1/recover",
            method = "POST",
            headers = headers(),
            body = JSONObject().put("email", email.trim()).toString()
        )
        return if (response.success) AuthResult.Success(email.trim())
        else AuthResult.Failure(Http.describe(response))
    }

    suspend fun signOut() {
        val token = config.currentSession().accessToken
        if (token.isNotBlank() && config.isConfigured()) {
            runCatching {
                Http.request(
                    url = "${config.baseUrl()}/auth/v1/logout",
                    method = "POST",
                    headers = headers() + ("Authorization" to "Bearer $token")
                )
            }
        }
        config.clearSession()
    }

    /**
     * حذف الحساب نهائياً — متطلب إلزامي في سياسات جوجل بلاي لأي تطبيق فيه حسابات.
     * يستدعي دالة delete_account() المعرّفة في قاعدة البيانات.
     */
    suspend fun deleteAccount(): AuthResult {
        val token = validAccessToken() ?: return AuthResult.Failure("سجّل الدخول أولاً.")
        val response = Http.request(
            url = "${config.baseUrl()}/rest/v1/rpc/delete_account",
            method = "POST",
            headers = mapOf(
                "apikey" to config.anonKey(),
                "Authorization" to "Bearer $token"
            ),
            body = "{}"
        )
        return if (response.success) {
            config.clearSession()
            AuthResult.Success("")
        } else {
            AuthResult.Failure(Http.describe(response))
        }
    }

    private suspend fun persist(json: JSONObject, fallbackEmail: String) {
        val user = json.optJSONObject("user")
        config.saveSession(
            accessToken = json.optString("access_token"),
            refreshToken = json.optString("refresh_token"),
            userId = user?.optString("id").orEmpty(),
            email = user?.optString("email").orEmpty().ifBlank { fallbackEmail },
            expiresInSeconds = json.optLong("expires_in", 3600)
        )
    }

    companion object {
        const val NOT_CONFIGURED =
            "المزامنة غير مفعّلة في هذه النسخة. راجع SYNC-SETUP.md لإعداد الخادم."

        @Volatile private var INSTANCE: AuthClient? = null
        fun get(context: Context): AuthClient = INSTANCE ?: synchronized(this) {
            INSTANCE ?: AuthClient(context.applicationContext).also { INSTANCE = it }
        }
    }
}
