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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.EmptyState
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.TaskCard
import com.almarar.mahami.ui.theme.MahamiTheme

/** أرشيف المهام المكتملة مع بحث وتجميع شهري */
@Composable
fun ArchiveScreen(vm: MahamiViewModel, onOpenTask: (Long) -> Unit, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }

    val done = tasks
        .filter { it.status == TaskStatus.DONE }
        .filter { query.isBlank() || it.title.contains(query, true) }
        .sortedByDescending { it.completedAt ?: it.dueDate.atStartOfDay() }

    val grouped = done.groupBy {
        val date = (it.completedAt?.toLocalDate() ?: it.dueDate)
        "${Ar.monthName(date.monthValue)} ${date.year}"
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconBack(onBack)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("الأرشيف", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Text(
                        "${Ar.countTasks(done.size)} مكتملة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, elevation = 4.dp) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Rounded.Search, null,
                        tint = colors.inkMuted,
                        modifier = Modifier.width(20.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) {
                            Text(
                                "ابحث في المهام المكتملة...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted
                            )
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = { query = it },
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        if (done.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Rounded.Inventory2,
                    title = "الأرشيف فارغ",
                    body = "المهام التي تنجزها تظهر هنا مرتبة حسب الشهر."
                )
            }
        }

        grouped.forEach { (month, items) ->
            item(key = "header-$month") {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(colors.surfaceMuted)
                        .padding(horizontal = 14.dp, vertical = 7.dp)
                ) {
                    Text(
                        "$month — ${items.size}",
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.inkSoft
                    )
                }
            }
            items(items.size, key = { items[it].id }) { index ->
                val task = items[index]
                TaskCard(
                    task = task,
                    project = vm.projectOf(task),
                    onClick = { onOpenTask(task.id) },
                    onToggleDone = { vm.toggleDone(task) }
                )
            }
        }
    }
}

@Composable
private fun CircleIconBack(onBack: () -> Unit) {
    com.almarar.mahami.ui.components.CircleIconButton(
        Icons.Rounded.ArrowForward,
        "رجوع"
    ) { onBack() }
}
