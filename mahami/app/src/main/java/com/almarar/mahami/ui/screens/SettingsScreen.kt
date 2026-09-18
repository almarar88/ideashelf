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
import com.almarar.mahami.data.ThemeMode
import com.almarar.mahami.notify.NotificationHelper
import com.almarar.mahami.notify.ReminderScheduler
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.ConfirmDialog
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.MahamiTheme

@Composable
fun SettingsScreen(
    vm: MahamiViewModel,
    onBack: () -> Unit,
    onOpenProjects: () -> Unit,
    onOpenAbout: () -> Unit
) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val settings by vm.settings.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    var confirmClear by remember { mutableStateOf(false) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let { vm.importBackup(it, replace = false) } }

    if (confirmClear) {
        ConfirmDialog(
            title = "حذف كل المهام؟",
            body = "سيُحذف كل شيء نهائياً. صدّر نسخة احتياطية أولاً إن أردت الاحتفاظ بها.",
            confirmLabel = "حذف الكل",
            destructive = true,
            onConfirm = {
                confirmClear = false
                vm.clearAllTasks()
            },
            onDismiss = { confirmClear = false }
        )
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 120.dp),
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
                    Box {
                        if (settings.userName.isEmpty()) {
                            Text(
                                "اكتب اسمك",
                                style = MaterialTheme.typography.headlineSmall,
                                color = colors.inkMuted.copy(alpha = 0.5f)
                            )
                        }
                        BasicTextField(
                            value = settings.userName,
                            onValueChange = { if (it.length <= 24) vm.setUserName(it) },
                            singleLine = true,
                            textStyle = MaterialTheme.typography.headlineSmall.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "${stats.total} مهمة • ${stats.done} مكتملة • ${stats.late} متأخرة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item { SectionTitle("المظهر") }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("السمة", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ThemeMode.entries.forEach { mode ->
                            val selected = settings.themeMode == mode
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(if (selected) colors.ink else colors.surfaceMuted)
                                    .clickable { vm.setThemeMode(mode) }
                                    .padding(vertical = 11.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    mode.label,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (selected) Color.White else colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item { SectionTitle("التنبيهات") }

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
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text(
                        "التنبيه الافتراضي للمهام الجديدة",
                        style = MaterialTheme.typography.titleSmall,
                        color = colors.ink
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0, 1, 2, 3, 7).forEach { day ->
                            val selected = settings.defaultReminderOffsets.contains(day)
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(
                                        if (selected) colors.accent.copy(alpha = 0.18f)
                                        else colors.surfaceMuted
                                    )
                                    .clickable {
                                        val current = settings.defaultReminderOffsets.toMutableList()
                                        if (selected) current.remove(day) else current.add(day)
                                        vm.setDefaultReminders(current.ifEmpty { listOf(0) })
                                    }
                                    .padding(vertical = 9.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    if (day == 0) "اليوم" else "$day ي",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (selected) colors.accent else colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            ActionRow("إعدادات الإشعارات في النظام", "التحكم بالقنوات والأصوات") {
                runCatching {
                    context.startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    )
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            item {
                val allowed = ReminderScheduler.canScheduleExact(context)
                ActionRow(
                    "التنبيهات الدقيقة",
                    if (allowed) "مفعّلة — تصل التنبيهات في وقتها بالضبط"
                    else "غير مفعّلة — قد تتأخر التنبيهات. اضغط للسماح"
                ) {
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
                if (tasks.isEmpty()) {
                    vm.showToast("أضف مهمة أولاً لتجربة التنبيه")
                } else {
                    NotificationHelper.notifyTask(context, tasks.first(), "تنبيه تجريبي")
                }
            }
        }

        item { SectionTitle("الحماية") }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(6.dp)) {
                    ToggleRow(
                        "قفل التطبيق",
                        "طلب بصمة الجهاز أو رمز القفل عند الفتح",
                        settings.appLock
                    ) { vm.setAppLock(it) }
                }
            }
        }

        item { SectionTitle("البيانات") }

        item { ActionRow("المشاريع", "إضافة المشاريع وتلوينها وحذفها") { onOpenProjects() } }
        item {
            ActionRow("تصدير نسخة احتياطية", "ملف JSON يحتوي المهام والمشاريع والخطوات") {
                vm.exportBackup()
            }
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
        item {
            ActionRow("إضافة مهام تجريبية", "بيانات عامة لاستعراض التطبيق، يمكن حذفها") {
                vm.loadDemoData()
            }
        }
        item {
            ActionRow("حذف كل المهام", "عملية نهائية لا يمكن التراجع عنها") { confirmClear = true }
        }

        item { SectionTitle("عن التطبيق") }
        item { ActionRow("عن مهامي والخصوصية", "الإصدار، سياسة الخصوصية، التراخيص") { onOpenAbout() } }
    }
}

@Composable
private fun SectionTitle(text: String) {
    val colors = MahamiTheme.colors
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        color = colors.inkMuted,
        modifier = Modifier.padding(top = 8.dp, start = 4.dp)
    )
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
