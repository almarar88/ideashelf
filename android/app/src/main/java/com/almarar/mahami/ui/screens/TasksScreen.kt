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
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.SortMode
import com.almarar.mahami.ui.TaskFilter
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.theme.MahamiTheme

@Composable
fun TasksScreen(vm: MahamiViewModel, onOpenTask: (Long) -> Unit) {
    val colors = MahamiTheme.colors
    val tasks by vm.visibleTasks.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val sort by vm.sort.collectAsStateWithLifecycle()
    val query by vm.query.collectAsStateWithLifecycle()
    val stats by vm.stats.collectAsStateWithLifecycle()

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 110.dp),
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
                        .clickable {
                            val next = SortMode.entries[(sort.ordinal + 1) % SortMode.entries.size]
                            vm.setSort(next)
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.SwapVert, "الترتيب", tint = colors.ink, modifier = Modifier.size(20.dp))
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
                                "ابحث في المهام والجهات...",
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
                            Icons.Rounded.Close, "مسح",
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
                items(TaskFilter.entries.toList()) { f ->
                    val selected = f == filter
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(22.dp))
                            .background(if (selected) colors.ink else colors.surface)
                            .clickable { vm.setFilter(f) }
                            .padding(horizontal = 18.dp, vertical = 10.dp)
                    ) {
                        Text(
                            f.label,
                            style = MaterialTheme.typography.labelLarge,
                            color = if (selected) Color.White else colors.inkMuted
                        )
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
                SoftCard(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(30.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("لا توجد مهام هنا", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "جرّب تغيير التصفية أو أضف مهمة جديدة",
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.inkMuted
                        )
                    }
                }
            }
        }

        items(tasks, key = { it.id }) { task ->
            TaskCard(
                task = task,
                onClick = { onOpenTask(task.id) },
                onToggleDone = { vm.toggleDone(task) }
            )
        }

        item {
            val done = tasks.count { it.status == TaskStatus.DONE }
            Spacer(Modifier.height(4.dp))
            Text(
                "$done مكتملة ضمن العرض الحالي",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted
            )
        }
    }
}
