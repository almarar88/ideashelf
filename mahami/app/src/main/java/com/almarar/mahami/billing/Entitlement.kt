package com.almarar.mahami.billing

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.entitlementStore by preferencesDataStore("mahami_entitlement")

/** حالة اشتراك المستخدم كما يعرفها التطبيق محلياً */
data class Entitlement(
    val isPro: Boolean = false,
    val planId: String = "",
    val since: Long = 0L,
    /** آخر تحقق ناجح من Google Play */
    val lastVerified: Long = 0L
) {
    val planLabel: String
        get() = PlanId.from(planId)?.label ?: ""
}

/**
 * تخزين محلي لحالة الاشتراك حتى يعمل التطبيق دون إنترنت،
 * ويُحدَّث كلما ردّ Google Play بحالة المشتريات.
 */
class EntitlementStore(private val context: Context) {

    private object Keys {
        val IS_PRO = booleanPreferencesKey("is_pro")
        val PLAN = stringPreferencesKey("plan_id")
        val SINCE = longPreferencesKey("since")
        val VERIFIED = longPreferencesKey("last_verified")
    }

    val entitlement: Flow<Entitlement> = context.entitlementStore.data.map { p ->
        Entitlement(
            isPro = p[Keys.IS_PRO] ?: false,
            planId = p[Keys.PLAN].orEmpty(),
            since = p[Keys.SINCE] ?: 0L,
            lastVerified = p[Keys.VERIFIED] ?: 0L
        )
    }

    suspend fun grant(planId: String) = context.entitlementStore.edit { p ->
        if (p[Keys.IS_PRO] != true) p[Keys.SINCE] = System.currentTimeMillis()
        p[Keys.IS_PRO] = true
        p[Keys.PLAN] = planId
        p[Keys.VERIFIED] = System.currentTimeMillis()
    }

    suspend fun revoke() = context.entitlementStore.edit { p ->
        p[Keys.IS_PRO] = false
        p[Keys.PLAN] = ""
        p[Keys.VERIFIED] = System.currentTimeMillis()
    }

    /** يُستخدم للتجربة أثناء التطوير فقط */
    suspend fun setDeveloperOverride(value: Boolean) = context.entitlementStore.edit { p ->
        p[Keys.IS_PRO] = value
        p[Keys.PLAN] = if (value) "developer" else ""
    }

    companion object {
        @Volatile private var INSTANCE: EntitlementStore? = null
        fun get(context: Context): EntitlementStore = INSTANCE ?: synchronized(this) {
            INSTANCE ?: EntitlementStore(context.applicationContext).also { INSTANCE = it }
        }
    }
}
