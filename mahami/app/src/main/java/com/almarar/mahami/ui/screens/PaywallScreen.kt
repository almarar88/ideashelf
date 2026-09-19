package com.almarar.mahami.ui.screens

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.billing.PlanId
import com.almarar.mahami.billing.PlanOffer
import com.almarar.mahami.billing.ProFeature
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme

/** شاشة الاشتراك: تعرض الخطط بأسعار Google Play وتفتح شاشة الدفع الرسمية */
@Composable
fun PaywallScreen(vm: MahamiViewModel, onClose: () -> Unit) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val state by vm.billingState.collectAsStateWithLifecycle()
    val entitlement by vm.entitlement.collectAsStateWithLifecycle()
    val highlighted by vm.lockedFeature.collectAsStateWithLifecycle()
    var selected by remember { mutableStateOf<PlanOffer?>(null) }

    LaunchedEffect(Unit) { vm.startBilling() }
    LaunchedEffect(state.offers) {
        if (selected == null) {
            selected = state.offers.firstOrNull { it.plan == PlanId.YEARLY } ?: state.offers.firstOrNull()
        }
    }
    LaunchedEffect(entitlement.isPro) {
        if (entitlement.isPro) {
            vm.clearLockedFeature()
            onClose()
        }
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(colors.tileSand, colors.background, colors.background))
            ),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable {
                            vm.clearLockedFeature()
                            onClose()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.Close, "إغلاق", tint = colors.inkSoft, modifier = Modifier.size(19.dp))
                }
                Spacer(Modifier.weight(1f))
            }
        }

        item {
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(AccentYellow.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.WorkspacePremium, null,
                        tint = AccentYellow, modifier = Modifier.size(38.dp)
                    )
                }
                Spacer(Modifier.height(14.dp))
                Text("مهامي بلس", style = MaterialTheme.typography.displayMedium, color = colors.ink)
                Spacer(Modifier.height(6.dp))
                Text(
                    highlighted?.let { "لفتح «${it.title}» وبقية المميزات" }
                        ?: "افتح كل المميزات وادعم تطوير التطبيق",
                    style = MaterialTheme.typography.bodyLarge,
                    color = colors.inkMuted,
                    textAlign = TextAlign.Center
                )
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 26.dp) {
                Column(Modifier.padding(18.dp)) {
                    ProFeature.entries.forEach { feature ->
                        val isHighlighted = feature == highlighted
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 7.dp)
                        ) {
                            Icon(
                                Icons.Rounded.CheckCircle, null,
                                tint = if (isHighlighted) AccentYellow else AccentGreen,
                                modifier = Modifier
                                    .padding(top = 3.dp)
                                    .size(17.dp)
                            )
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    feature.title,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = if (isHighlighted) colors.accent else colors.ink
                                )
                                Text(
                                    feature.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        if (state.loading && state.offers.isEmpty()) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(90.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = colors.accent, strokeWidth = 3.dp)
                }
            }
        }

        items(state.offers.size, key = { state.offers[it].plan.name }) { index ->
            val offer = state.offers[index]
            PlanCard(
                offer = offer,
                selected = selected?.plan == offer.plan,
                recommended = offer.plan == PlanId.YEARLY
            ) { selected = offer }
        }

        if (!state.loading && state.offers.isEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, color = colors.surfaceMuted, elevation = 0.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text(
                            "الأسعار غير متاحة الآن",
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.ink
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            state.message.ifBlank {
                                "تظهر الخطط بعد تثبيت التطبيق من متجر جوجل بلاي وإعداد المنتجات في Play Console."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                    }
                }
            }
        }

        item {
            val enabled = selected != null && !state.purchaseInProgress
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .clip(RoundedCornerShape(29.dp))
                    .background(if (enabled) colors.accent else colors.inkMuted)
                    .clickable(enabled = enabled) {
                        val activity = context as? Activity ?: return@clickable
                        selected?.let { vm.purchase(activity, it) }
                    },
                contentAlignment = Alignment.Center
            ) {
                if (state.purchaseInProgress) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(22.dp)
                    )
                } else {
                    Text(
                        selected?.let { offer ->
                            if (offer.freeTrialDays > 0) "ابدأ ${offer.freeTrialDays} أيام مجاناً"
                            else "اشترك الآن"
                        } ?: "اختر خطة",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White
                    )
                }
            }
        }

        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    "استعادة المشتريات",
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.accent,
                    modifier = Modifier
                        .clickable { vm.restorePurchases() }
                        .padding(10.dp)
                )
            }
        }

        if (state.message.isNotBlank()) {
            item {
                Text(
                    state.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = AccentYellow,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            Text(
                "الدفع يتم عبر حسابك في متجر جوجل بلاي، ويتجدد الاشتراك تلقائياً حتى تلغيه " +
                    "من إعدادات المتجر. خطة «مدى الحياة» دفعة واحدة بلا تجديد.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun PlanCard(
    offer: PlanOffer,
    selected: Boolean,
    recommended: Boolean,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(if (selected) colors.accent.copy(alpha = 0.10f) else colors.surface)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) colors.accent else colors.hairline,
                shape = RoundedCornerShape(26.dp)
            )
            .clickable { onClick() }
            .padding(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        offer.plan.label,
                        style = MaterialTheme.typography.titleLarge,
                        color = colors.ink
                    )
                    if (recommended) {
                        Spacer(Modifier.width(8.dp))
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(AccentGreen.copy(alpha = 0.16f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                "الأوفر",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentGreen
                            )
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    if (offer.freeTrialDays > 0) "${offer.period} • ${offer.freeTrialDays} أيام تجربة مجانية"
                    else offer.period,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted
                )
            }
            Text(
                offer.price,
                style = MaterialTheme.typography.headlineSmall,
                color = if (selected) colors.accent else colors.ink
            )
        }
    }
}
