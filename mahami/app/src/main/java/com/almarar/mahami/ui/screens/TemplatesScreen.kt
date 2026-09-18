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
import androidx.compose.material.icons.rounded.ArrowForward
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.Templates
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.priorityColor
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.LocalDate

/** اختيار قالب جاهز لإنشاء مهمة بخطواتها */
@Composable
fun TemplatesScreen(
    vm: MahamiViewModel,
    onCreated: (Long) -> Unit,
    onBack: () -> Unit
) {
    val colors = MahamiTheme.colors
    val projects by vm.projects.collectAsStateWithLifecycle()
    var projectId by remember { mutableStateOf<Long?>(null) }
    val today = LocalDate.now()

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("قوالب جاهزة", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Text(
                        "اختر قالباً لتُنشأ المهمة بخطواتها وموعدها ومستوى أولويتها",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        if (projects.isNotEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "أضف إلى مشروع",
                            style = MaterialTheme.typography.labelMedium,
                            color = colors.inkMuted
                        )
                        Spacer(Modifier.height(10.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item {
                                ProjectChip("بدون", projectId == null, null) { projectId = null }
                            }
                            items(projects) { project ->
                                ProjectChip(
                                    project.name,
                                    projectId == project.id,
                                    Color(project.colorArgb)
                                ) { projectId = project.id }
                            }
                        }
                    }
                }
            }
        }

        items(Templates.tasks, key = { it.id }) { template ->
            SoftCard(
                Modifier.fillMaxWidth(),
                corner = 24.dp,
                elevation = 6.dp,
                onClick = { vm.createFromTemplate(template, projectId) { id -> onCreated(id) } }
            ) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(colors.surfaceMuted),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(template.emoji, style = MaterialTheme.typography.titleLarge)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                template.name,
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.ink
                            )
                            Text(
                                template.hint,
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Pill(
                            template.priority.label,
                            priorityColor(template.priority).copy(alpha = 0.14f),
                            priorityColor(template.priority)
                        )
                        Pill(
                            Ar.relative(today.plusDays(template.offsetDays), today),
                            colors.surfaceMuted,
                            colors.inkMuted
                        )
                        if (template.steps.isNotEmpty()) {
                            Pill("${template.steps.size} خطوات", colors.surfaceMuted, colors.inkMuted)
                        }
                    }
                    if (template.steps.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        template.steps.take(3).forEach {
                            Text(
                                "• $it",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                        if (template.steps.size > 3) {
                            Text(
                                "و${template.steps.size - 3} خطوات أخرى",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.accent
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProjectChip(label: String, selected: Boolean, dot: Color?, onClick: () -> Unit) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) colors.accent.copy(alpha = 0.14f) else colors.surfaceMuted)
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (dot != null) {
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(dot)
            )
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) colors.accent else colors.inkMuted
        )
    }
}
