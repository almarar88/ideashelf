package com.almarar.mahami.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
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
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskLink
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.priorityColor
import com.almarar.mahami.ui.theme.MahamiTheme
import java.time.LocalDate
import java.time.LocalTime

@Composable
fun TaskEditScreen(
    vm: MahamiViewModel,
    taskId: Long?,
    onDone: () -> Unit
) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val projects by vm.projects.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val existing = taskId?.let { id -> tasks.firstOrNull { it.id == id } }

    var title by remember(existing) { mutableStateOf(existing?.title ?: "") }
    var details by remember(existing) { mutableStateOf(existing?.details ?: "") }
    var notes by remember(existing) { mutableStateOf(existing?.notes ?: "") }
    var owner by remember(existing) { mutableStateOf(existing?.owner ?: "") }
    var projectId by remember(existing) { mutableStateOf(existing?.projectId) }
    var date by remember(existing) { mutableStateOf(existing?.dueDate ?: LocalDate.now().plusDays(1)) }
    var time by remember(existing) { mutableStateOf(existing?.dueTime ?: LocalTime.of(9, 0)) }
    var priority by remember(existing) { mutableStateOf(existing?.priority ?: Priority.MEDIUM) }
    var repeat by remember(existing) { mutableStateOf(existing?.repeat ?: Repeat.NONE) }
    var reminders by remember(existing) { mutableStateOf(existing?.remindersEnabled ?: true) }
    var newStep by remember { mutableStateOf("") }
    var newTag by remember { mutableStateOf("") }
    var linkTitle by remember { mutableStateOf("") }
    var linkUrl by remember { mutableStateOf("") }

    val steps = remember(existing) {
        mutableStateListOf<SubTask>().apply { addAll(existing?.subTasks.orEmpty()) }
    }
    val tags = remember(existing) {
        mutableStateListOf<String>().apply { addAll(existing?.tags.orEmpty()) }
    }
    val links = remember(existing) {
        mutableStateListOf<TaskLink>().apply { addAll(existing?.links.orEmpty()) }
    }
    val offsets = remember(existing) {
        mutableStateListOf<Int>().apply {
            addAll(existing?.reminderOffsetsDays ?: settings.defaultReminderOffsets)
        }
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .imePadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") { onDone() }
                Spacer(Modifier.width(12.dp))
                Text(
                    if (existing == null) "مهمة جديدة" else "تعديل المهمة",
                    style = MaterialTheme.typography.headlineSmall,
                    color = colors.ink
                )
            }
        }

        item { LabeledField("عنوان المهمة", title, "مثال: إعداد التقرير الشهري") { title = it } }
        item { LabeledField("التفاصيل", details, "ما المطلوب بالضبط؟", minLines = 3) { details = it } }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("المشروع", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                    Spacer(Modifier.height(10.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            ChoiceChip("بدون", projectId == null) { projectId = null }
                        }
                        items(projects) { project ->
                            ChoiceChip(
                                label = project.name,
                                selected = projectId == project.id,
                                dot = Color(project.colorArgb)
                            ) { projectId = project.id }
                        }
                    }
                }
            }
        }

        item { LabeledField("جهة المتابعة", owner, "مثال: إدارة الشؤون الإدارية") { owner = it } }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SoftCard(
                    Modifier
                        .weight(1f)
                        .height(84.dp),
                    corner = 22.dp,
                    elevation = 4.dp,
                    onClick = {
                        DatePickerDialog(
                            context,
                            { _, y, m, d -> date = LocalDate.of(y, m + 1, d) },
                            date.year, date.monthValue - 1, date.dayOfMonth
                        ).show()
                    }
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("تاريخ التسليم", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                        Spacer(Modifier.height(6.dp))
                        Text(Ar.fullDate(date), style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    }
                }
                SoftCard(
                    Modifier
                        .weight(1f)
                        .height(84.dp),
                    corner = 22.dp,
                    elevation = 4.dp,
                    onClick = {
                        TimePickerDialog(
                            context,
                            { _, h, m -> time = LocalTime.of(h, m) },
                            time.hour, time.minute, false
                        ).show()
                    }
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("الوقت", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                        Spacer(Modifier.height(6.dp))
                        Text(Ar.time(time), style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("الأولوية", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Priority.entries.forEach { value ->
                            val selected = value == priority
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(
                                        if (selected) priorityColor(value).copy(alpha = 0.18f)
                                        else colors.surfaceMuted
                                    )
                                    .clickable { priority = value }
                                    .padding(vertical = 11.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    value.label,
                                    style = MaterialTheme.typography.labelLarge,
                                    color = if (selected) priorityColor(value) else colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("التكرار", style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Repeat.entries.forEach { value ->
                            val selected = value == repeat
                            Box(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(if (selected) colors.ink else colors.surfaceMuted)
                                    .clickable { repeat = value }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    value.label,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (selected) Color.White else colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("تنبيهات المهمة", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                        Spacer(Modifier.weight(1f))
                        Switch(
                            checked = reminders,
                            onCheckedChange = { reminders = it },
                            colors = SwitchDefaults.colors(checkedTrackColor = colors.accent)
                        )
                    }
                    if (reminders) {
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(0, 1, 2, 3, 7).forEach { day ->
                                val selected = offsets.contains(day)
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(
                                            if (selected) colors.accent.copy(alpha = 0.18f)
                                            else colors.surfaceMuted
                                        )
                                        .clickable { if (selected) offsets.remove(day) else offsets.add(day) }
                                        .padding(vertical = 9.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        if (day == 0) "اليوم" else "$day ي",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (selected) colors.accent else colors.inkMuted
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("الخطوات", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(8.dp))
                    steps.forEachIndexed { index, step ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(colors.accent)
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                step.title,
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.inkSoft,
                                modifier = Modifier.weight(1f)
                            )
                            Icon(
                                Icons.Rounded.Close, "حذف الخطوة",
                                tint = colors.inkMuted,
                                modifier = Modifier
                                    .size(17.dp)
                                    .clickable { steps.removeAt(index) }
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    InlineAdd(
                        value = newStep,
                        placeholder = "أضف خطوة...",
                        onValueChange = { newStep = it }
                    ) {
                        if (newStep.isNotBlank()) {
                            steps.add(SubTask(newStep.trim()))
                            newStep = ""
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("الوسوم", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(8.dp))
                    if (tags.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            tags.forEachIndexed { index, tag ->
                                Row(
                                    Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(colors.surfaceMuted)
                                        .clickable { tags.removeAt(index) }
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "#$tag",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = colors.inkSoft
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Icon(
                                        Icons.Rounded.Close, null,
                                        tint = colors.inkMuted, modifier = Modifier.size(11.dp)
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                    InlineAdd(
                        value = newTag,
                        placeholder = "أضف وسماً...",
                        onValueChange = { newTag = it }
                    ) {
                        val clean = newTag.trim().removePrefix("#")
                        if (clean.isNotBlank() && clean !in tags) tags.add(clean)
                        newTag = ""
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
                Column(Modifier.padding(16.dp)) {
                    Text("روابط", style = MaterialTheme.typography.titleSmall, color = colors.ink)
                    Spacer(Modifier.height(8.dp))
                    links.forEachIndexed { index, link ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    link.title.ifBlank { link.url },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.inkSoft
                                )
                                Text(
                                    link.url,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.inkMuted,
                                    maxLines = 1
                                )
                            }
                            Icon(
                                Icons.Rounded.Close, "حذف الرابط",
                                tint = colors.inkMuted,
                                modifier = Modifier
                                    .size(17.dp)
                                    .clickable { links.removeAt(index) }
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    PlainField("اسم الرابط", linkTitle) { linkTitle = it }
                    Spacer(Modifier.height(8.dp))
                    InlineAdd(
                        value = linkUrl,
                        placeholder = "https://...",
                        onValueChange = { linkUrl = it }
                    ) {
                        if (linkUrl.isNotBlank()) {
                            links.add(TaskLink(linkTitle.trim(), linkUrl.trim()))
                            linkTitle = ""
                            linkUrl = ""
                        }
                    }
                }
            }
        }

        item { LabeledField("ملاحظات", notes, "أي تفاصيل إضافية", minLines = 3) { notes = it } }

        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(if (title.isBlank()) colors.inkMuted else colors.accent)
                    .clickable(enabled = title.isNotBlank()) {
                        val task = (existing ?: Task(title = title, dueDate = date)).copy(
                            title = title.trim(),
                            details = details.trim(),
                            notes = notes.trim(),
                            projectId = projectId,
                            owner = owner.trim(),
                            dueDate = date,
                            dueTime = time,
                            priority = priority,
                            repeat = repeat,
                            remindersEnabled = reminders,
                            reminderOffsetsDays = offsets.toList().ifEmpty { listOf(0) },
                            subTasks = steps.toList(),
                            tags = tags.toList(),
                            links = links.toList()
                        )
                        vm.save(task) { onDone() }
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (existing == null) "حفظ المهمة" else "حفظ التعديلات",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White
                )
            }
        }
    }
}

@Composable
private fun ChoiceChip(
    label: String,
    selected: Boolean,
    dot: Color? = null,
    onClick: () -> Unit
) {
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

@Composable
private fun LabeledField(
    label: String,
    value: String,
    placeholder: String,
    minLines: Int = 1,
    onChange: (String) -> Unit
) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 22.dp, elevation = 4.dp) {
        Column(Modifier.padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = colors.inkMuted)
            Spacer(Modifier.height(8.dp))
            Box {
                if (value.isEmpty()) {
                    Text(
                        placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = colors.inkMuted.copy(alpha = 0.6f)
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onChange,
                    minLines = minLines,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                    cursorBrush = SolidColor(colors.accent),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun PlainField(placeholder: String, value: String, onChange: (String) -> Unit) {
    val colors = MahamiTheme.colors
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surfaceMuted)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        if (value.isEmpty()) {
            Text(
                placeholder,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.inkMuted.copy(alpha = 0.6f)
            )
        }
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
            cursorBrush = SolidColor(colors.accent),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun InlineAdd(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    onAdd: () -> Unit
) {
    val colors = MahamiTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(
                    placeholder,
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.inkMuted.copy(alpha = 0.6f)
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.ink),
                cursorBrush = SolidColor(colors.accent),
                modifier = Modifier.fillMaxWidth()
            )
        }
        Spacer(Modifier.width(8.dp))
        Box(
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(colors.accent)
                .clickable { onAdd() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Rounded.Add, "إضافة", tint = Color.White, modifier = Modifier.size(18.dp))
        }
    }
}
