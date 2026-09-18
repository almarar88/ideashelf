package com.almarar.mahami.ui.screens

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.PriorityHigh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material.icons.rounded.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.core.Severity
import com.almarar.mahami.core.Stats
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.data.Templates
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.EmptyState
import com.almarar.mahami.ui.components.LoadBars
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.ProgressRing
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.SparkLine
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentViolet
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.LocalDate

@Composable
fun HomeScreen(
    vm: MahamiViewModel,
    onOpenTask: (Long) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenTemplates: () -> Unit,
    onNewTask: () -> Unit,
    onOpenPaywall: () -> Unit = {}
) {
    val colors = MahamiTheme.colors
    val settings by vm.settings.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    val entitlement by vm.entitlement.collectAsStateWithLifecycle()
    val today = LocalDate.now()
    var quickTitle by remember { mutableStateOf("") }

    val open = tasks.filter { it.status != TaskStatus.DONE }
        .sortedWith(compareBy({ it.dueDate }, { it.dueTime }))
    val next = open.firstOrNull()
    val insights = rememberInsights(tasks, today)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "${Ar.greeting()} 👋",
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.inkMuted
                    )
                    Text(
                        settings.userName.ifBlank { "أهلاً بك" },
                        style = MaterialTheme.typography.headlineMedium,
                        color = colors.ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "${Ar.fullDate(today)}   •   ${Ar.hijri(today)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
                Box {
                    CircleIconButton(Icons.Rounded.Notifications, "التنبيهات") { onOpenSettings() }
                    if (stats.late > 0) {
                        Box(
                            Modifier
                                .padding(start = 4.dp, top = 4.dp)
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(AccentRed)
                                .align(Alignment.TopStart)
                        )
                    }
                }
                Spacer(Modifier.width(8.dp))
                CircleIconButton(Icons.Rounded.Settings, "الإعدادات") { onOpenSettings() }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 26.dp, elevation = 6.dp) {
                Column(Modifier.padding(14.dp)) {
                    Box(Modifier.fillMaxWidth()) {
                        if (quickTitle.isEmpty()) {
                            Text(
                                "أضف مهمة بسرعة...",
                                style = MaterialTheme.typography.bodyLarge,
                                color = colors.inkMuted.copy(alpha = 0.7f)
                            )
                        }
                        BasicTextField(
                            value = quickTitle,
                            onValueChange = { quickTitle = it },
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (quickTitle.isNotBlank()) {
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            QuickChip("اليوم", Modifier.weight(1f)) {
                                vm.quickAdd(quickTitle, 0); quickTitle = ""
                            }
                            QuickChip("غداً", Modifier.weight(1f)) {
                                vm.quickAdd(quickTitle, 1); quickTitle = ""
                            }
                            QuickChip("بعد أسبوع", Modifier.weight(1f)) {
                                vm.quickAdd(quickTitle, 7); quickTitle = ""
                            }
                        }
                    }
                }
            }
        }

        if (!entitlement.isPro) {
            item {
                SoftCard(
                    Modifier.fillMaxWidth(),
                    color = colors.tileSand(),
                    corner = 24.dp,
                    elevation = 4.dp,
                    onClick = onOpenPaywall
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(AccentYellow.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Rounded.WorkspacePremium, null,
                                tint = AccentYellow, modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "مهامي بلس",
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.ink
                            )
                            Text(
                                "مشاريع بلا حدود، مهام متكررة، تقارير وتصدير",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                        Icon(
                            Icons.Rounded.ChevronLeft, null,
                            tint = colors.inkMuted, modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        if (tasks.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Rounded.Today,
                    title = "ابدأ بأول مهمة",
                    body = "أضف مهمة بموعدها، أو اختر قالباً جاهزاً يوفّر عليك كتابة الخطوات.",
                    actionLabel = "إضافة مهمة",
                    onAction = onNewTask
                )
            }
            item { TemplatesRow(onOpenTemplates) }
            return@LazyColumn
        }

        item { NextTaskCard(next, open.size, today) { next?.let { onOpenTask(it.id) } } }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(
                    modifier = Modifier
                        .weight(1f)
                        .height(204.dp),
                    title = "مهام اليوم",
                    value = stats.today.toString(),
                    unit = "مهمة",
                    icon = Icons.Rounded.Today,
                    background = colors.tileLavender,
                    onClick = onOpenTasks
                ) {
                    SparkLine(
                        values = Stats.weekLoad(tasks, today).map { it.count.toFloat() + 0.35f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        lineColor = AccentViolet
                    )
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatTile(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(96.dp),
                        title = "مكتملة",
                        value = stats.done.toString(),
                        unit = "من ${stats.total}",
                        icon = Icons.Rounded.CheckCircle,
                        background = colors.tileMint,
                        compact = true,
                        onClick = onOpenTasks
                    )
                    StatTile(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(96.dp),
                        title = "متأخرة",
                        value = stats.late.toString(),
                        unit = "مهمة",
                        icon = Icons.Rounded.PriorityHigh,
                        background = colors.tilePeach,
                        compact = true,
                        onClick = onOpenTasks
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Rounded.LocalFireDepartment, null,
                                tint = AccentYellow, modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "سلسلة الإنجاز",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.ink
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            if (stats.currentStreak > 0)
                                "${Ar.countDays(stats.currentStreak.toLong())} متتالية — الأطول ${stats.longestStreak}"
                            else "أنجز مهمة اليوم لتبدأ سلسلتك",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                        Spacer(Modifier.height(10.dp))
                        LoadBars(
                            values = Stats.weekLoad(tasks, today).map { it.count.toFloat() + 0.3f },
                            accent = AccentRed,
                            base = colors.ink.copy(alpha = 0.5f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(34.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    ProgressRing(
                        progress = stats.completionRate,
                        modifier = Modifier.size(72.dp),
                        stroke = 9.dp,
                        color = AccentGreen
                    )
                }
            }
        }

        item { TemplatesRow(onOpenTemplates) }

        if (insights.isNotEmpty()) {
            item {
                Text("ملاحظات على جدولك", style = MaterialTheme.typography.titleLarge, color = colors.ink)
            }
            items(insights, key = { it.title }) { insight ->
                val tint = when (insight.severity) {
                    Severity.HIGH -> AccentRed
                    Severity.MEDIUM -> AccentYellow
                    Severity.INFO -> colors.accent
                }
                SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 6.dp) {
                    Row(Modifier.padding(16.dp)) {
                        Box(
                            Modifier
                                .width(4.dp)
                                .height(44.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(tint)
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                insight.title,
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.ink
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                insight.body,
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted
                            )
                        }
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("المهام القادمة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                Spacer(Modifier.weight(1f))
                Row(
                    Modifier.clickable { onOpenTasks() },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("عرض الكل", style = MaterialTheme.typography.labelLarge, color = colors.accent)
                    Icon(
                        Icons.Rounded.ChevronLeft, null,
                        tint = colors.accent, modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        items(open.take(4), key = { it.id }) { task ->
            TaskCard(
                task = task,
                project = vm.projectOf(task),
                today = today,
                onClick = { onOpenTask(task.id) },
                onToggleDone = { vm.toggleDone(task) }
            )
        }
    }
}

@Composable
private fun rememberInsights(tasks: List<Task>, today: LocalDate) =
    androidx.compose.runtime.remember(tasks, today) { Stats.insights(tasks, today).take(3) }

@Composable
private fun TemplatesRow(onOpenTemplates: () -> Unit) {
    val colors = MahamiTheme.colors
    Column {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("قوالب جاهزة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
            Spacer(Modifier.weight(1f))
            Text(
                "الكل",
                style = MaterialTheme.typography.labelLarge,
                color = colors.accent,
                modifier = Modifier.clickable { onOpenTemplates() }
            )
        }
        Spacer(Modifier.height(10.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(Templates.tasks.take(5)) { template ->
                SoftCard(corner = 22.dp, elevation = 4.dp, onClick = onOpenTemplates) {
                    Row(
                        Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(template.emoji, style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            template.name,
                            style = MaterialTheme.typography.labelMedium,
                            color = colors.inkSoft
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NextTaskCard(task: Task?, openCount: Int, today: LocalDate, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), color = colors.tileSky, corner = 30.dp, onClick = onClick) {
        Column(Modifier.padding(20.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "أقرب موعد تسليم",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.inkSoft
                )
                Spacer(Modifier.weight(1f))
                val late = task != null && task.dueDate.isBefore(today)
                Pill(
                    text = when {
                        task == null -> "لا مهام"
                        late -> "متأخرة"
                        task.daysLeft(today) <= 1 -> "عاجلة"
                        else -> "ضمن الخطة"
                    },
                    background = if (late) AccentRed.copy(alpha = 0.16f) else AccentGreen.copy(alpha = 0.16f),
                    textColor = if (late) AccentRed else AccentGreen
                )
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = task?.let { kotlin.math.abs(it.daysLeft(today)).toString() } ?: "0",
                            style = MaterialTheme.typography.displayLarge,
                            color = colors.ink
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = when {
                                task == null -> "مهمة"
                                task.daysLeft(today) == 0L -> "اليوم"
                                task.daysLeft(today) < 0 -> "يوم تأخير"
                                else -> "يوم متبقٍ"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.inkMuted,
                            modifier = Modifier.padding(bottom = 9.dp)
                        )
                    }
                    Text(
                        task?.title ?: "لا توجد مهام مفتوحة",
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.ink,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (task != null) {
                        Text(
                            Ar.fullDate(task.dueDate),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                    }
                }
                Spacer(Modifier.width(10.dp))
                LoadBars(
                    values = listOf(0.4f, 0.9f, 0.55f, 1f, 0.35f, 0.8f, 0.5f, 0.95f, 0.45f, 0.7f),
                    accent = AccentRed,
                    base = colors.ink.copy(alpha = 0.72f),
                    modifier = Modifier
                        .width(104.dp)
                        .height(54.dp)
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "${Ar.countTasks(openCount)} مفتوحة",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted
            )
        }
    }
}

@Composable
private fun StatTile(
    modifier: Modifier,
    title: String,
    value: String,
    unit: String,
    icon: ImageVector,
    background: Color,
    compact: Boolean = false,
    onClick: () -> Unit,
    extra: @Composable (() -> Unit)? = null
) {
    val colors = MahamiTheme.colors
    SoftCard(modifier = modifier, color = background, corner = 26.dp, elevation = 6.dp, onClick = onClick) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = colors.inkSoft)
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(colors.surface.copy(alpha = 0.85f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, null, tint = colors.ink, modifier = Modifier.size(15.dp))
                }
            }
            Spacer(Modifier.height(if (compact) 4.dp else 8.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    value,
                    style = if (compact) MaterialTheme.typography.headlineMedium
                    else MaterialTheme.typography.displayMedium,
                    color = colors.ink
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    unit,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted,
                    modifier = Modifier.padding(bottom = 5.dp)
                )
            }
            if (extra != null) {
                Spacer(Modifier.weight(1f))
                extra()
            }
        }
    }
}

@Composable
private fun QuickChip(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    Box(
        modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(18.dp))
            .background(colors.accent.copy(alpha = 0.12f))
            .clickable { onClick() }
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = colors.accent)
    }
}

/** لون بطاقة الترقية — رملي فاتح يتكيّف مع الوضع الداكن */
@Composable
private fun com.almarar.mahami.ui.theme.MahamiPalette.tileSand(): Color =
    if (isDark) Color(0xFF2B2519) else Color(0xFFFBF3E2)
