package com.almarar.mahami.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
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
import java.time.LocalDate

fun priorityColor(p: Priority): Color = when (p) {
    Priority.HIGH -> AccentRed
    Priority.MEDIUM -> AccentYellow
    Priority.LOW -> AccentGreen
}

/** لون حالة المهمة: مكتملة، متأخرة، اليوم، أو حسب الأولوية */
fun statusColor(task: Task, today: LocalDate = LocalDate.now()): Color = when {
    task.status == TaskStatus.DONE -> AccentGreen
    task.dueDate.isBefore(today) -> AccentRed
    task.dueDate == today -> AccentYellow
    else -> priorityColor(task.priority)
}

/** بطاقة مهمة داخل القوائم */
@Composable
fun TaskCard(
    task: Task,
    project: Project?,
    modifier: Modifier = Modifier,
    today: LocalDate = LocalDate.now(),
    onClick: () -> Unit,
    onToggleDone: () -> Unit
) {
    val colors = MahamiTheme.colors
    val done = task.status == TaskStatus.DONE
    val accent = statusColor(task, today)

    SoftCard(modifier = modifier.fillMaxWidth(), onClick = onClick, elevation = 6.dp, corner = 24.dp) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(if (done) AccentGreen else colors.surfaceMuted)
                    .clickable { onToggleDone() }
                    .semantics {
                        contentDescription = if (done) "إلغاء الإنجاز" else "وضع علامة إنجاز"
                    },
                contentAlignment = Alignment.Center
            ) {
                if (done) {
                    Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(19.dp))
                } else {
                    Box(
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
                        text = if (done) "مكتملة" else Ar.relative(task.dueDate, today),
                        background = accent.copy(alpha = 0.14f),
                        textColor = accent
                    )
                    Text(
                        Ar.fullDate(task.dueDate),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted,
                        maxLines = 1
                    )
                    if (task.repeat != RepeatMode.NONE) {
                        Icon(
                            Icons.Rounded.Repeat, "متكررة",
                            tint = colors.inkMuted, modifier = Modifier.size(13.dp)
                        )
                    }
                }

                if (project != null) {
                    Spacer(Modifier.height(5.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(Color(project.colorArgb))
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            project.name,
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.inkMuted
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
                    }
                }
            }

            Spacer(Modifier.width(8.dp))
            ProgressRing(
                progress = task.progress,
                color = accent,
                modifier = Modifier.size(46.dp),
                stroke = 5.dp
            )
        }
    }
}
