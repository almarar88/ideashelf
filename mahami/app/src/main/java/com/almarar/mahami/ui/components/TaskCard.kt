package com.almarar.mahami.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Snooze
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat as RepeatMode
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.roundToInt

fun priorityColor(p: Priority): Color = when (p) {
    Priority.HIGH -> AccentRed
    Priority.MEDIUM -> AccentYellow
    Priority.LOW -> AccentGreen
}

/** لون حالة المهمة */
fun statusColor(task: Task, today: LocalDate = LocalDate.now()): Color = when {
    task.status == TaskStatus.DONE -> AccentGreen
    task.dueDate.isBefore(today) -> AccentRed
    task.dueDate == today -> AccentYellow
    else -> priorityColor(task.priority)
}

/**
 * بطاقة المهمة: تُسحب يميناً للإنجاز ويساراً للتأجيل،
 * وتُفتح بلمسة لتكشف خطواتها دون مغادرة القائمة.
 */
@Composable
fun TaskCard(
    task: Task,
    project: Project?,
    modifier: Modifier = Modifier,
    today: LocalDate = LocalDate.now(),
    blocked: Boolean = false,
    expandable: Boolean = true,
    onClick: () -> Unit,
    onToggleDone: () -> Unit,
    onToggleStep: (Int) -> Unit = {},
    onPostpone: (Long) -> Unit = {}
) {
    val colors = MahamiTheme.colors
    val done = task.status == TaskStatus.DONE
    val accent = statusColor(task, today)
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val offsetX = remember { Animatable(0f) }
    val threshold = with(density) { 96.dp.toPx() }
    var expanded by remember(task.id) { mutableStateOf(false) }

    Box(modifier.fillMaxWidth()) {
        // الطبقة الخلفية التي تظهر أثناء السحب
        Box(
            Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(26.dp))
                .background(
                    when {
                        offsetX.value > 20f -> AccentGreen.copy(alpha = 0.18f)
                        offsetX.value < -20f -> AccentYellow.copy(alpha = 0.18f)
                        else -> Color.Transparent
                    }
                )
                .padding(horizontal = 24.dp),
            contentAlignment = if (offsetX.value > 0) Alignment.CenterStart else Alignment.CenterEnd
        ) {
            if (offsetX.value > 20f) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Check, null, tint = AccentGreen, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("إنجاز", style = MaterialTheme.typography.labelLarge, color = AccentGreen)
                }
            } else if (offsetX.value < -20f) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Snooze, null, tint = AccentYellow, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("تأجيل يوم", style = MaterialTheme.typography.labelLarge, color = AccentYellow)
                }
            }
        }

        SoftCard(
            modifier = Modifier
                .fillMaxWidth()
                .offset { IntOffset(offsetX.value.roundToInt(), 0) }
                .pointerInput(task.id, done) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            scope.launch {
                                when {
                                    offsetX.value > threshold -> {
                                        offsetX.animateTo(0f, tween(220))
                                        onToggleDone()
                                    }
                                    offsetX.value < -threshold -> {
                                        offsetX.animateTo(0f, tween(220))
                                        onPostpone(1)
                                    }
                                    else -> offsetX.animateTo(0f, tween(220))
                                }
                            }
                        }
                    ) { _, dragAmount ->
                        scope.launch {
                            val next = (offsetX.value + dragAmount).coerceIn(-160f, 160f)
                            offsetX.snapTo(next)
                        }
                    }
                },
            corner = 26.dp,
            elevation = 6.dp,
            onClick = { if (expandable && task.subTasks.isNotEmpty()) expanded = !expanded else onClick() }
        ) {
            Column {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(if (done) AccentGreen else colors.surfaceMuted)
                            .clickable { onToggleDone() },
                        contentAlignment = Alignment.Center
                    ) {
                        when {
                            done -> Icon(
                                Icons.Rounded.Check, "إلغاء الإنجاز",
                                tint = Color.White, modifier = Modifier.size(20.dp)
                            )
                            blocked -> Icon(
                                Icons.Rounded.Schedule, "محجوبة",
                                tint = colors.inkMuted, modifier = Modifier.size(17.dp)
                            )
                            task.dueDate.isBefore(today) -> PulsingDot(AccentRed, size = 14.dp)
                            else -> Box(
                                Modifier
                                    .size(11.dp)
                                    .clip(CircleShape)
                                    .background(accent)
                            )
                        }
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.Top) {
                            if (task.pinned) {
                                Icon(
                                    Icons.Rounded.PushPin, "مثبتة",
                                    tint = colors.accent,
                                    modifier = Modifier
                                        .padding(top = 5.dp)
                                        .size(14.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                            }
                            Text(
                                task.title,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = if (done) colors.inkMuted else colors.ink,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                textDecoration = if (done) TextDecoration.LineThrough else null
                            )
                        }

                        Spacer(Modifier.height(5.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Pill(
                                text = when {
                                    done -> "مكتملة"
                                    blocked -> "محجوبة"
                                    else -> Ar.relative(task.dueDate, today)
                                },
                                background = accent.copy(alpha = 0.14f),
                                textColor = accent
                            )
                            if (project != null) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier
                                            .size(7.dp)
                                            .clip(CircleShape)
                                            .background(Color(project.colorArgb))
                                    )
                                    Spacer(Modifier.width(5.dp))
                                    Text(
                                        project.name,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.inkMuted,
                                        maxLines = 1
                                    )
                                }
                            }
                            if (task.repeat != RepeatMode.NONE) {
                                Icon(
                                    Icons.Rounded.Repeat, "متكررة",
                                    tint = colors.inkMuted, modifier = Modifier.size(13.dp)
                                )
                            }
                        }

                        if (task.subTasks.isNotEmpty()) {
                            Spacer(Modifier.height(9.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                ThinProgress(
                                    progress = task.progress,
                                    color = accent,
                                    track = colors.surfaceMuted,
                                    height = 6.dp,
                                    modifier = Modifier.weight(1f)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "${task.subTasks.count { it.done }}/${task.subTasks.size}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.inkMuted
                                )
                                if (expandable) {
                                    val rotation by animateFloatAsState(
                                        targetValue = if (expanded) 180f else 0f,
                                        animationSpec = tween(250, easing = FastOutSlowInEasing),
                                        label = "chevron"
                                    )
                                    Icon(
                                        Icons.Rounded.KeyboardArrowDown, null,
                                        tint = colors.inkMuted,
                                        modifier = Modifier
                                            .padding(start = 4.dp)
                                            .size(18.dp)
                                            .rotate(rotation)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.width(8.dp))
                    RingMeter(
                        progress = task.progress,
                        color = accent,
                        modifier = Modifier.size(46.dp),
                        stroke = 5.dp
                    )
                }

                AnimatedVisibility(
                    visible = expanded,
                    enter = expandVertically(tween(260)) + fadeIn(tween(200)),
                    exit = shrinkVertically(tween(220)) + fadeOut(tween(160))
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(start = 16.dp, end = 16.dp, bottom = 14.dp)
                    ) {
                        task.subTasks.forEachIndexed { index, step ->
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .clickable { onToggleStep(index) }
                                    .padding(vertical = 7.dp, horizontal = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(if (step.done) AccentGreen else colors.surfaceMuted),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (step.done) {
                                        Icon(
                                            Icons.Rounded.Check, null,
                                            tint = Color.White, modifier = Modifier.size(12.dp)
                                        )
                                    }
                                }
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    step.title,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (step.done) colors.inkMuted else colors.inkSoft,
                                    textDecoration = if (step.done) TextDecoration.LineThrough else null,
                                    modifier = Modifier.weight(1f)
                                )
                                step.targetDate?.let { target ->
                                    Text(
                                        Ar.relative(target, today),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (target.isBefore(today) && !step.done) AccentRed
                                        else colors.inkMuted
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "افتح التفاصيل",
                            style = MaterialTheme.typography.labelMedium,
                            color = colors.accent,
                            modifier = Modifier
                                .clickable { onClick() }
                                .padding(8.dp)
                        )
                    }
                }
            }
        }
    }
}
