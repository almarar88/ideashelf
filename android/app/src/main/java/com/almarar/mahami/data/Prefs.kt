package com.almarar.mahami.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("mahami_prefs")

data class Settings(
    val onboarded: Boolean = false,
    val userName: String = "أبو راشد",
    val darkMode: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val dailyDigest: Boolean = true,
    val digestHour: Int = 8
)

class Prefs(private val context: Context) {

    private object Keys {
        val ONBOARDED = booleanPreferencesKey("onboarded")
        val NAME = stringPreferencesKey("user_name")
        val DARK = booleanPreferencesKey("dark_mode")
        val NOTIFS = booleanPreferencesKey("notifications")
        val DIGEST = booleanPreferencesKey("daily_digest")
        val DIGEST_HOUR = intPreferencesKey("digest_hour")
    }

    val settings: Flow<Settings> = context.dataStore.data.map { p ->
        Settings(
            onboarded = p[Keys.ONBOARDED] ?: false,
            userName = p[Keys.NAME] ?: "أبو راشد",
            darkMode = p[Keys.DARK] ?: false,
            notificationsEnabled = p[Keys.NOTIFS] ?: true,
            dailyDigest = p[Keys.DIGEST] ?: true,
            digestHour = p[Keys.DIGEST_HOUR] ?: 8
        )
    }

    suspend fun setOnboarded(v: Boolean) = context.dataStore.edit { it[Keys.ONBOARDED] = v }
    suspend fun setUserName(v: String) = context.dataStore.edit { it[Keys.NAME] = v }
    suspend fun setDarkMode(v: Boolean) = context.dataStore.edit { it[Keys.DARK] = v }
    suspend fun setNotifications(v: Boolean) = context.dataStore.edit { it[Keys.NOTIFS] = v }
    suspend fun setDailyDigest(v: Boolean) = context.dataStore.edit { it[Keys.DIGEST] = v }
    suspend fun setDigestHour(v: Int) = context.dataStore.edit { it[Keys.DIGEST_HOUR] = v }

    companion object {
        @Volatile private var INSTANCE: Prefs? = null
        fun get(context: Context): Prefs = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Prefs(context.applicationContext).also { INSTANCE = it }
        }
    }
}
