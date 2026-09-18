package com.almarar.mahami.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("mahami_settings")

enum class ThemeMode(val label: String) {
    SYSTEM("حسب النظام"), LIGHT("فاتح"), DARK("داكن")
}

enum class CalendarView(val label: String) {
    MONTH("شهري"), WEEK("أسبوعي")
}

data class Settings(
    val onboarded: Boolean = false,
    val userName: String = "",
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val notificationsEnabled: Boolean = true,
    val dailyDigest: Boolean = true,
    val digestHour: Int = 8,
    val defaultReminderOffsets: List<Int> = listOf(1, 0),
    val calendarView: CalendarView = CalendarView.MONTH,
    val appLock: Boolean = false
)

class Prefs(private val context: Context) {

    private object Keys {
        val ONBOARDED = booleanPreferencesKey("onboarded")
        val NAME = stringPreferencesKey("user_name")
        val THEME = stringPreferencesKey("theme_mode")
        val NOTIFS = booleanPreferencesKey("notifications")
        val DIGEST = booleanPreferencesKey("daily_digest")
        val DIGEST_HOUR = intPreferencesKey("digest_hour")
        val REMINDERS = stringPreferencesKey("default_reminders")
        val CALENDAR_VIEW = stringPreferencesKey("calendar_view")
        val APP_LOCK = booleanPreferencesKey("app_lock")
    }

    val settings: Flow<Settings> = context.dataStore.data.map { p ->
        Settings(
            onboarded = p[Keys.ONBOARDED] ?: false,
            userName = p[Keys.NAME].orEmpty(),
            themeMode = runCatching { ThemeMode.valueOf(p[Keys.THEME] ?: "SYSTEM") }
                .getOrDefault(ThemeMode.SYSTEM),
            notificationsEnabled = p[Keys.NOTIFS] ?: true,
            dailyDigest = p[Keys.DIGEST] ?: true,
            digestHour = p[Keys.DIGEST_HOUR] ?: 8,
            defaultReminderOffsets = (p[Keys.REMINDERS] ?: "1,0")
                .split(",").mapNotNull { it.trim().toIntOrNull() }.ifEmpty { listOf(0) },
            calendarView = runCatching { CalendarView.valueOf(p[Keys.CALENDAR_VIEW] ?: "MONTH") }
                .getOrDefault(CalendarView.MONTH),
            appLock = p[Keys.APP_LOCK] ?: false
        )
    }

    suspend fun setOnboarded(v: Boolean) = context.dataStore.edit { it[Keys.ONBOARDED] = v }
    suspend fun setUserName(v: String) = context.dataStore.edit { it[Keys.NAME] = v }
    suspend fun setThemeMode(v: ThemeMode) = context.dataStore.edit { it[Keys.THEME] = v.name }
    suspend fun setNotifications(v: Boolean) = context.dataStore.edit { it[Keys.NOTIFS] = v }
    suspend fun setDailyDigest(v: Boolean) = context.dataStore.edit { it[Keys.DIGEST] = v }
    suspend fun setDigestHour(v: Int) = context.dataStore.edit { it[Keys.DIGEST_HOUR] = v }
    suspend fun setDefaultReminders(v: List<Int>) =
        context.dataStore.edit { it[Keys.REMINDERS] = v.joinToString(",") }
    suspend fun setCalendarView(v: CalendarView) =
        context.dataStore.edit { it[Keys.CALENDAR_VIEW] = v.name }
    suspend fun setAppLock(v: Boolean) = context.dataStore.edit { it[Keys.APP_LOCK] = v }

    companion object {
        @Volatile private var INSTANCE: Prefs? = null
        fun get(context: Context): Prefs = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Prefs(context.applicationContext).also { INSTANCE = it }
        }
    }
}
