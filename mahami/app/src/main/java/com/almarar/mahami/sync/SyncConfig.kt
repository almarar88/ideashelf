package com.almarar.mahami.sync

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.almarar.mahami.BuildConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.syncStore by preferencesDataStore("mahami_sync")

/** جلسة المستخدم المسجّل */
data class Session(
    val accessToken: String = "",
    val refreshToken: String = "",
    val userId: String = "",
    val email: String = "",
    val expiresAt: Long = 0L,
    val lastSync: Long = 0L
) {
    val signedIn: Boolean get() = accessToken.isNotBlank() && userId.isNotBlank()
    val expired: Boolean get() = expiresAt > 0 && System.currentTimeMillis() > expiresAt - 60_000
}

/**
 * إعدادات خادم المزامنة.
 * تُقرأ من BuildConfig (تُضبط مرة واحدة عند البناء)،
 * ويمكن تجاوزها من شاشة الإعدادات المتقدمة أثناء التجربة.
 */
class SyncConfig(private val context: Context) {

    private object Keys {
        val URL = stringPreferencesKey("supabase_url")
        val KEY = stringPreferencesKey("supabase_key")
        val ACCESS = stringPreferencesKey("access_token")
        val REFRESH = stringPreferencesKey("refresh_token")
        val USER = stringPreferencesKey("user_id")
        val EMAIL = stringPreferencesKey("email")
        val EXPIRES = longPreferencesKey("expires_at")
        val LAST_SYNC = longPreferencesKey("last_sync")
    }

    val session: Flow<Session> = context.syncStore.data.map { p ->
        Session(
            accessToken = p[Keys.ACCESS].orEmpty(),
            refreshToken = p[Keys.REFRESH].orEmpty(),
            userId = p[Keys.USER].orEmpty(),
            email = p[Keys.EMAIL].orEmpty(),
            expiresAt = p[Keys.EXPIRES] ?: 0L,
            lastSync = p[Keys.LAST_SYNC] ?: 0L
        )
    }

    suspend fun currentSession(): Session = session.first()

    suspend fun baseUrl(): String {
        val override = context.syncStore.data.first()[Keys.URL].orEmpty()
        return (override.ifBlank { BuildConfig.SUPABASE_URL }).trimEnd('/')
    }

    suspend fun anonKey(): String {
        val override = context.syncStore.data.first()[Keys.KEY].orEmpty()
        return override.ifBlank { BuildConfig.SUPABASE_ANON_KEY }
    }

    /** هل أُعدّت المزامنة أصلاً؟ */
    suspend fun isConfigured(): Boolean = baseUrl().isNotBlank() && anonKey().isNotBlank()

    suspend fun setServer(url: String, key: String) = context.syncStore.edit {
        it[Keys.URL] = url.trim()
        it[Keys.KEY] = key.trim()
    }

    suspend fun saveSession(
        accessToken: String,
        refreshToken: String,
        userId: String,
        email: String,
        expiresInSeconds: Long
    ) = context.syncStore.edit {
        it[Keys.ACCESS] = accessToken
        it[Keys.REFRESH] = refreshToken
        it[Keys.USER] = userId
        it[Keys.EMAIL] = email
        it[Keys.EXPIRES] = System.currentTimeMillis() + expiresInSeconds * 1000
    }

    suspend fun clearSession() = context.syncStore.edit {
        it.remove(Keys.ACCESS)
        it.remove(Keys.REFRESH)
        it.remove(Keys.USER)
        it.remove(Keys.EMAIL)
        it.remove(Keys.EXPIRES)
        it.remove(Keys.LAST_SYNC)
    }

    suspend fun markSynced(at: Long = System.currentTimeMillis()) = context.syncStore.edit {
        it[Keys.LAST_SYNC] = at
    }

    companion object {
        @Volatile private var INSTANCE: SyncConfig? = null
        fun get(context: Context): SyncConfig = INSTANCE ?: synchronized(this) {
            INSTANCE ?: SyncConfig(context.applicationContext).also { INSTANCE = it }
        }
    }
}
