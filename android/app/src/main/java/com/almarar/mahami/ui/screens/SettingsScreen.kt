package com.almarar.mahami.ui.screens

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.text.input.PasswordVisualTransformation
import com.almarar.mahami.ai.AiModel
import com.almarar.mahami.notify.NotificationHelper
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme

@Composable
fun SettingsScreen(vm: MahamiViewModel, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val settings by vm.settings.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    val connectionTest by vm.connectionTest.collectAsStateWithLifecycle()
    val backupNotice by vm.backupNotice.collectAsStateWithLifecycle()
    var keyInput by remember { mutableStateOf("") }
    var maskedKey by remember { mutableStateOf(vm.maskedApiKey()) }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let { vm.importBackup(it, replace = false) } }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Text("الإعدادات", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), color = colors.tileSky, corner = 28.dp) {
                Column(Modifier.padding(20.dp)) {
                    Text("الاسم المعروض", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                    Spacer(Modifier.height(8.dp))
                    BasicTextField(
                        value = settings.userName,
                        onValueChange = vm::setUserName,
                        singleLine = true,
                        textStyle = MaterialTheme.typography.headlineSmall.copy(color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "${stats.total} مهمة • ${stats.done} مكتملة • ${stats.late} متأخرة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(6.dp)) {
                    ToggleRow(
                        "تنبيهات المهام",
                        "تذكير قبل الموعد النهائي وعند حلوله",
                        settings.notificationsEnabled
                    ) { vm.setNotifications(it) }
                    ToggleRow(
                        "الملخص اليومي",
                        "إشعار صباحي بمهام اليوم والمتأخرات",
                        settings.dailyDigest
                    ) { vm.setDailyDigest(it) }
                    ToggleRow(
                        "الوضع الليلي",
                        "ألوان داكنة مريحة للعين",
                        settings.darkMode
                    ) { vm.setDarkMode(it) }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("وقت الملخص اليومي", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(6, 7, 8, 9, 10).forEach { hour ->
                            val selected = settings.digestHour == hour
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(if (selected) colors.ink else colors.surfaceMuted)
                                    .clickable { vm.setDigestHour(hour) }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "$hour ص",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (selected) Color.White else colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            ActionRow("أذونات التنبيهات في النظام", "افتح إعدادات الإشعارات للتطبيق") {
                val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                context.startActivity(intent)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            item {
                ActionRow("التنبيهات الدقيقة", "اسمح بالمنبهات في الوقت المحدد بالضبط") {
                    runCatching {
                        context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
                    }
                }
            }
        }

        item {
            ActionRow("تجربة التنبيه الآن", "إرسال إشعار تجريبي للتأكد من عمل التنبيهات") {
                NotificationHelper.createChannels(context)
                val tasks = vm.tasks.value
                if (tasks.isNotEmpty()) {
                    NotificationHelper.notifyTask(context, tasks.first(), "تنبيه تجريبي")
                }
            }
        }

        item {
            ActionRow("إعادة تحميل المهام الأساسية", "يستعيد المهام الخمس الأصلية بمواعيدها") {
                vm.restoreSeed()
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Rounded.AutoAwesome, null,
                            tint = colors.accent, modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("المميزات الذكية (Claude)", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "أدخل مفتاح Anthropic API لتفعيل الاستخراج الذكي والمحادثة وصياغة الرسائل. " +
                            "يُحفظ المفتاح مشفّراً على جهازك فقط، ولا يُرسل إلا إلى خوادم Anthropic.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                    Spacer(Modifier.height(14.dp))

                    if (maskedKey != null) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(colors.surfaceMuted)
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                maskedKey ?: "",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkSoft
                            )
                            Spacer(Modifier.weight(1f))
                            Text(
                                "حذف",
                                style = MaterialTheme.typography.labelMedium,
                                color = AccentRed,
                                modifier = Modifier.clickable {
                                    vm.clearApiKey()
                                    maskedKey = null
                                    vm.clearConnectionTest()
                                }
                            )
                        }
                    } else {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(colors.surfaceMuted)
                                .padding(14.dp)
                        ) {
                            if (keyInput.isEmpty()) {
                                Text(
                                    "sk-ant-...",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.inkMuted.copy(alpha = 0.6f)
                                )
                            }
                            BasicTextField(
                                value = keyInput,
                                onValueChange = { keyInput = it },
                                singleLine = true,
                                visualTransformation = PasswordVisualTransformation(),
                                textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                                cursorBrush = SolidColor(colors.accent),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(22.dp))
                                .background(if (keyInput.isBlank()) colors.inkMuted else colors.accent)
                                .clickable(enabled = keyInput.isNotBlank()) {
                                    vm.setApiKey(keyInput)
                                    maskedKey = vm.maskedApiKey()
                                    keyInput = ""
                                }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("حفظ المفتاح", style = MaterialTheme.typography.labelLarge, color = Color.White)
                        }
                    }

                    Spacer(Modifier.height(14.dp))
                    Text("النموذج", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                    Spacer(Modifier.height(8.dp))
                    AiModel.entries.forEach { model ->
                        val selected = settings.aiModelId == model.id
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (selected) colors.accent.copy(alpha = 0.12f) else colors.surfaceMuted)
                                .clickable { vm.setAiModel(model) }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                Modifier
                                    .size(9.dp)
                                    .clip(CircleShape)
                                    .background(if (selected) colors.accent else colors.inkMuted.copy(alpha = 0.4f))
                            )
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    model.label,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = if (selected) colors.accent else colors.ink
                                )
                                Text(model.hint, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(colors.surfaceMuted)
                            .clickable { vm.testConnection() }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("اختبار الاتصال", style = MaterialTheme.typography.labelLarge, color = colors.inkSoft)
                    }
                    if (connectionTest.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            connectionTest,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (connectionTest.contains("نجاح")) AccentGreen else AccentRed
                        )
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(6.dp)) {
                    ToggleRow(
                        "مراجعة ذكية تلقائية",
                        "إظهار المخاطر والتعارضات عند فتح المساعد",
                        settings.aiAutoReview
                    ) { vm.setAiAutoReview(it) }
                }
            }
        }

        item {
            ActionRow("تصدير نسخة احتياطية", "ملف JSON يحتوي كل المهام وخطواتها") { vm.exportBackup() }
        }

        item {
            ActionRow("استيراد نسخة احتياطية", "إضافة المهام من ملف JSON محفوظ") {
                importLauncher.launch(arrayOf("application/json", "text/plain", "*/*"))
            }
        }

        item {
            ActionRow("تصدير إلى التقويم", "ملف ICS يفتح في تقويم جوجل أو أبل أو أوتلوك") {
                vm.exportCalendar()
            }
        }

        if (backupNotice.isNotBlank()) {
            item {
                Text(backupNotice, style = MaterialTheme.typography.bodySmall, color = colors.accent)
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, color = colors.surfaceMuted, elevation = 0.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("مهامي — الإصدار 1.1", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "لإضافة الويدجت: اضغط مطولاً على الشاشة الرئيسية ← الأدوات (Widgets) ← مهامي.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = colors.ink)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = colors.accent)
        )
    }
}

@Composable
private fun ActionRow(title: String, subtitle: String, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp, onClick = onClick) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = colors.ink)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
            }
            Box(
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(colors.surfaceMuted),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Rounded.ChevronLeft, null,
                    tint = colors.inkMuted, modifier = Modifier.size(19.dp)
                )
            }
        }
    }
}
