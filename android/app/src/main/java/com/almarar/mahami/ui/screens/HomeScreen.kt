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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PriorityHigh
import androidx.compose.material.icons.rounded.Today
import androidx.compose.foundation.shape.RoundedCornerShape as Corner
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.data.SeedData
import com.almarar.mahami.data.InsightKind
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.LoadBars
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.ProgressRing
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.SparkLine
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import com.almarar.mahami.util.Ar
import java.time.LocalDate

@Composable
fun HomeScreen(
    vm: MahamiViewModel,
    onOpenTask: (Long) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenAssistant: () -> Unit = {},
    onOpenSmartAdd: () -> Unit = {}
) {
    val colors = MahamiTheme.colors
    val settings by vm.settings.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    val today = LocalDate.now()

    val open = tasks.filter { it.status != TaskStatus.DONE }
        .sortedWith(compareBy({ it.dueDate }, { it.dueTime }))
    val next = open.firstOrNull()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(colors.tileSky)
                        .clickable { onOpenSettings() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.Person, "الملف", tint = colors.accent, modifier = Modifier.size(26.dp))
                }
                Spacer(Modifier.weight(1f))
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
                CircleIconButton(Icons.Rounded.Menu, "القائمة") { onOpenTasks() }
            }
        }

        item {
            Column {
                Text(
                    "${Ar.greeting()} 👋",
                    style = MaterialTheme.typography.titleLarge,
                    color = colors.inkMuted
                )
                Text(
                    settings.userName,
                    style = MaterialTheme.typography.headlineLarge,
                    color = colors.ink
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "${Ar.fullDate(today)}   •   ${Ar.hijri(today)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted
                )
            }
        }

        item {
            NextTaskCard(next, open.size) { next?.let { onOpenTask(it.id) } }
        }

        item {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("نظرة عامة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable { onOpenTasks() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.ChevronRight, null,
                        tint = colors.inkMuted, modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.ink)
                        .clickable { onOpenTasks() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.ChevronLeft, null,
                        tint = Color.White, modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(
                    modifier = Modifier
                        .weight(1f)
                        .height(188.dp),
                    title = "مهام اليوم",
                    value = stats.today.toString(),
                    unit = "مهمة",
                    icon = Icons.Rounded.Today,
                    background = colors.tileLavender,
                    onClick = onOpenTasks
                ) {
                    SparkLine(
                        values = weeklyLoad(tasks),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        lineColor = Color(0xFF8B7FB8)
                    )
                }
                Column(
                    Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatTile(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(88.dp),
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
                            .height(88.dp),
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
                Row(
                    Modifier.padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "نسبة الإنجاز",
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.ink
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "${stats.done} مكتملة • ${stats.today} اليوم • ${stats.upcoming} قادمة",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                        Spacer(Modifier.height(10.dp))
                        LoadBars(
                            values = fortnightLoad(tasks),
                            accent = AccentRed,
                            base = colors.ink.copy(alpha = 0.55f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(38.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    ProgressRing(
                        progress = stats.completionRate,
                        modifier = Modifier.size(74.dp),
                        stroke = 9.dp,
                        color = AccentGreen
                    )
                }
            }
        }

        item {
            SoftCard(
                Modifier.fillMaxWidth(),
                color = colors.ink,
                corner = 28.dp,
                onClick = onOpenAssistant
            ) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(colors.accent),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Rounded.AutoAwesome, null,
                                tint = Color.White, modifier = Modifier.size(19.dp)
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                "المساعد الذكي",
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White
                            )
                            Text(
                                "خطة اليوم، كشف التعارضات، صياغة الرسائل",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.7f)
                            )
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(Corner(20.dp))
                                .background(Color.White.copy(alpha = 0.12f))
                                .clickable { onOpenAssistant() }
                                .padding(vertical = 11.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "خطة اليوم",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White
                            )
                        }
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(Corner(20.dp))
                                .background(colors.accent)
                                .clickable { onOpenSmartAdd() }
                                .padding(vertical = 11.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "استخراج مهام من نص",
                                style = MaterialTheme.typography.labelMedium,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }

        item {
            Text("ملاحظات وتوصيات", style = MaterialTheme.typography.titleLarge, color = colors.ink)
        }

        items(SeedData.insights) { insight ->
            val tint = when (insight.kind) {
                InsightKind.WARNING -> AccentRed
                InsightKind.PRESSURE -> AccentYellow
                InsightKind.ACTION -> colors.accent
                InsightKind.REFERENCE -> AccentGreen
            }
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 6.dp) {
                Row(Modifier.padding(16.dp)) {
                    Box(
                        Modifier
                            .width(4.dp)
                            .height(46.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(tint)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(insight.title, style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(4.dp))
                        Text(insight.body, style = MaterialTheme.typography.bodyMedium, color = colors.inkMuted)
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("المهام القادمة", style = MaterialTheme.typography.titleLarge, color = colors.ink)
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
            TaskCard(task = task, onClick = { onOpenTask(task.id) }, onToggleDone = { vm.toggleDone(task) })
        }
    }
}

/** توزيع المهام على أسبوعين — يستخدم في أعمدة الحِمل */
private fun fortnightLoad(tasks: List<Task>): List<Float> {
    val today = LocalDate.now()
    return (0..13).map { offset ->
        val day = today.plusDays(offset.toLong())
        tasks.count { it.dueDate == day }.toFloat() + 0.3f
    }
}

/** توزيع المهام على أيام الأسبوع لاستخدامه في الرسوم المصغّرة */
private fun weeklyLoad(tasks: List<Task>): List<Float> {
    val today = LocalDate.now()
    return (0..6).map { offset ->
        val day = today.plusDays(offset.toLong())
        tasks.count { it.dueDate == day }.toFloat() + 0.35f
    }
}

@Composable
private fun NextTaskCard(task: Task?, openCount: Int, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    SoftCard(
        Modifier.fillMaxWidth(),
        color = colors.tileSky,
        corner = 30.dp,
        onClick = onClick
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "أقرب موعد تسليم",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.inkSoft
                )
                Spacer(Modifier.weight(1f))
                val late = task?.isOverdue() == true
                Pill(
                    text = when {
                        task == null -> "لا مهام"
                        late -> "متأخرة"
                        task.daysLeft() <= 1 -> "عاجلة"
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
                            text = task?.let { kotlin.math.abs(it.daysLeft()).toString() } ?: "0",
                            style = MaterialTheme.typography.displayLarge,
                            color = colors.ink
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = when {
                                task == null -> "يوم"
                                task.daysLeft() == 0L -> "اليوم"
                                task.daysLeft() < 0 -> "يوم تأخير"
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
                        Spacer(Modifier.height(2.dp))
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
                    base = colors.ink.copy(alpha = 0.75f),
                    modifier = Modifier
                        .width(112.dp)
                        .height(56.dp)
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "$openCount مهمة مفتوحة",
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
            Spacer(Modifier.height(if (compact) 6.dp else 10.dp))
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
