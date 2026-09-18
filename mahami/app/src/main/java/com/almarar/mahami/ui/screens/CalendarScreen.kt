package com.almarar.mahami.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.data.CalendarView
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.components.statusColor
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import com.almarar.mahami.core.Ar
import com.almarar.mahami.core.CalendarUtils
import java.time.LocalDate

@Composable
fun CalendarScreen(vm: MahamiViewModel, onOpenTask: (Long) -> Unit) {
    val colors = MahamiTheme.colors
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val month by vm.month.collectAsStateWithLifecycle()
    val selected by vm.selectedDate.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val today = LocalDate.now()

    val byDate = tasks.groupBy { it.dueDate }
    val dayTasks = byDate[selected].orEmpty().sortedBy { it.dueTime }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("التقويم", style = MaterialTheme.typography.headlineMedium, color = colors.ink)
                    Text(
                        Ar.hijri(today),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(colors.surface)
                        .clickable { vm.selectDate(today) }
                        .padding(horizontal = 16.dp, vertical = 9.dp)
                ) {
                    Text("اليوم", style = MaterialTheme.typography.labelMedium, color = colors.accent)
                }
            }
        }

        item {
            com.almarar.mahami.ui.components.SegmentedTabs(
                options = CalendarView.entries.map { it.label },
                selectedIndex = settings.calendarView.ordinal,
                onSelect = { vm.setCalendarView(CalendarView.entries[it]) }
            )
        }

        if (settings.calendarView == CalendarView.WEEK) {
            item {
                WeekStrip(
                    days = CalendarUtils.weekOf(selected),
                    selected = selected,
                    today = today,
                    byDate = byDate,
                    onPrevious = { vm.selectDate(selected.minusWeeks(1)) },
                    onNext = { vm.selectDate(selected.plusWeeks(1)) },
                    onSelect = { vm.selectDate(it) }
                )
            }
        }

        if (settings.calendarView == CalendarView.MONTH) {
        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        NavCircle(Icons.Rounded.ChevronRight) { vm.changeMonth(-1) }
                        Spacer(Modifier.weight(1f))
                        Text(
                            "${Ar.monthName(month.monthValue)} ${month.year}",
                            style = MaterialTheme.typography.titleLarge,
                            color = colors.ink
                        )
                        Spacer(Modifier.weight(1f))
                        NavCircle(Icons.Rounded.ChevronLeft, dark = true) { vm.changeMonth(1) }
                    }

                    Spacer(Modifier.height(14.dp))

                    Row(Modifier.fillMaxWidth()) {
                        CalendarUtils.weekHeaders.forEach { h ->
                            Text(
                                h,
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.inkMuted,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    Spacer(Modifier.height(6.dp))

                    CalendarUtils.monthGrid(month).chunked(7).forEach { week ->
                        Row(Modifier.fillMaxWidth()) {
                            week.forEach { date ->
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .aspectRatio(0.86f),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (date != null) {
                                        DayCell(
                                            date = date,
                                            isToday = date == today,
                                            isSelected = date == selected,
                                            tasks = byDate[date].orEmpty(),
                                            onClick = { vm.selectDate(date) }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        LegendDot(AccentRed, "متأخرة أو أولوية عالية")
                        LegendDot(AccentYellow, "اليوم أو أولوية متوسطة")
                        LegendDot(AccentGreen, "مكتملة أو أولوية منخفضة")
                    }
                }
            }
        }

        }

        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    Ar.fullDate(selected),
                    style = MaterialTheme.typography.titleLarge,
                    color = colors.ink
                )
                Spacer(Modifier.weight(1f))
                Pill(
                    text = "${dayTasks.size} مهمة",
                    background = colors.surface,
                    textColor = colors.inkMuted
                )
            }
        }

        if (dayTasks.isEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(26.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("لا توجد مهام في هذا اليوم", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            Ar.relative(selected),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkMuted
                        )
                    }
                }
            }
        }

        items(dayTasks, key = { it.id }) { task ->
            TaskCard(
                task = task,
                project = vm.projectOf(task),
                onClick = { onOpenTask(task.id) },
                onToggleDone = { vm.toggleDone(task) }
            )
        }

        item {
            val upcoming = tasks
                .filter { it.status != TaskStatus.DONE && !it.dueDate.isBefore(today) }
                .sortedBy { it.dueDate }
                .take(5)
            if (upcoming.isNotEmpty()) {
                Column {
                    Spacer(Modifier.height(6.dp))
                    Text("الخط الزمني", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                    Spacer(Modifier.height(10.dp))
                    SoftCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(18.dp)) {
                            upcoming.forEachIndexed { index, task ->
                                TimelineRow(task, last = index == upcoming.lastIndex) { onOpenTask(task.id) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NavCircle(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    dark: Boolean = false,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    Box(
        Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(if (dark) colors.ink else colors.surfaceMuted)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            icon, null,
            tint = if (dark) Color.White else colors.inkSoft,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun DayCell(
    date: LocalDate,
    isToday: Boolean,
    isSelected: Boolean,
    tasks: List<Task>,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    val background = when {
        isSelected -> colors.ink
        isToday -> colors.accent.copy(alpha = 0.12f)
        else -> Color.Transparent
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(2.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(background)
            .clickable { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            date.dayOfMonth.toString(),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal
            ),
            color = when {
                isSelected -> Color.White
                isToday -> colors.accent
                else -> colors.inkSoft
            }
        )
        Spacer(Modifier.height(3.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            tasks.take(3).forEach { task ->
                val dot = statusColor(task)
                Box(
                    Modifier
                        .size(5.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) Color.White else dot)
                )
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    val colors = MahamiTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(Modifier.width(5.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = colors.inkMuted)
    }
}

@Composable
private fun TimelineRow(task: Task, last: Boolean, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(statusColor(task))
            )
            if (!last) {
                Box(
                    Modifier
                        .width(2.dp)
                        .height(46.dp)
                        .background(colors.hairline)
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.padding(bottom = if (last) 0.dp else 14.dp)) {
            Text(task.title, style = MaterialTheme.typography.titleSmall, color = colors.ink)
            Text(
                "${Ar.fullDate(task.dueDate)} • ${Ar.relative(task.dueDate)}",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted
            )
        }
    }
}

/** شريط أسبوعي مع عدد المهام في كل يوم */
@Composable
private fun WeekStrip(
    days: List<LocalDate>,
    selected: LocalDate,
    today: LocalDate,
    byDate: Map<LocalDate, List<Task>>,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onSelect: (LocalDate) -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 30.dp) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                NavCircle(Icons.Rounded.ChevronRight) { onPrevious() }
                Spacer(Modifier.weight(1f))
                Text(
                    "${Ar.shortDate(days.first())} — ${Ar.shortDate(days.last())}",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.ink
                )
                Spacer(Modifier.weight(1f))
                NavCircle(Icons.Rounded.ChevronLeft, dark = true) { onNext() }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth()) {
                days.forEach { date ->
                    val isSelected = date == selected
                    val count = byDate[date].orEmpty().size
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 2.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(
                                when {
                                    isSelected -> colors.ink
                                    date == today -> colors.accent.copy(alpha = 0.12f)
                                    else -> colors.surfaceMuted
                                }
                            )
                            .clickable { onSelect(date) }
                            .padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            Ar.dayShort(date),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSelected) Color.White else colors.inkMuted
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            date.dayOfMonth.toString(),
                            style = MaterialTheme.typography.titleSmall,
                            color = when {
                                isSelected -> Color.White
                                date == today -> colors.accent
                                else -> colors.ink
                            }
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            if (count == 0) "—" else count.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSelected) Color.White.copy(alpha = 0.8f) else colors.inkMuted
                        )
                    }
                }
            }
        }
    }
}
