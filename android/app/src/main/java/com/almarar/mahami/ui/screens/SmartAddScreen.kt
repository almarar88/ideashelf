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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.ai.AiSource
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.priorityColor
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme
import com.almarar.mahami.util.Ar

/** استخراج المهام من رسالة أو نص ملصوق، ومراجعتها قبل الحفظ */
@Composable
fun SmartAddScreen(vm: MahamiViewModel, onDone: () -> Unit) {
    val colors = MahamiTheme.colors
    val state by vm.extraction.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") {
                    vm.resetExtraction()
                    onDone()
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("إضافة ذكية", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Text(
                        "الصق رسالة أو محضر اجتماع، وسيحوّله التطبيق إلى مهام بمواعيدها",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp, elevation = 6.dp) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("النص", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                        Spacer(Modifier.weight(1f))
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(18.dp))
                                .background(colors.surfaceMuted)
                                .clickable {
                                    clipboard.getText()?.text?.let { vm.setExtractionInput(it) }
                                }
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Rounded.ContentPaste, null,
                                tint = colors.inkSoft, modifier = Modifier.size(14.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("لصق", style = MaterialTheme.typography.labelSmall, color = colors.inkSoft)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Box {
                        if (state.input.isEmpty()) {
                            Text(
                                "مثال: مطلوب إعداد خطة زمنية للتواصل مع الجهات الحكومية وعرضها على رئيس القسم يوم الاثنين 14-09-2026...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkMuted.copy(alpha = 0.6f)
                            )
                        }
                        BasicTextField(
                            value = state.input,
                            onValueChange = vm::setExtractionInput,
                            minLines = 6,
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .clip(RoundedCornerShape(27.dp))
                    .background(if (state.input.isBlank()) colors.inkMuted else colors.accent)
                    .clickable(enabled = state.input.isNotBlank() && !state.busy) { vm.extractTasks() },
                contentAlignment = Alignment.Center
            ) {
                if (state.busy) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(Modifier.width(10.dp))
                        Text("جارٍ التحليل...", style = MaterialTheme.typography.titleMedium, color = Color.White)
                    }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("استخرج المهام", style = MaterialTheme.typography.titleMedium, color = Color.White)
                    }
                }
            }
        }

        if (state.results.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${state.results.size} مهمة مقترحة",
                        style = MaterialTheme.typography.titleLarge,
                        color = colors.ink
                    )
                    Spacer(Modifier.width(8.dp))
                    Pill(
                        text = state.source?.label ?: "",
                        background = if (state.source == AiSource.CLAUDE) AccentGreen.copy(alpha = 0.14f)
                        else colors.surfaceMuted,
                        textColor = if (state.source == AiSource.CLAUDE) AccentGreen else colors.inkMuted
                    )
                }
            }
            if (state.notice.isNotBlank()) {
                item {
                    Text(state.notice, style = MaterialTheme.typography.bodySmall, color = AccentYellow)
                }
            }
        }

        itemsIndexed(state.results) { index, task ->
            SoftCard(
                Modifier.fillMaxWidth(),
                corner = 22.dp,
                elevation = 4.dp,
                onClick = { vm.toggleExtracted(index) }
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                    Box(
                        Modifier
                            .padding(top = 2.dp)
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(if (task.selected) AccentGreen else colors.surfaceMuted),
                        contentAlignment = Alignment.Center
                    ) {
                        if (task.selected) {
                            Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(15.dp))
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(task.title, style = MaterialTheme.typography.titleSmall, color = colors.ink)
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                Ar.fullDate(task.dueDate),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                            Spacer(Modifier.width(8.dp))
                            Pill(
                                task.priority.label,
                                priorityColor(task.priority).copy(alpha = 0.14f),
                                priorityColor(task.priority)
                            )
                            if (!task.dateWasExplicit) {
                                Spacer(Modifier.width(6.dp))
                                Pill("تاريخ مستنتج", AccentYellow.copy(alpha = 0.16f), AccentYellow)
                            }
                        }
                        if (task.owner.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "المتابعة: ${task.owner}",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.inkMuted
                            )
                        }
                        if (task.steps.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            task.steps.take(4).forEach {
                                Text("• $it", style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
                            }
                        }
                    }
                }
            }
        }

        if (state.results.any { it.selected }) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .clip(RoundedCornerShape(27.dp))
                        .background(AccentGreen)
                        .clickable { vm.saveExtracted { onDone() } },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "حفظ ${state.results.count { it.selected }} مهمة",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White
                    )
                }
            }
        }
    }
}
