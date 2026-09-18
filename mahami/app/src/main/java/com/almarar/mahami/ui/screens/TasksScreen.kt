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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.Inbox
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SwapVert
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.SortMode
import com.almarar.mahami.ui.TaskFilter
import com.almarar.mahami.ui.components.EmptyState
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.theme.MahamiTheme

@Composable
fun TasksScreen(
    vm: MahamiViewModel,
    onOpenTask: (Long) -> Unit,
    onNewTask: () -> Unit,
    onOpenProjects: () -> Unit
) {
    val colors = MahamiTheme.colors
    val tasks by vm.visibleTasks.collectAsStateWithLifecycle()
    val projects by vm.projects.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val sort by vm.sort.collectAsStateWithLifecycle()
    val query by vm.query.collectAsStateWithLifecycle()
    val projectFilter by vm.projectFilter.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("المهام", style = MaterialTheme.typography.headlineMedium, color = colors.ink)
                    Text(
                        "${stats.total - stats.done} مفتوحة من ${stats.total}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable { onOpenProjects() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.FolderOpen, "المشاريع",
                        tint = colors.ink, modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable {
                            vm.setSort(SortMode.entries[(sort.ordinal + 1) % SortMode.entries.size])
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.SwapVert, "الترتيب",
                        tint = colors.ink, modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 26.dp, elevation = 6.dp) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Rounded.Search, null, tint = colors.inkMuted, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) {
                            Text(
                                "ابحث في المهام والجهات والوسوم...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted
                            )
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = vm::setQuery,
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (query.isNotEmpty()) {
                        Icon(
                            Icons.Rounded.Close, "مسح البحث",
                            tint = colors.inkMuted,
                            modifier = Modifier
                                .size(18.dp)
                                .clickable { vm.setQuery("") }
                        )
                    }
                }
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(TaskFilter.entries.toList()) { value ->
                    FilterChip(value.label, value == filter) { vm.setFilter(value) }
                }
            }
        }

        if (projects.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip("كل المشاريع", projectFilter == null) { vm.setProjectFilter(null) }
                    }
                    items(projects) { project ->
                        FilterChip(
                            label = project.name,
                            selected = projectFilter == project.id,
                            dotColor = Color(project.colorArgb)
                        ) {
                            vm.setProjectFilter(if (projectFilter == project.id) null else project.id)
                        }
                    }
                }
            }
        }

        item {
            Text(
                "الترتيب: ${sort.label}",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted
            )
        }

        if (tasks.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Rounded.Inbox,
                    title = when (filter) {
                        TaskFilter.DONE -> "لا مهام مكتملة بعد"
                        TaskFilter.LATE -> "لا توجد مهام متأخرة"
                        TaskFilter.TODAY -> "لا مهام مستحقة اليوم"
                        else -> "لا توجد مهام هنا"
                    },
                    body = "جرّب تغيير التصفية أو أضف مهمة جديدة.",
                    actionLabel = "إضافة مهمة",
                    onAction = onNewTask
                )
            }
        }

        items(tasks, key = { it.id }) { task ->
            TaskCard(
                task = task,
                project = vm.projectOf(task),
                onClick = { onOpenTask(task.id) },
                onToggleDone = { vm.toggleDone(task) }
            )
        }

        if (tasks.isNotEmpty()) {
            item {
                Spacer(Modifier.height(4.dp))
                Text(
                    "${Ar.countTasks(tasks.size)} في العرض الحالي",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.inkMuted
                )
            }
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    selected: Boolean,
    dotColor: Color? = null,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .clip(RoundedCornerShape(22.dp))
            .background(if (selected) colors.ink else colors.surface)
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (dotColor != null) {
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) Color.White else colors.inkMuted
        )
    }
}
