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

/** ألوان التمييز المتاحة في النسخة المدفوعة */
enum class AccentColor(val label: String, val argb: Long) {
    /** اللون الافتراضي — جمرة دافئة تناسب اللوحة الكريمية */
    EMBER("جمري", 0xFFE8743B),
    BLUE("أزرق", 0xFF2E9BF0),
    GREEN("أخضر", 0xFF3BA55D),
    VIOLET("بنفسجي", 0xFF7C6BD4),
    ORANGE("برتقالي", 0xFFF08A24),
    TEAL("فيروزي", 0xFF00A3A3),
    ROSE("وردي", 0xFFD4548E)
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
    val appLock: Boolean = false,
    val accentColor: AccentColor = AccentColor.EMBER,
    /** طول جلسة التركيز بالدقائق */
    val focusMinutes: Int = 25,
    /** طول الاستراحة بالدقائق */
    val breakMinutes: Int = 5,
    /** عدد مرات فتح شاشة الاشتراك — لتفادي إزعاج المستخدم */
    val paywallSeen: Int = 0
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
        val ACCENT = stringPreferencesKey("accent_color")
        val FOCUS_MINUTES = intPreferencesKey("focus_minutes")
        val BREAK_MINUTES = intPreferencesKey("break_minutes")
        val PAYWALL_SEEN = intPreferencesKey("paywall_seen")
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
            appLock = p[Keys.APP_LOCK] ?: false,
            accentColor = runCatching { AccentColor.valueOf(p[Keys.ACCENT] ?: "EMBER") }
                .getOrDefault(AccentColor.EMBER),
            focusMinutes = p[Keys.FOCUS_MINUTES] ?: 25,
            breakMinutes = p[Keys.BREAK_MINUTES] ?: 5,
            paywallSeen = p[Keys.PAYWALL_SEEN] ?: 0
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
    suspend fun setAccentColor(v: AccentColor) = context.dataStore.edit { it[Keys.ACCENT] = v.name }
    suspend fun setFocusMinutes(v: Int) = context.dataStore.edit { it[Keys.FOCUS_MINUTES] = v }
    suspend fun setBreakMinutes(v: Int) = context.dataStore.edit { it[Keys.BREAK_MINUTES] = v }
    suspend fun markPaywallSeen() = context.dataStore.edit {
        it[Keys.PAYWALL_SEEN] = (it[Keys.PAYWALL_SEEN] ?: 0) + 1
    }

    companion object {
        @Volatile private var INSTANCE: Prefs? = null
        fun get(context: Context): Prefs = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Prefs(context.applicationContext).also { INSTANCE = it }
        }
    }
}
