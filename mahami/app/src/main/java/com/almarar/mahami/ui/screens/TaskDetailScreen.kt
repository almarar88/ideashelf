package com.almarar.mahami.ui.screens

import android.content.Intent
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.BookmarkAdd
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Share
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.core.Ar
import com.almarar.mahami.core.Backup
import com.almarar.mahami.data.MessageTemplate
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.data.Templates
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.ConfirmDialog
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.ProgressRing
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.components.priorityColor
import com.almarar.mahami.ui.components.statusColor
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme

@Composable
fun TaskDetailScreen(
    vm: MahamiViewModel,
    taskId: Long,
    onBack: () -> Unit,
    onEdit: (Long) -> Unit,
    onOpenFocus: (Long) -> Unit = {}
) {
    val colors = MahamiTheme.colors
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val task = tasks.firstOrNull { it.id == taskId }
    val activity by vm.activityFor(taskId).collectAsStateWithLifecycle(emptyList())

    var messageTemplate by remember { mutableStateOf<MessageTemplate?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }

    if (task == null) {
        Box(
            Modifier
                .fillMaxSize()
                .background(colors.background),
            contentAlignment = Alignment.Center
        ) {
            Text("المهمة غير موجودة", style = MaterialTheme.typography.titleMedium, color = colors.inkMuted)
        }
        return
    }

    val project = vm.projectOf(task)
    val accent = statusColor(task)

    if (confirmDelete) {
        ConfirmDialog(
            title = "حذف المهمة؟",
            body = "سيُحذف «${task.title}» وكل خطواته وسجل نشاطه.",
            confirmLabel = "حذف",
            destructive = true,
            onConfirm = {
                confirmDelete = false
                vm.delete(task)
                onBack()
            },
            onDismiss = { confirmDelete = false }
        )
    }

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
                Spacer(Modifier.weight(1f))
                CircleIconButton(
                    Icons.Rounded.PushPin,
                    if (task.pinned) "إلغاء التثبيت" else "تثبيت",
                    tint = if (task.pinned) colors.accent else colors.inkMuted
                ) { vm.togglePinned(task) }
                Spacer(Modifier.width(8.dp))
                CircleIconButton(Icons.Rounded.Share, "مشاركة") { shareTask(context, task) }
                Spacer(Modifier.width(8.dp))
                CircleIconButton(Icons.Rounded.Edit, "تعديل") { onEdit(task.id) }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), color = colors.tileSky, corner = 30.dp) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (project != null) {
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(colors.surface)
                                    .padding(horizontal = 12.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
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
                                    color = colors.inkSoft
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                        }
                        Pill(
                            task.priority.label,
                            priorityColor(task.priority).copy(alpha = 0.16f),
                            priorityColor(task.priority)
                        )
                        Spacer(Modifier.weight(1f))
                        ProgressRing(task.progress, Modifier.size(54.dp), color = accent, stroke = 6.dp)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(task.title, style = MaterialTheme.typography.headlineSmall, color = colors.ink)
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            Ar.fullDate(task.dueDate),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.inkSoft
                        )
                        Spacer(Modifier.width(8.dp))
                        Pill(Ar.relative(task.dueDate), accent.copy(alpha = 0.16f), accent)
                    }
                    Text(
                        if (task.flexibleDeadline) "موعد مرن • ${Ar.time(task.dueTime)}"
                        else "الوقت: ${Ar.time(task.dueTime)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                    if (task.tags.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            task.tags.take(4).forEach {
                                Pill("#$it", colors.surface, colors.inkMuted)
                            }
                        }
                    }
                }
            }
        }

        if (task.alert.isNotBlank()) {
            item {
                SoftCard(
                    Modifier.fillMaxWidth(),
                    color = AccentRed.copy(alpha = 0.08f),
                    corner = 24.dp,
                    elevation = 0.dp
                ) {
                    Row(Modifier.padding(16.dp)) {
                        Box(
                            Modifier
                                .width(4.dp)
                                .height(40.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(AccentRed)
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("تنبيه", style = MaterialTheme.typography.titleSmall, color = AccentRed)
                            Spacer(Modifier.height(4.dp))
                            Text(task.alert, style = MaterialTheme.typography.bodyMedium, color = colors.inkSoft)
                        }
                    }
                }
            }
        }

        if (task.details.isNotBlank()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text("المطلوب", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(6.dp))
                        Text(task.details, style = MaterialTheme.typography.bodyLarge, color = colors.inkSoft)
                    }
                }
            }
        }

        if (task.owner.isNotBlank()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("جهة المتابعة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.weight(1f))
                        Text(task.owner, style = MaterialTheme.typography.bodyMedium, color = colors.inkSoft)
                    }
                }
            }
        }

        if (task.subTasks.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("الخطوات", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                    Spacer(Modifier.weight(1f))
                    Text(
                        "${task.subTasks.count { it.done }} من ${task.subTasks.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                }
            }
            itemsIndexed(task.subTasks) { index, sub ->
                SoftCard(Modifier.fillMaxWidth(), corner = 20.dp, elevation = 4.dp) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { vm.toggleSubTask(task, index) }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .size(26.dp)
                                .clip(CircleShape)
                                .background(if (sub.done) AccentGreen else colors.surfaceMuted),
                            contentAlignment = Alignment.Center
                        ) {
                            if (sub.done) {
                                Icon(
                                    Icons.Rounded.Check, null,
                                    tint = Color.White, modifier = Modifier.size(15.dp)
                                )
                            }
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(
                            sub.title,
                            style = MaterialTheme.typography.bodyLarge,
                            color = if (sub.done) colors.inkMuted else colors.ink
                        )
                    }
                }
            }
        }

        if (task.links.isNotEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text("روابط", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(8.dp))
                        task.links.forEach { link ->
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clickable { openLink(context, link.url) }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Rounded.Link, null,
                                    tint = colors.accent, modifier = Modifier.size(17.dp)
                                )
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Text(
                                        link.title.ifBlank { link.url },
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.ink
                                    )
                                    Text(
                                        link.url,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.inkMuted,
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (task.notes.isNotBlank()) {
            item {
                SoftCard(
                    Modifier.fillMaxWidth(),
                    color = colors.surfaceMuted,
                    corner = 24.dp,
                    elevation = 0.dp
                ) {
                    Column(Modifier.padding(18.dp)) {
                        Text("ملاحظات", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(6.dp))
                        Text(task.notes, style = MaterialTheme.typography.bodyMedium, color = colors.inkSoft)
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("رسالة متابعة جاهزة", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "اختر نموذجاً وسيُعبَّأ ببيانات المهمة تلقائياً",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Templates.messages.forEach { template ->
                            val selected = messageTemplate?.id == template.id
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(
                                        if (selected) colors.accent.copy(alpha = 0.12f) else colors.surfaceMuted
                                    )
                                    .clickable {
                                        messageTemplate = if (selected) null else template
                                    }
                                    .padding(horizontal = 14.dp, vertical = 11.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        template.name,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = if (selected) colors.accent else colors.ink
                                    )
                                    Text(
                                        template.hint,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.inkMuted
                                    )
                                }
                            }
                        }
                    }

                    messageTemplate?.let { template ->
                        val rendered = Templates.render(template, task)
                        Spacer(Modifier.height(14.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(colors.surfaceMuted)
                                .padding(14.dp)
                        ) {
                            Text(rendered, style = MaterialTheme.typography.bodyMedium, color = colors.inkSoft)
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SmallAction(
                                "نسخ",
                                Modifier.weight(1f),
                                icon = Icons.Rounded.ContentCopy
                            ) {
                                clipboard.setText(AnnotatedString(rendered))
                                vm.showToast("نُسخت الرسالة")
                            }
                            SmallAction("إرسال", Modifier.weight(1f), filled = true) {
                                Backup.shareText(context, task.title, rendered)
                            }
                        }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Rounded.Timer, null,
                            tint = colors.accent, modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("وضع التركيز", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.weight(1f))
                        if (task.focusMinutes > 0) {
                            Text(
                                "${task.focusMinutes} دقيقة",
                                style = MaterialTheme.typography.labelMedium,
                                color = colors.inkMuted
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "جلسة مركّزة بمؤقت، وتُسجَّل دقائقها على المهمة",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.inkMuted
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallAction("ابدأ جلسة", Modifier.weight(1f), filled = true) {
                            onOpenFocus(task.id)
                        }
                        SmallAction(
                            "حفظ كقالب",
                            Modifier.weight(1f),
                            icon = Icons.Rounded.BookmarkAdd
                        ) { vm.saveTaskAsTemplate(task) }
                    }
                }
            }
        }

        item {
            SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                Column(Modifier.padding(18.dp)) {
                    Text("تأجيل سريع", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallAction("+ يوم", Modifier.weight(1f)) { vm.postpone(task, 1) }
                        SmallAction("+ 3 أيام", Modifier.weight(1f)) { vm.postpone(task, 3) }
                        SmallAction("+ أسبوع", Modifier.weight(1f)) { vm.postpone(task, 7) }
                    }
                }
            }
        }

        if (activity.isNotEmpty()) {
            item {
                SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                    Column(Modifier.padding(18.dp)) {
                        Text("سجل النشاط", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                        Spacer(Modifier.height(10.dp))
                        activity.take(8).forEach { entry ->
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
                                    entry.text,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.inkSoft,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    "${entry.at.dayOfMonth}/${entry.at.monthValue}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.inkMuted
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier
                        .weight(1f)
                        .height(54.dp)
                        .clip(RoundedCornerShape(27.dp))
                        .background(if (task.status == TaskStatus.DONE) colors.surfaceMuted else AccentGreen)
                        .clickable { vm.toggleDone(task) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        if (task.status == TaskStatus.DONE) "إعادة فتح المهمة" else "تم الإنجاز",
                        style = MaterialTheme.typography.titleMedium,
                        color = if (task.status == TaskStatus.DONE) colors.inkSoft else Color.White
                    )
                }
                Box(
                    Modifier
                        .size(54.dp)
                        .clip(CircleShape)
                        .background(AccentRed.copy(alpha = 0.12f))
                        .clickable { confirmDelete = true },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.Delete, "حذف", tint = AccentRed, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

@Composable
internal fun SmallAction(
    label: String,
    modifier: Modifier = Modifier,
    filled: Boolean = false,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    Row(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (filled) colors.accent else colors.surfaceMuted)
            .clickable { onClick() }
            .padding(vertical = 11.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                icon, null,
                tint = if (filled) Color.White else colors.inkSoft,
                modifier = Modifier.size(14.dp)
            )
            Spacer(Modifier.width(6.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (filled) Color.White else colors.inkSoft
        )
    }
}

private fun shareTask(context: android.content.Context, task: Task) {
    val body = buildString {
        appendLine(task.title)
        appendLine("الموعد: ${Ar.fullDate(task.dueDate)}")
        if (task.details.isNotBlank()) appendLine(task.details)
        if (task.subTasks.isNotEmpty()) {
            appendLine()
            task.subTasks.forEach { appendLine("${if (it.done) "✔" else "•"} ${it.title}") }
        }
        if (task.notes.isNotBlank()) {
            appendLine()
            appendLine(task.notes)
        }
    }
    Backup.shareText(context, task.title, body)
}

private fun openLink(context: android.content.Context, url: String) {
    val normalized = if (url.startsWith("http")) url else "https://$url"
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(normalized)))
    }
}
