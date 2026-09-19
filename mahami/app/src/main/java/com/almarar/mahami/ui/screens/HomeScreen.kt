package com.almarar.mahami.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.NorthEast
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PriorityHigh
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Today
import androidx.compose.material.icons.rounded.Whatshot
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import com.almarar.mahami.smart.ChipKind
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.AnimatedCounter
import com.almarar.mahami.ui.components.EmptyState
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.PulsingDot
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.StripedBar
import com.almarar.mahami.ui.components.StripedBars
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.components.TickDial
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
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
    onOpenPaywall: () -> Unit = {},
    onOpenAccount: () -> Unit = {},
    onStartVoice: () -> Unit = {}
) {
    val colors = MahamiTheme.colors
    val settings by vm.settings.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    val entitlement by vm.entitlement.collectAsStateWithLifecycle()
    val session by vm.session.collectAsStateWithLifecycle()
    val quick by vm.quickInput.collectAsStateWithLifecycle()
    val today = LocalDate.now()

    val open = tasks.filter { it.status != TaskStatus.DONE }
        .sortedWith(compareBy({ it.dueDate }, { it.dueTime }))
    val next = open.firstOrNull()
    val mit = tasks.filter { it.isMitFor(today) && it.status != TaskStatus.DONE }
    val insights = remember(tasks) { Stats.insights(tasks, today).take(2) }
    val todaySteps = remember(tasks) { vm.stepsDueToday() }
    val doneToday = tasks.count { it.completedAt?.toLocalDate() == today }
    val dueToday = tasks.count { it.dueDate == today && it.status != TaskStatus.DONE }
    val dayProgress = if (dueToday + doneToday == 0) 0f else doneToday.toFloat() / (dueToday + doneToday)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // ---------- الترويسة ----------
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box {
                    Box(
                        Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(colors.feature)
                            .clickable { onOpenAccount() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Rounded.Person, "الحساب",
                            tint = colors.onFeature, modifier = Modifier.size(26.dp)
                        )
                    }
                    if (entitlement.isPro) {
                        Box(
                            Modifier
                                .align(Alignment.BottomStart)
                                .clip(RoundedCornerShape(10.dp))
                                .background(colors.accent)
                                .padding(horizontal = 7.dp, vertical = 1.dp)
                        ) {
                            Text(
                                "بلس",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White
                            )
                        }
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "${Ar.greeting()}،",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkMuted
                    )
                    Text(
                        settings.userName.ifBlank { "أهلاً بك" },
                        style = MaterialTheme.typography.headlineSmall,
                        color = colors.ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable { if (session.signedIn) vm.syncNow() else onOpenAccount() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (session.signedIn) Icons.Rounded.CloudDone else Icons.Rounded.CloudOff,
                        "المزامنة",
                        tint = if (session.signedIn) AccentGreen else colors.inkMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // ---------- البطاقة الداكنة: أقرب موعد ----------
        item {
            FeatureCard(
                task = next,
                openCount = open.size,
                dayProgress = dayProgress,
                today = today,
                onClick = { next?.let { onOpenTask(it.id) } },
                onOpenTasks = onOpenTasks
            )
        }

        // ---------- الإضافة السريعة الذكية ----------
        item {
            SmartQuickAdd(
                value = quick.text,
                preview = quick.chips,
                previewTitle = quick.title,
                onChange = vm::onQuickInputChange,
                onSubmit = { vm.commitQuickAdd() },
                onVoice = onStartVoice
            )
        }

        // ---------- شريط الإحصاء ----------
        item {
            SoftCard(
                Modifier.fillMaxWidth(),
                corner = 26.dp,
                onClick = onOpenTasks
            ) {
                Row(
                    Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(colors.accent.copy(alpha = 0.16f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Rounded.Bolt, null,
                            tint = colors.accent, modifier = Modifier.size(21.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            AnimatedCounter(
                                value = stats.total - stats.done,
                                style = MaterialTheme.typography.headlineMedium,
                                color = colors.ink
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "${Ar.taskWord(stats.total - stats.done)} مفتوحة",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted,
                                modifier = Modifier.padding(bottom = 3.dp)
                            )
                        }
                        Text(
                            if (stats.currentStreak > 0)
                                "سلسلة إنجاز ${stats.currentStreak} يوم متتالية"
                            else "أنجز مهمة اليوم لتبدأ سلسلتك",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                    }
                    Icon(
                        Icons.Rounded.ChevronLeft, null,
                        tint = colors.inkMuted, modifier = Modifier.size(22.dp)
                    )
                }
            }
        }

        // ---------- بطاقات الحالة ----------
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(
                    modifier = Modifier.weight(1f),
                    title = "اليوم",
                    value = dueToday,
                    icon = Icons.Rounded.Today,
                    background = colors.tileClay,
                    accent = colors.accent,
                    onClick = onOpenTasks
                )
                StatTile(
                    modifier = Modifier.weight(1f),
                    title = "متأخرة",
                    value = stats.late,
                    icon = Icons.Rounded.PriorityHigh,
                    background = colors.tileSand,
                    accent = AccentRed,
                    pulsing = stats.late > 0,
                    onClick = onOpenTasks
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(
                    modifier = Modifier.weight(1f),
                    title = "أنجزت اليوم",
                    value = doneToday,
                    icon = Icons.Rounded.CheckCircle,
                    background = colors.tileSage,
                    accent = AccentGreen,
                    onClick = onOpenTasks
                )
                StatTile(
                    modifier = Modifier.weight(1f),
                    title = "تركيز اليوم",
                    value = vm.focusSummary.collectAsStateWithLifecycle().value.todayMinutes,
                    unit = "دقيقة",
                    icon = Icons.Rounded.Whatshot,
                    background = colors.tileSky,
                    accent = colors.accent,
                    onClick = onOpenTasks
                )
            }
        }

        // ---------- أهم ثلاث مهام ----------
        item {
            MitSection(
                selected = mit,
                candidates = open.take(6),
                onToggle = { vm.toggleMit(it) },
                onOpen = onOpenTask
            )
        }

        // ---------- خطوات اليوم من خطط التنفيذ ----------
        if (todaySteps.isNotEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 28.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "خطوات اليوم",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.ink
                            )
                            Spacer(Modifier.weight(1f))
                            Pill("${todaySteps.size}", colors.accent.copy(alpha = 0.12f), colors.accent)
                        }
                        Text(
                            "من خطط التنفيذ التي وزّعتها على الأيام",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                        Spacer(Modifier.height(12.dp))
                        todaySteps.take(5).forEach { (parent, step) ->
                            val index = parent.subTasks.indexOf(step)
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable { onOpenTask(parent.id) }
                                    .padding(vertical = 9.dp, horizontal = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(colors.surfaceMuted)
                                        .clickable {
                                            if (index >= 0) vm.toggleSubTask(parent, index)
                                        }
                                )
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        step.title,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.ink
                                    )
                                    Text(
                                        parent.title,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.inkMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ---------- توزيع الأسبوع ----------
        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 28.dp) {
                Column(Modifier.padding(18.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("حِمل الأسبوع", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.weight(1f))
                        Pill("7 أيام", colors.surfaceMuted, colors.inkMuted)
                    }
                    Spacer(Modifier.height(16.dp))
                    StripedBars(
                        data = Stats.weekLoad(tasks, today).map {
                            StripedBar(Ar.dayShort(it.date), it.count.toFloat(), it.isToday)
                        },
                        barHeight = 120.dp
                    )
                }
            }
        }

        // ---------- ملاحظات ----------
        items(insights, key = { it.title }) { insight ->
            val tint = when (insight.severity) {
                Severity.HIGH -> AccentRed
                Severity.MEDIUM -> AccentYellow
                Severity.INFO -> colors.accent
            }
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Row(Modifier.padding(16.dp)) {
                    Box(
                        Modifier
                            .width(4.dp)
                            .height(42.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(tint)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(insight.title, style = MaterialTheme.typography.titleSmall, color = colors.ink)
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

        // ---------- ترقية ----------
        if (!entitlement.isPro) {
            item {
                SoftCard(
                    Modifier.fillMaxWidth(),
                    color = colors.feature,
                    corner = 26.dp,
                    onClick = onOpenPaywall
                ) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(colors.accent),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Rounded.Star, null,
                                tint = Color.White, modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "مهامي بلس",
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.onFeature
                            )
                            Text(
                                "مشاريع بلا حدود، تكرار، تقارير وتصدير",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.onFeatureMuted
                            )
                        }
                        Icon(
                            Icons.Rounded.ChevronLeft, null,
                            tint = colors.onFeatureMuted, modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        // ---------- قوالب ----------
        item {
            Column {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("ابدأ بسرعة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                    Spacer(Modifier.weight(1f))
                    Text(
                        "كل القوالب",
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

        if (tasks.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Rounded.Today,
                    title = "ابدأ بأول مهمة",
                    body = "اكتب المهمة بلغتك: «تسليم التقرير الأربعاء القادم الساعة 10 عاجل» وسيفهمها التطبيق.",
                    actionLabel = "إضافة مهمة",
                    onAction = onNewTask
                )
            }
        }

        // ---------- المهام القادمة ----------
        if (open.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("القادمة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                    Spacer(Modifier.weight(1f))
                    Text(
                        "عرض الكل",
                        style = MaterialTheme.typography.labelLarge,
                        color = colors.accent,
                        modifier = Modifier.clickable { onOpenTasks() }
                    )
                }
            }
            items(open.take(4), key = { it.id }) { task ->
                TaskCard(
                    task = task,
                    project = vm.projectOf(task),
                    today = today,
                    blocked = vm.isBlocked(task),
                    onClick = { onOpenTask(task.id) },
                    onToggleDone = { vm.toggleDone(task) },
                    onToggleStep = { index -> vm.toggleSubTask(task, index) },
                    onPostpone = { days -> vm.postpone(task, days) }
                )
            }
        }
    }
}

/** البطاقة الداكنة المميزة: أقرب موعد مع قرص التقدّم */
@Composable
private fun FeatureCard(
    task: Task?,
    openCount: Int,
    dayProgress: Float,
    today: LocalDate,
    onClick: () -> Unit,
    onOpenTasks: () -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(
        Modifier.fillMaxWidth(),
        color = colors.feature,
        corner = 32.dp,
        elevation = 14.dp,
        onClick = onClick
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(
                        "أقرب موعد",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onFeatureMuted
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        task?.title ?: "لا توجد مهام مفتوحة",
                        style = MaterialTheme.typography.titleLarge,
                        color = colors.onFeature,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth(0.72f)
                    )
                }
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(colors.onFeature.copy(alpha = 0.12f))
                        .clickable { onOpenTasks() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.NorthEast, "عرض المهام",
                        tint = colors.onFeature, modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                TickDial(
                    progress = dayProgress,
                    modifier = Modifier.size(132.dp),
                    activeColor = colors.accent,
                    inactiveColor = colors.onFeatureMuted.copy(alpha = 0.3f)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        AnimatedCounter(
                            value = task?.let { kotlin.math.abs(it.daysLeft(today)).toInt() } ?: 0,
                            style = MaterialTheme.typography.displayMedium,
                            color = colors.onFeature
                        )
                        Text(
                            when {
                                task == null -> "يوم"
                                task.daysLeft(today) == 0L -> "اليوم"
                                task.daysLeft(today) < 0 -> "يوم تأخير"
                                else -> "يوم متبقٍ"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.onFeatureMuted
                        )
                    }
                }

                Spacer(Modifier.width(16.dp))

                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    FeatureStat(
                        label = "مهام مفتوحة",
                        value = openCount.toString(),
                        tint = colors.onFeature
                    )
                    FeatureStat(
                        label = "إنجاز اليوم",
                        value = "${(dayProgress * 100).toInt()}%",
                        tint = colors.accent
                    )
                    task?.let {
                        FeatureStat(
                            label = "الموعد",
                            value = Ar.shortDate(it.dueDate),
                            tint = colors.onFeature
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FeatureStat(label: String, value: String, tint: Color) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(colors.featureSoft)
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.onFeatureMuted)
        Spacer(Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.titleSmall, color = tint)
    }
}

/** حقل الإضافة الذكية مع معاينة ما فهمه التطبيق */
@Composable
private fun SmartQuickAdd(
    value: String,
    preview: List<com.almarar.mahami.smart.ParsedChip>,
    previewTitle: String,
    onChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onVoice: () -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 26.dp, elevation = 6.dp) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) {
                        Text(
                            "اكتب مهمة: تسليم التقرير الأربعاء 10 صباحاً عاجل",
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.inkMuted.copy(alpha = 0.75f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    BasicTextField(
                        value = value,
                        onValueChange = onChange,
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                        cursorBrush = SolidColor(colors.accent),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Spacer(Modifier.width(10.dp))
                Box(
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(colors.surfaceMuted)
                        .clickable { onVoice() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.Mic, "إدخال صوتي",
                        tint = colors.inkSoft, modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(if (value.isBlank()) colors.surfaceMuted else colors.accent)
                        .clickable(enabled = value.isNotBlank()) { onSubmit() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.CheckCircle, "إضافة",
                        tint = if (value.isBlank()) colors.inkMuted else Color.White,
                        modifier = Modifier.size(19.dp)
                    )
                }
            }

            AnimatedVisibility(
                visible = preview.isNotEmpty(),
                enter = fadeIn(tween(200)) + slideInVertically(tween(220)) { it / 2 }
            ) {
                Column {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        previewTitle,
                        style = MaterialTheme.typography.titleSmall,
                        color = colors.ink
                    )
                    Spacer(Modifier.height(8.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(preview) { chip ->
                            val tint = when (chip.kind) {
                                ChipKind.DATE -> colors.accent
                                ChipKind.TIME -> AccentYellow
                                ChipKind.PRIORITY -> AccentRed
                                ChipKind.TAG -> AccentGreen
                                ChipKind.PROJECT -> colors.inkSoft
                                ChipKind.OWNER -> colors.inkSoft
                                ChipKind.ESTIMATE -> colors.inkMuted
                            }
                            Pill(chip.label, tint.copy(alpha = 0.14f), tint)
                        }
                    }
                }
            }
        }
    }
}

/** أهم ثلاث مهام لليوم — اختيار محدود يفرض الأولوية */
@Composable
private fun MitSection(
    selected: List<Task>,
    candidates: List<Task>,
    onToggle: (Task) -> Unit,
    onOpen: (Long) -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 28.dp) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Rounded.Star, null,
                    tint = colors.accent, modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("أهم ثلاث مهام اليوم", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                Spacer(Modifier.weight(1f))
                Text(
                    "${selected.size}/3",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selected.size == 3) colors.accent else colors.inkMuted
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "اختر ثلاثاً فقط — ما تنجزه منها يصنع يومك",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted
            )
            Spacer(Modifier.height(12.dp))

            val list = (selected + candidates.filterNot { c -> selected.any { it.id == c.id } }).take(6)
            if (list.isEmpty()) {
                Text(
                    "أضف مهاماً لتختار منها",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted
                )
            }
            list.forEach { task ->
                val isSelected = selected.any { it.id == task.id }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (isSelected) colors.accent.copy(alpha = 0.12f) else Color.Transparent)
                        .clickable { onToggle(task) }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) colors.accent else colors.surfaceMuted),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSelected) {
                            Icon(
                                Icons.Rounded.Star, null,
                                tint = Color.White, modifier = Modifier.size(12.dp)
                            )
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(
                        task.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isSelected) colors.ink else colors.inkSoft,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        Ar.relative(task.dueDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.inkMuted,
                        modifier = Modifier.clickable { onOpen(task.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun StatTile(
    modifier: Modifier,
    title: String,
    value: Int,
    icon: ImageVector,
    background: Color,
    accent: Color,
    unit: String = "",
    pulsing: Boolean = false,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(modifier = modifier, color = background, corner = 26.dp, elevation = 4.dp, onClick = onClick) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = colors.inkSoft)
                Spacer(Modifier.weight(1f))
                if (pulsing) {
                    PulsingDot(accent, size = 12.dp)
                } else {
                    Box(
                        Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(colors.surface.copy(alpha = 0.7f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(icon, null, tint = accent, modifier = Modifier.size(14.dp))
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                AnimatedCounter(
                    value = value,
                    style = MaterialTheme.typography.displayMedium,
                    color = colors.ink
                )
                if (unit.isNotBlank()) {
                    Spacer(Modifier.width(4.dp))
                    Text(
                        unit,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                }
            }
        }
    }
}
