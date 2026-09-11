package com.almarar.mahami.ai

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * يخزّن مفتاح Claude مشفّراً عبر Android Keystore.
 * يسقط إلى تخزين عادي فقط إذا فشل التشفير على الجهاز.
 */
class SecureKeyStore(context: Context) {

    private val prefs: SharedPreferences = runCatching {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "mahami_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        ) as SharedPreferences
    }.getOrElse {
        context.getSharedPreferences("mahami_secure_plain", Context.MODE_PRIVATE)
    }

    var apiKey: String?
        get() = prefs.getString(KEY, null)?.takeIf { it.isNotBlank() }
        set(value) {
            prefs.edit().apply {
                if (value.isNullOrBlank()) remove(KEY) else putString(KEY, value.trim())
            }.apply()
        }

    /** يعرض المفتاح مخفياً: sk-ant-••••4f2a */
    fun maskedKey(): String? {
        val key = apiKey ?: return null
        return if (key.length <= 12) "••••" else key.take(7) + "••••" + key.takeLast(4)
    }

    companion object {
        private const val KEY = "anthropic_api_key"

        @Volatile private var INSTANCE: SecureKeyStore? = null
        fun get(context: Context): SecureKeyStore = INSTANCE ?: synchronized(this) {
            INSTANCE ?: SecureKeyStore(context.applicationContext).also { INSTANCE = it }
        }
    }
}
