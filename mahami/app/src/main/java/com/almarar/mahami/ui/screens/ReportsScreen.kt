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
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.core.Stats
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.BarDatum
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.DottedBars
import com.almarar.mahami.ui.components.GaugeArc
import com.almarar.mahami.ui.components.GaugeLegend
import com.almarar.mahami.ui.components.GaugeSegment
import com.almarar.mahami.ui.components.SegmentedTabs
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.ThinProgress
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Composable
fun ReportsScreen(vm: MahamiViewModel) {
    val colors = MahamiTheme.colors
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val projects by vm.projects.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    val focus by vm.focusSummary.collectAsStateWithLifecycle()
    val entitlement by vm.entitlement.collectAsStateWithLifecycle()
    var range by remember { mutableIntStateOf(1) }
    val today = LocalDate.now()

    val scoped = remember(tasks, range) {
        when (range) {
            0 -> tasks.filter { it.dueDate == today }
            1 -> tasks.filter { ChronoUnit.DAYS.between(today, it.dueDate) in -7..7 }
            else -> tasks.filter { it.dueDate.month == today.month && it.dueDate.year == today.year }
        }.ifEmpty { tasks }
    }

    val done = scoped.count { it.status == TaskStatus.DONE }
    val late = scoped.count { it.status != TaskStatus.DONE && it.dueDate.isBefore(today) }
    val inProgress = scoped.count { it.status == TaskStatus.IN_PROGRESS }
    val pending = (scoped.size - done - late - inProgress).coerceAtLeast(0)

    val segments = listOf(
        GaugeSegment(done.toFloat(), AccentGreen, "مكتملة"),
        GaugeSegment(inProgress.toFloat(), colors.accent, "قيد التنفيذ"),
        GaugeSegment(pending.toFloat(), AccentYellow, "لم تبدأ"),
        GaugeSegment(late.toFloat(), AccentRed, "متأخرة")
    )

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp))
                Spacer(Modifier.weight(1f))
                Text("التقارير", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                Spacer(Modifier.weight(1f))
                CircleIconButton(Icons.Rounded.Share, "مشاركة التقرير") { vm.shareReport() }
            }
        }

        item {
            SegmentedTabs(
                options = listOf("يومي", "أسبوعي", "شهري"),
                selectedIndex = range,
                onSelect = { range = it }
            )
        }

        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                GaugeArc(
                    segments = segments,
                    centerValue = if (scoped.isEmpty()) "0"
                    else (done * 100 / scoped.size).toString(),
                    centerUnit = "%",
                    centerCaption = "نسبة الإنجاز",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(228.dp)
                )
                Spacer(Modifier.height(10.dp))
                GaugeLegend(segments)
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard(
                    modifier = Modifier.weight(1f),
                    title = "الالتزام بالمواعيد",
                    value = if (stats.done == 0) "—" else "${(stats.onTimeRate * 100).toInt()}%",
                    caption = if (stats.done == 0) "يظهر بعد إنجاز أول مهمة"
                    else "من المهام المنجزة سُلّمت في وقتها",
                    tint = AccentGreen
                )
                MetricCard(
                    modifier = Modifier.weight(1f),
                    title = "سلسلة الإنجاز",
                    value = stats.currentStreak.toString(),
                    caption = "أطول سلسلة: ${stats.longestStreak}",
                    tint = AccentYellow
                )
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(18.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "توزيع المهام — 7 أيام قادمة",
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.ink
                        )
                        Spacer(Modifier.weight(1f))
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(AccentGreen.copy(alpha = 0.16f))
                                .padding(horizontal = 12.dp, vertical = 5.dp)
                        ) {
                            Text(
                                "من اليوم",
                                style = MaterialTheme.typography.labelSmall,
                                color = AccentGreen
                            )
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                    DottedBars(
                        data = Stats.weekLoad(tasks, today).map {
                            BarDatum(Ar.dayShort(it.date), it.count.toFloat(), it.isToday)
                        }
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("مؤشرات سريعة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(14.dp))
                    MetricRow("مكتملة", done, scoped.size, AccentGreen)
                    Spacer(Modifier.height(12.dp))
                    MetricRow("قيد التنفيذ", inProgress, scoped.size, colors.accent)
                    Spacer(Modifier.height(12.dp))
                    MetricRow("متأخرة", late, scoped.size, AccentRed)
                    Spacer(Modifier.height(12.dp))
                    MetricRow("لم تبدأ", pending, scoped.size, AccentYellow)
                }
            }
        }

        item {
            val byProject = Stats.byProject(tasks, projects).filter { it.total > 0 }
            if (byProject.isNotEmpty()) {
                SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text("حسب المشروع", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(12.dp))
                        byProject.sortedByDescending { it.total }.forEach { stat ->
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    Modifier
                                        .size(9.dp)
                                        .clip(CircleShape)
                                        .background(
                                            stat.project?.let { Color(it.colorArgb) } ?: colors.inkMuted
                                        )
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    stat.project?.name ?: "بدون مشروع",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.inkSoft,
                                    modifier = Modifier.width(96.dp)
                                )
                                ThinProgress(
                                    progress = stat.rate,
                                    modifier = Modifier.weight(1f),
                                    height = 7.dp
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    "${stat.done}/${stat.total}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("وقت التركيز", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (focus.totalMinutes == 0) "ابدأ جلسة تركيز من صفحة أي مهمة"
                        else "${focus.weekMinutes} دقيقة هذا الأسبوع • ${focus.sessions} جلسة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                    if (focus.perDay.isNotEmpty()) {
                        Spacer(Modifier.height(16.dp))
                        DottedBars(
                            data = focus.perDay.map {
                                BarDatum(Ar.dayShort(it.date), it.minutes.toFloat(), it.date == today)
                            },
                            barHeight = 110.dp
                        )
                    }
                }
            }
        }

        if (entitlement.isPro) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text(
                            "الإنجاز خلال ستة أشهر",
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.ink
                        )
                        Spacer(Modifier.height(16.dp))
                        DottedBars(
                            data = Stats.monthlyCompleted(tasks, today).map { (month, count) ->
                                BarDatum(month.take(4), count.toFloat(), false)
                            },
                            barHeight = 110.dp
                        )
                    }
                }
            }
        }

        item {
            val heaviest = tasks
                .filter { it.status != TaskStatus.DONE && !it.dueDate.isBefore(today) }
                .groupBy { it.dueDate }
                .maxByOrNull { it.value.size }
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp, color = colors.tileSky) {
                Column(Modifier.padding(18.dp)) {
                    Text("أثقل الأيام", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        if (heaviest != null && heaviest.value.size >= 2) {
                            "${Ar.fullDate(heaviest.key)} — ${Ar.countTasks(heaviest.value.size)}. " +
                                "وزّع العمل قبله بيومين على الأقل."
                        } else {
                            "جدولك متوازن حالياً، لا يوجد يوم محمّل بأكثر من مهمة."
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkSoft
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier,
    title: String,
    value: String,
    caption: String,
    tint: Color
) {
    val colors = MahamiTheme.colors
    SoftCard(modifier, corner = 26.dp, elevation = 6.dp) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = colors.inkSoft)
            Spacer(Modifier.height(8.dp))
            Text(value, style = MaterialTheme.typography.displayMedium, color = tint)
            Spacer(Modifier.height(4.dp))
            Text(caption, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
        }
    }
}

@Composable
private fun MetricRow(label: String, value: Int, total: Int, color: Color) {
    val colors = MahamiTheme.colors
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(9.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.inkSoft,
            modifier = Modifier.width(88.dp)
        )
        ThinProgress(
            progress = if (total == 0) 0f else value.toFloat() / total,
            color = color,
            modifier = Modifier.weight(1f),
            height = 8.dp
        )
        Spacer(Modifier.width(10.dp))
        Text("$value", style = MaterialTheme.typography.labelLarge, color = colors.ink)
    }
}
