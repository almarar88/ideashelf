package com.almarar.mahami.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.InfoRow
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.MahamiTheme

private val privacyPoints = listOf(
    "كل مهامك ومواعيدك تُحفظ على جهازك فقط، داخل قاعدة بيانات خاصة بالتطبيق.",
    "لا يطلب التطبيق إذن الإنترنت أصلاً، ولا يمكنه إرسال بياناتك إلى أي خادم.",
    "لا يجمع التطبيق أي معلومات شخصية، ولا يستخدم أدوات تتبّع أو إعلانات.",
    "نسخة الأمان تُنشأ بطلبك أنت فقط، وتُشارَك عبر التطبيق الذي تختاره.",
    "حذف التطبيق يحذف كل بياناته من الجهاز."
)

@Composable
fun AboutScreen(onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val version = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
    }.getOrNull() ?: "1.0.0"

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Text("عن التطبيق", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), color = colors.tileSky, corner = 28.dp) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("مهامي", style = MaterialTheme.typography.displayMedium, color = colors.ink)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "منظّم المهام والمواعيد — يعمل دون إنترنت",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkMuted
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "الإصدار $version",
                        style = MaterialTheme.typography.labelLarge,
                        color = colors.accent
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("الخصوصية", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(10.dp))
                    privacyPoints.forEach { point ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                        ) {
                            Icon(
                                Icons.Rounded.CheckCircle, null,
                                tint = AccentGreen,
                                modifier = Modifier
                                    .padding(top = 3.dp)
                                    .size(16.dp)
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                point,
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkSoft
                            )
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("الأذونات المستخدمة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(8.dp))
                    InfoRow("الإشعارات", "لعرض تنبيهات المهام")
                    InfoRow("المنبهات الدقيقة", "لوصول التنبيه في وقته")
                    InfoRow("بعد إعادة التشغيل", "لإعادة جدولة التنبيهات")
                    InfoRow("البصمة", "لقفل التطبيق إن فعّلته")
                    InfoRow("الإنترنت", "غير مطلوب")
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, color = colors.surfaceMuted, elevation = 0.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("تراخيص مفتوحة المصدر", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "خط Tajawal — رخصة SIL Open Font License 1.1\n" +
                            "مكتبات AndroidX و Jetpack Compose — رخصة Apache 2.0",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    "صُنع للاستخدام اليومي في بيئة عمل عربية",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted
                )
            }
        }
    }
}
