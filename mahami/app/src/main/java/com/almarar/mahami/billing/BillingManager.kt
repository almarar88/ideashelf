package com.almarar.mahami.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/** خطة معروضة في شاشة الاشتراك بعد جلب سعرها من Google Play */
data class PlanOffer(
    val plan: PlanId,
    val price: String,
    val period: String,
    val details: ProductDetails,
    val offerToken: String? = null,
    val freeTrialDays: Int = 0
)

data class BillingState(
    val connected: Boolean = false,
    val loading: Boolean = true,
    val offers: List<PlanOffer> = emptyList(),
    val message: String = "",
    val purchaseInProgress: Boolean = false,
    /** المتجر غير متاح على هذا الجهاز (نسخة بلا خدمات جوجل مثلاً) */
    val storeUnavailable: Boolean = false
)

/**
 * غلاف مبسّط حول Google Play Billing:
 * يتصل بالمتجر، يجلب الأسعار، يطلق عملية الشراء،
 * ويحدّث حالة الاشتراك المحلية من مشتريات الحساب.
 */
class BillingManager private constructor(private val context: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val store = EntitlementStore.get(context)

    private val _state = MutableStateFlow(BillingState())
    val state = _state.asStateFlow()

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                scope.launch { handlePurchases(purchases.orEmpty()) }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                _state.value = _state.value.copy(purchaseInProgress = false, message = "")
            }
            else -> {
                _state.value = _state.value.copy(
                    purchaseInProgress = false,
                    message = describe(result)
                )
            }
        }
    }

    private val client: BillingClient = BillingClient.newBuilder(context)
        .setListener(purchasesListener)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    /** يتصل بالمتجر ثم يجلب الأسعار ويتحقق من المشتريات القائمة */
    fun start() {
        if (client.isReady) {
            scope.launch { refresh() }
            return
        }
        client.startConnection(object : com.android.billingclient.api.BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    _state.value = _state.value.copy(connected = true, storeUnavailable = false)
                    scope.launch { refresh() }
                } else {
                    _state.value = _state.value.copy(
                        connected = false,
                        loading = false,
                        storeUnavailable = true,
                        message = describe(result)
                    )
                }
            }

            override fun onBillingServiceDisconnected() {
                _state.value = _state.value.copy(connected = false)
            }
        })
    }

    private suspend fun refresh() {
        loadOffers()
        restorePurchases()
    }

    private suspend fun loadOffers() {
        val subProducts = PlanId.subscriptionIds.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        val oneTimeProducts = PlanId.oneTimeIds.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        }

        val offers = mutableListOf<PlanOffer>()
        offers += querySubscriptions(subProducts)
        offers += queryOneTime(oneTimeProducts)

        _state.value = _state.value.copy(
            offers = offers.sortedBy { it.plan.ordinal },
            loading = false,
            message = if (offers.isEmpty()) {
                "تعذّر جلب الأسعار من المتجر. تأكد من الاتصال ومن إعداد المنتجات في Play Console."
            } else ""
        )
    }

    private suspend fun querySubscriptions(
        products: List<QueryProductDetailsParams.Product>
    ): List<PlanOffer> {
        if (products.isEmpty()) return emptyList()
        val result = client.queryProductDetails(
            QueryProductDetailsParams.newBuilder().setProductList(products).build()
        )
        val list = result.productDetailsList.orEmpty()
        return list.mapNotNull { details ->
            val plan = PlanId.from(details.productId) ?: return@mapNotNull null
            val offer = details.subscriptionOfferDetails?.minByOrNull { candidate ->
                candidate.pricingPhases.pricingPhaseList.sumOf { it.priceAmountMicros }
            } ?: return@mapNotNull null
            val paidPhase = offer.pricingPhases.pricingPhaseList.lastOrNull() ?: return@mapNotNull null
            val trialPhase = offer.pricingPhases.pricingPhaseList.firstOrNull { it.priceAmountMicros == 0L }
            PlanOffer(
                plan = plan,
                price = paidPhase.formattedPrice,
                period = periodLabel(paidPhase.billingPeriod),
                details = details,
                offerToken = offer.offerToken,
                freeTrialDays = trialPhase?.billingPeriod?.let { daysOf(it) } ?: 0
            )
        }
    }

    private suspend fun queryOneTime(
        products: List<QueryProductDetailsParams.Product>
    ): List<PlanOffer> {
        if (products.isEmpty()) return emptyList()
        val result = client.queryProductDetails(
            QueryProductDetailsParams.newBuilder().setProductList(products).build()
        )
        return result.productDetailsList.orEmpty().mapNotNull { details ->
            val plan = PlanId.from(details.productId) ?: return@mapNotNull null
            val price = details.oneTimePurchaseOfferDetails?.formattedPrice ?: return@mapNotNull null
            PlanOffer(plan = plan, price = price, period = "دفعة واحدة", details = details)
        }
    }

    /** يفتح شاشة الدفع الرسمية من Google Play */
    fun purchase(activity: Activity, offer: PlanOffer) {
        val paramsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(offer.details)
        offer.offerToken?.let { paramsBuilder.setOfferToken(it) }

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(paramsBuilder.build()))
            .build()

        _state.value = _state.value.copy(purchaseInProgress = true, message = "")
        val result = client.launchBillingFlow(activity, flowParams)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            _state.value = _state.value.copy(
                purchaseInProgress = false,
                message = describe(result)
            )
        }
    }

    /** يستعيد المشتريات السابقة لنفس حساب جوجل */
    fun restore() {
        scope.launch {
            val before = _state.value
            _state.value = before.copy(loading = true)
            restorePurchases()
            _state.value = _state.value.copy(
                loading = false,
                message = "تم التحقق من مشترياتك"
            )
        }
    }

    private suspend fun restorePurchases() {
        val subs = client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        ).purchasesList
        val oneTime = client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ).purchasesList

        val all = subs + oneTime
        if (all.none { it.purchaseState == Purchase.PurchaseState.PURCHASED }) {
            store.revoke()
        } else {
            handlePurchases(all)
        }
    }

    private suspend fun handlePurchases(purchases: List<Purchase>) {
        var granted = false
        purchases.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }.forEach { purchase ->
            val productId = purchase.products.firstOrNull { PlanId.from(it) != null } ?: return@forEach
            store.grant(productId)
            granted = true
            if (!purchase.isAcknowledged) {
                runCatching {
                    client.acknowledgePurchase(
                        AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.purchaseToken)
                            .build()
                    )
                }
            }
        }
        _state.value = _state.value.copy(
            purchaseInProgress = false,
            message = if (granted) "تم تفعيل النسخة الكاملة" else _state.value.message
        )
    }

    private fun describe(result: BillingResult): String = when (result.responseCode) {
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE ->
            "خدمة الدفع غير متاحة على هذا الجهاز."
        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE ->
            "المنتج غير متاح حالياً في حسابك أو بلدك."
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ->
            "أنت مشترك بالفعل — اضغط «استعادة المشتريات»."
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE ->
            "تعذّر الاتصال بمتجر جوجل. تحقق من الإنترنت."
        BillingClient.BillingResponseCode.DEVELOPER_ERROR ->
            "إعداد المنتجات غير مكتمل في Play Console."
        else -> result.debugMessage.ifBlank { "تعذّر إتمام العملية." }
    }

    private fun periodLabel(isoPeriod: String): String = when (isoPeriod) {
        "P1W" -> "أسبوعياً"
        "P1M" -> "شهرياً"
        "P3M" -> "كل ثلاثة أشهر"
        "P6M" -> "كل ستة أشهر"
        "P1Y" -> "سنوياً"
        else -> isoPeriod
    }

    private fun daysOf(isoPeriod: String): Int = when {
        isoPeriod.startsWith("P") && isoPeriod.endsWith("D") ->
            isoPeriod.drop(1).dropLast(1).toIntOrNull() ?: 0
        isoPeriod == "P1W" -> 7
        isoPeriod == "P2W" -> 14
        isoPeriod == "P1M" -> 30
        else -> 0
    }

    fun clearMessage() {
        _state.value = _state.value.copy(message = "")
    }

    companion object {
        @Volatile private var INSTANCE: BillingManager? = null
        fun get(context: Context): BillingManager = INSTANCE ?: synchronized(this) {
            INSTANCE ?: BillingManager(context.applicationContext).also { INSTANCE = it }
        }
    }
}
