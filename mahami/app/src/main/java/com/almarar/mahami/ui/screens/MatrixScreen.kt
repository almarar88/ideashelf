package com.almarar.mahami.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.EventAvailable
import androidx.compose.material.icons.rounded.LowPriority
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.Quadrant
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.LocalDate

/**
 * مصفوفة أيزنهاور: تقسّم المهام المفتوحة على أربعة أرباع
 * حسب الأهمية (علم «مهمة») والإلحاح (قرب الموعد النهائي).
 */
@Composable
fun MatrixScreen(vm: MahamiViewModel, onOpenTask: (Long) -> Unit, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val today = LocalDate.now()

    val open = tasks.filter { it.status != TaskStatus.DONE }
    val grouped = open.groupBy { it.quadrant(today) }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("مصفوفة الأولويات", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Text(
                        "المهم مقابل العاجل — ${Ar.countTasks(open.size)} مفتوحة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), color = colors.feature, corner = 28.dp) {
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Text(
                        "توزيع اليوم",
                        style = MaterialTheme.typography.labelLarge,
                        color = colors.onFeatureMuted
                    )
                    Spacer(Modifier.height(14.dp))
                    Row(
                        Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(8.dp))
                    ) {
                        Quadrant.entries.forEach { quadrant ->
                            val share = grouped[quadrant]?.size ?: 0
                            if (share > 0) {
                                val weight by animateFloatAsState(
                                    share.toFloat(),
                                    tween(600),
                                    label = "share${quadrant.name}"
                                )
                                Box(
                                    Modifier
                                        .weight(weight.coerceAtLeast(0.01f))
                                        .fillMaxSize()
                                        .background(quadrantColor(quadrant, colors.accent))
                                )
                            }
                        }
                        if (open.isEmpty()) {
                            Box(Modifier.weight(1f).fillMaxSize().background(colors.featureSoft))
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        summaryFor(grouped),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onFeatureMuted
                    )
                }
            }
        }

        Quadrant.entries.forEach { quadrant ->
            val inQuadrant = grouped[quadrant].orEmpty()
                .sortedWith(compareBy({ it.dueDate }, { it.dueTime }))
            item(key = "head_${quadrant.name}") {
                QuadrantHeader(quadrant, inQuadrant.size)
            }
            if (inQuadrant.isEmpty()) {
                item(key = "empty_${quadrant.name}") {
                    Text(
                        "لا شيء هنا",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted,
                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                    )
                }
            }
            items(inQuadrant.size) { index ->
                val task = inQuadrant[index]
                MatrixRow(
                    task = task,
                    quadrant = quadrant,
                    onOpen = { onOpenTask(task.id) },
                    onToggleImportant = { vm.toggleImportant(task) }
                )
            }
        }
    }
}

@Composable
private fun QuadrantHeader(quadrant: Quadrant, count: Int) {
    val colors = MahamiTheme.colors
    val tint = quadrantColor(quadrant, colors.accent)
    Row(
        Modifier.fillMaxWidth().padding(top = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) { Icon(quadrantIcon(quadrant), null, tint = tint, modifier = Modifier.size(18.dp)) }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                quadrant.label,
                style = MaterialTheme.typography.titleSmall,
                color = colors.ink,
                fontWeight = FontWeight.Bold
            )
            Text(quadrant.hint, style = MaterialTheme.typography.labelSmall, color = colors.inkMuted)
        }
        Text(
            "$count",
            style = MaterialTheme.typography.titleMedium,
            color = tint,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun MatrixRow(
    task: Task,
    quadrant: Quadrant,
    onOpen: () -> Unit,
    onToggleImportant: () -> Unit
) {
    val colors = MahamiTheme.colors
    val tint = quadrantColor(quadrant, colors.accent)
    val starScale by animateFloatAsState(if (task.important) 1.1f else 1f, tween(200), label = "star")

    SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 6.dp, onClick = onOpen) {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .width(4.dp)
                    .height(38.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(tint)
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = colors.ink,
                    maxLines = 2
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    Ar.relative(task.dueDate),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (task.dueDate.isBefore(LocalDate.now())) AccentRed else colors.inkMuted
                )
            }
            Box(
                Modifier
                    .size(36.dp)
                    .scale(starScale)
                    .clip(CircleShape)
                    .background(
                        if (task.important) colors.accent.copy(alpha = 0.14f) else Color.Transparent
                    )
                    .clickable { onToggleImportant() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Rounded.Star,
                    "تعليم كمهمة مهمة",
                    tint = if (task.important) colors.accent else colors.inkMuted,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

private fun quadrantIcon(quadrant: Quadrant): ImageVector = when (quadrant) {
    Quadrant.DO_NOW -> Icons.Rounded.Bolt
    Quadrant.SCHEDULE -> Icons.Rounded.EventAvailable
    Quadrant.DELEGATE -> Icons.Rounded.SwapHoriz
    Quadrant.LATER -> Icons.Rounded.LowPriority
}

private fun quadrantColor(quadrant: Quadrant, accent: Color): Color = when (quadrant) {
    Quadrant.DO_NOW -> AccentRed
    Quadrant.SCHEDULE -> AccentGreen
    Quadrant.DELEGATE -> accent
    Quadrant.LATER -> Color(0xFF8A8078)
}

private fun summaryFor(grouped: Map<Quadrant, List<Task>>): String {
    val doNow = grouped[Quadrant.DO_NOW]?.size ?: 0
    val schedule = grouped[Quadrant.SCHEDULE]?.size ?: 0
    val delegate = grouped[Quadrant.DELEGATE]?.size ?: 0
    return when {
        doNow == 0 && schedule == 0 && delegate == 0 -> "لا ضغط اليوم — استغل الوقت للتخطيط."
        doNow >= 4 -> "$doNow مهام في ربع «افعلها الآن» — أجّل أو فوّض بعضها قبل أن تتراكم."
        delegate > doNow + schedule -> "أكثر مهامك عاجلة لكنها غير مهمة — راجع ما يمكن تفويضه."
        schedule > 0 -> "$schedule مهمة تحتاج تخطيطاً مبكراً قبل أن تصبح عاجلة."
        else -> "التوزيع متوازن — واصل."
    }
}
