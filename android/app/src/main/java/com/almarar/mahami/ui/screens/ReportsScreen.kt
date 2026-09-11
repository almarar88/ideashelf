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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.BarDatum
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.DottedBars
import com.almarar.mahami.ui.components.GaugeArc
import com.almarar.mahami.ui.components.GaugeLegend
import com.almarar.mahami.ui.components.GaugeSegment
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.ThinProgress
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import com.almarar.mahami.util.Ar
import java.time.LocalDate
import java.time.temporal.ChronoUnit

@Composable
fun ReportsScreen(vm: MahamiViewModel) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()
    var range by remember { mutableIntStateOf(1) } // 0 يومي، 1 أسبوعي، 2 شهري
    val today = LocalDate.now()

    val scoped = when (range) {
        0 -> tasks.filter { it.dueDate == today }
        1 -> tasks.filter { ChronoUnit.DAYS.between(today, it.dueDate) in -3..7 }
        else -> tasks.filter { it.dueDate.month == today.month && it.dueDate.year == today.year }
    }.ifEmpty { tasks }

    val done = scoped.count { it.status == TaskStatus.DONE }
    val late = scoped.count { it.isOverdue() }
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
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp))
                Spacer(Modifier.weight(1f))
                Text("التقارير", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                Spacer(Modifier.weight(1f))
                CircleIconButton(Icons.Rounded.Share, "مشاركة") {
                    shareReport(context, tasks, stats.completionRate)
                }
            }
        }

        item {
            com.almarar.mahami.ui.components.SegmentedTabs(
                options = listOf("يومي", "أسبوعي", "شهري"),
                selectedIndex = range,
                onSelect = { range = it }
            )
        }

        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                GaugeArc(
                    segments = segments,
                    centerValue = "${(if (scoped.isEmpty()) 0f else done.toFloat() / scoped.size * 100).toInt()}",
                    centerUnit = "%",
                    centerCaption = "نسبة الإنجاز",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(230.dp)
                )
                Spacer(Modifier.height(10.dp))
                GaugeLegend(segments)
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(18.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("توزيع المهام — 7 أيام قادمة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.weight(1f))
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(AccentGreen.copy(alpha = 0.16f))
                                .padding(horizontal = 12.dp, vertical = 5.dp)
                        ) {
                            Text("من اليوم", style = MaterialTheme.typography.labelSmall, color = AccentGreen)
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                    DottedBars(data = weekBars(tasks, today))
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
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("حسب الجهة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(12.dp))
                    tasks.groupBy { it.category }.entries
                        .sortedByDescending { it.value.size }
                        .take(6)
                        .forEach { (category, list) ->
                            val completed = list.count { it.status == TaskStatus.DONE }
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    category,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.inkSoft,
                                    modifier = Modifier.width(112.dp)
                                )
                                ThinProgress(
                                    progress = if (list.isEmpty()) 0f else completed.toFloat() / list.size,
                                    modifier = Modifier.weight(1f),
                                    height = 7.dp
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    "$completed/${list.size}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.inkMuted
                                )
                            }
                        }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp, color = colors.tileSky) {
                Column(Modifier.padding(18.dp)) {
                    Text("أثقل الأيام", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(6.dp))
                    val heaviest = tasks.groupBy { it.dueDate }.maxByOrNull { it.value.size }
                    Text(
                        heaviest?.let {
                            "${Ar.fullDate(it.key)} — ${it.value.size} تسليمات. وزّع العمل قبله بيومين على الأقل."
                        } ?: "لا توجد بيانات كافية بعد.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkSoft
                    )
                }
            }
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
        Text(label, style = MaterialTheme.typography.bodyMedium, color = colors.inkSoft, modifier = Modifier.width(88.dp))
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

private fun weekBars(tasks: List<Task>, today: LocalDate): List<BarDatum> =
    (0..6).map { today.plusDays(it.toLong()) }.map { date ->
        BarDatum(
            label = Ar.dayShort(date),
            value = tasks.count { it.dueDate == date }.toFloat(),
            highlighted = date == today
        )
    }

private fun shareReport(context: android.content.Context, tasks: List<Task>, rate: Float) {
    val body = buildString {
        appendLine("تقرير المهام — ${Ar.fullDate(LocalDate.now())}")
        appendLine("نسبة الإنجاز: ${(rate * 100).toInt()}%")
        appendLine()
        tasks.sortedBy { it.dueDate }.forEach { t ->
            val mark = when {
                t.status == TaskStatus.DONE -> "[مكتملة]"
                t.isOverdue() -> "[متأخرة]"
                else -> "[${Ar.relative(t.dueDate)}]"
            }
            appendLine("$mark ${t.title} — ${Ar.fullDate(t.dueDate)}")
        }
    }
    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(android.content.Intent.EXTRA_SUBJECT, "تقرير المهام")
        putExtra(android.content.Intent.EXTRA_TEXT, body)
    }
    context.startActivity(android.content.Intent.createChooser(intent, "مشاركة التقرير"))
}
