package ai.pacto.app.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Calendar

enum class Plan { FREE, PRO }

data class SettingsState(
    val plan: Plan = Plan.FREE,
    val contractsUsedThisMonth: Int = 0,
    val freeMonthlyQuota: Int = 5,
    val feeBasisPoints: Int = 125,
    val overlayEnabled: Boolean = false,
    val currentPartyId: String = "me",
    val displayName: String = "أنا",
    val currency: String = "SAR"
) {
    val contractsLeft: Int
        get() = if (plan == Plan.PRO) Int.MAX_VALUE else (freeMonthlyQuota - contractsUsedThisMonth).coerceAtLeast(0)

    val canCreateContract: Boolean get() = plan == Plan.PRO || contractsLeft > 0
}

/**
 * Monetisation state lives here: the free tier counts contracts per month, Pro lifts the cap,
 * and the escrow fee in basis points is what the ledger charges on every release.
 */
class AppSettings(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("pacto_settings", Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(read())
    val state: StateFlow<SettingsState> = _state.asStateFlow()

    private fun read(): SettingsState {
        rollOverMonthIfNeeded()
        return SettingsState(
            plan = if (prefs.getBoolean(KEY_PRO, false)) Plan.PRO else Plan.FREE,
            contractsUsedThisMonth = prefs.getInt(KEY_USED, 0),
            freeMonthlyQuota = prefs.getInt(KEY_QUOTA, 5),
            feeBasisPoints = prefs.getInt(KEY_FEE_BPS, 125),
            overlayEnabled = prefs.getBoolean(KEY_OVERLAY, false),
            currentPartyId = prefs.getString(KEY_PARTY_ID, "me") ?: "me",
            displayName = prefs.getString(KEY_NAME, "أنا") ?: "أنا",
            currency = prefs.getString(KEY_CURRENCY, "SAR") ?: "SAR"
        )
    }

    private fun rollOverMonthIfNeeded() {
        val now = Calendar.getInstance()
        val key = now.get(Calendar.YEAR) * 100 + now.get(Calendar.MONTH)
        if (prefs.getInt(KEY_PERIOD, 0) != key) {
            prefs.edit().putInt(KEY_PERIOD, key).putInt(KEY_USED, 0).apply()
        }
    }

    fun recordContractCreated() {
        prefs.edit().putInt(KEY_USED, prefs.getInt(KEY_USED, 0) + 1).apply()
        _state.value = read()
    }

    fun setPlan(plan: Plan) {
        prefs.edit().putBoolean(KEY_PRO, plan == Plan.PRO).apply()
        _state.value = read()
    }

    fun setOverlayEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_OVERLAY, enabled).apply()
        _state.value = read()
    }

    fun setFeeBasisPoints(bps: Int) {
        prefs.edit().putInt(KEY_FEE_BPS, bps.coerceIn(100, 150)).apply()
        _state.value = read()
    }

    fun setProfile(name: String, currency: String) {
        prefs.edit().putString(KEY_NAME, name).putString(KEY_CURRENCY, currency).apply()
        _state.value = read()
    }

    private companion object {
        const val KEY_PRO = "plan_pro"
        const val KEY_USED = "contracts_used"
        const val KEY_QUOTA = "free_quota"
        const val KEY_FEE_BPS = "fee_bps"
        const val KEY_OVERLAY = "overlay_enabled"
        const val KEY_PARTY_ID = "party_id"
        const val KEY_NAME = "display_name"
        const val KEY_CURRENCY = "currency"
        const val KEY_PERIOD = "quota_period"
    }
}
