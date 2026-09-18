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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.FolderOpen
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Stats
import com.almarar.mahami.data.Project
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.ConfirmDialog
import com.almarar.mahami.ui.components.EmptyState
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.ThinProgress
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme
import com.almarar.mahami.ui.theme.ProjectColors

@Composable
fun ProjectsScreen(vm: MahamiViewModel, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val projects by vm.projects.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()

    var newName by remember { mutableStateOf("") }
    var selectedColor by remember { mutableStateOf(ProjectColors.first()) }
    var pendingDelete by remember { mutableStateOf<Project?>(null) }

    val stats = Stats.byProject(tasks, projects)

    pendingDelete?.let { project ->
        ConfirmDialog(
            title = "حذف المشروع؟",
            body = "لن تُحذف مهامه، بل ستُنقل إلى «بدون مشروع».",
            confirmLabel = "حذف",
            destructive = true,
            onConfirm = {
                vm.deleteProject(project)
                pendingDelete = null
            },
            onDismiss = { pendingDelete = null }
        )
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
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onBack() }
                Spacer(Modifier.width(12.dp))
                Text("المشاريع", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("مشروع جديد", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(10.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(colors.surfaceMuted)
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        if (newName.isEmpty()) {
                            Text(
                                "اسم المشروع أو الجهة",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted.copy(alpha = 0.6f)
                            )
                        }
                        BasicTextField(
                            value = newName,
                            onValueChange = { if (it.length <= 30) newName = it },
                            singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProjectColors.forEach { argb ->
                            val selected = argb == selectedColor
                            Box(
                                Modifier
                                    .size(if (selected) 32.dp else 26.dp)
                                    .clip(CircleShape)
                                    .background(Color(argb))
                                    .clickable { selectedColor = argb }
                            )
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                            .clip(RoundedCornerShape(23.dp))
                            .background(if (newName.isBlank()) colors.inkMuted else colors.accent)
                            .clickable(enabled = newName.isNotBlank()) {
                                vm.saveProject(Project(name = newName.trim(), colorArgb = selectedColor))
                                newName = ""
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("إضافة", style = MaterialTheme.typography.labelLarge, color = Color.White)
                    }
                }
            }
        }

        if (projects.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Rounded.FolderOpen,
                    title = "لا توجد مشاريع",
                    body = "المشاريع تساعدك على تجميع المهام حسب الجهة أو الملف."
                )
            }
        }

        items(projects.size, key = { projects[it].id }) { index ->
            val project = projects[index]
            val stat = stats.firstOrNull { it.project?.id == project.id }
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(Color(project.colorArgb))
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(project.name, style = MaterialTheme.typography.titleSmall, color = colors.ink)
                        Spacer(Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ThinProgress(
                                progress = stat?.rate ?: 0f,
                                color = Color(project.colorArgb),
                                modifier = Modifier.weight(1f),
                                height = 6.dp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${stat?.done ?: 0}/${stat?.total ?: 0}",
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.inkMuted
                            )
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Icon(
                        Icons.Rounded.Delete, "حذف المشروع",
                        tint = AccentRed.copy(alpha = 0.8f),
                        modifier = Modifier
                            .size(20.dp)
                            .clickable { pendingDelete = project }
                    )
                }
            }
        }
    }
}
