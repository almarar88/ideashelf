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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.ai.AiSource
import com.almarar.mahami.ai.RiskLevel
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.Pill
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.AccentYellow
import com.almarar.mahami.ui.theme.MahamiTheme

private val quickPrompts = listOf(
    "ما الذي أبدأ به اليوم؟",
    "ما المهام المتأخرة؟",
    "أين التعارضات في جدولي؟",
    "لخّص لي الأسبوع",
    "ما الذي يعتمد على رد الآخرين؟"
)

@Composable
fun AssistantScreen(
    vm: MahamiViewModel,
    onOpenSmartAdd: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenTask: (Long) -> Unit
) {
    val colors = MahamiTheme.colors
    val state by vm.assistant.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) { vm.refreshCloudState() }
    LaunchedEffect(state.messages.size, state.plan.size, state.risks.size, state.summary) {
        val target = listState.layoutInfo.totalItemsCount - 1
        if (target > 0) listState.animateScrollToItem(target)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
    ) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item { AssistantHeader(state.cloudReady, state.lastSource, state.notice, onOpenSettings) }

            items(state.messages) { message ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = if (message.fromUser) Arrangement.End else Arrangement.Start
                ) {
                    SoftCard(
                        modifier = Modifier.fillMaxWidth(0.92f),
                        color = if (message.fromUser) colors.tileSky else colors.surface,
                        corner = 22.dp,
                        elevation = 4.dp
                    ) {
                        Box(Modifier.padding(14.dp)) {
                            if (message.pending) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = colors.accent
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    Text(
                                        "يفكّر...",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.inkMuted
                                    )
                                }
                            } else {
                                Text(
                                    message.text,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = colors.ink
                                )
                            }
                        }
                    }
                }
            }

            if (state.summary.isNotBlank()) {
                item { ResultCard("الملخص الأسبوعي", state.summary) { clipboard.setText(AnnotatedString(state.summary)) } }
            }

            if (state.risks.isNotEmpty()) {
                item {
                    Column {
                        Text("المخاطر والتعارضات", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                        Spacer(Modifier.height(10.dp))
                        state.risks.forEach { risk ->
                            val tint = when (risk.level) {
                                RiskLevel.HIGH -> AccentRed
                                RiskLevel.MEDIUM -> AccentYellow
                                RiskLevel.LOW -> AccentGreen
                            }
                            SoftCard(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                corner = 22.dp,
                                elevation = 4.dp,
                                onClick = { risk.taskIds.firstOrNull()?.let(onOpenTask) }
                            ) {
                                Row(Modifier.padding(16.dp)) {
                                    Box(
                                        Modifier
                                            .width(4.dp)
                                            .height(42.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(tint)
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                risk.title,
                                                style = MaterialTheme.typography.titleSmall,
                                                color = colors.ink
                                            )
                                            Spacer(Modifier.width(8.dp))
                                            Pill(risk.level.label, tint.copy(alpha = 0.14f), tint)
                                        }
                                        Spacer(Modifier.height(4.dp))
                                        Text(
                                            risk.body,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = colors.inkMuted
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (state.plan.isNotEmpty()) {
                item {
                    Column {
                        Text("خطة اليوم", style = MaterialTheme.typography.titleLarge, color = colors.ink)
                        Spacer(Modifier.height(10.dp))
                        SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
                            Column(Modifier.padding(16.dp)) {
                                state.plan.forEachIndexed { index, item ->
                                    Row(
                                        Modifier
                                            .fillMaxWidth()
                                            .clickable { item.taskId?.let(onOpenTask) }
                                            .padding(vertical = 8.dp)
                                    ) {
                                        Box(
                                            Modifier
                                                .size(26.dp)
                                                .clip(CircleShape)
                                                .background(colors.accent.copy(alpha = 0.14f)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                "${index + 1}",
                                                style = MaterialTheme.typography.labelMedium,
                                                color = colors.accent
                                            )
                                        }
                                        Spacer(Modifier.width(12.dp))
                                        Column(Modifier.weight(1f)) {
                                            Text(
                                                item.title,
                                                style = MaterialTheme.typography.titleSmall,
                                                color = colors.ink
                                            )
                                            Text(
                                                "${item.slot} — ${item.reason}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = colors.inkMuted
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        }

        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
        ) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    ActionChip("خطة اليوم", Icons.Rounded.AutoAwesome) { vm.buildDailyPlan() }
                }
                item { ActionChip("المخاطر") { vm.reviewRisks() } }
                item { ActionChip("ملخص الأسبوع") { vm.buildWeeklySummary() } }
                item { ActionChip("استخراج مهام من نص") { onOpenSmartAdd() } }
                items(quickPrompts) { prompt ->
                    ActionChip(prompt) { vm.ask(prompt) }
                }
                item {
                    ActionChip("مسح المحادثة", Icons.Rounded.DeleteSweep) { vm.clearChat() }
                }
            }

            Spacer(Modifier.height(10.dp))

            SoftCard(Modifier.fillMaxWidth(), corner = 28.dp, elevation = 6.dp) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.weight(1f)) {
                        if (input.isEmpty()) {
                            Text(
                                "اسأل عن مهامك...",
                                style = MaterialTheme.typography.bodyLarge,
                                color = colors.inkMuted
                            )
                        }
                        BasicTextField(
                            value = input,
                            onValueChange = { input = it },
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Box(
                        Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(if (input.isBlank()) colors.surfaceMuted else colors.accent)
                            .clickable(enabled = input.isNotBlank() && !state.busy) {
                                vm.ask(input)
                                input = ""
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Rounded.Send, "إرسال",
                            tint = if (input.isBlank()) colors.inkMuted else Color.White,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }
            Spacer(Modifier.height(96.dp))
        }
    }
}

@Composable
private fun AssistantHeader(
    cloudReady: Boolean,
    source: AiSource?,
    notice: String,
    onOpenSettings: () -> Unit
) {
    val colors = MahamiTheme.colors
    Column(Modifier.padding(top = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("المساعد الذكي", style = MaterialTheme.typography.headlineMedium, color = colors.ink)
            Spacer(Modifier.width(10.dp))
            Pill(
                text = if (cloudReady) "Claude متصل" else "المحرك المحلي",
                background = if (cloudReady) AccentGreen.copy(alpha = 0.14f) else colors.surfaceMuted,
                textColor = if (cloudReady) AccentGreen else colors.inkMuted
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            if (cloudReady) "يقرأ مهامك ومواعيدها ويجيب بالعربية."
            else "يعمل الآن دون إنترنت بقدرات محدودة — أضف مفتاح Claude لتفعيل الإجابة الكاملة.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.inkMuted
        )
        if (!cloudReady) {
            Spacer(Modifier.height(8.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(colors.accent.copy(alpha = 0.12f))
                    .clickable { onOpenSettings() }
                    .padding(horizontal = 16.dp, vertical = 9.dp)
            ) {
                Text("إضافة مفتاح Claude", style = MaterialTheme.typography.labelLarge, color = colors.accent)
            }
        }
        if (source != null && notice.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(notice, style = MaterialTheme.typography.bodySmall, color = AccentYellow)
        }
        Spacer(Modifier.height(6.dp))
    }
}

@Composable
private fun ResultCard(title: String, body: String, onCopy: () -> Unit) {
    val colors = MahamiTheme.colors
    SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = colors.ink)
                Spacer(Modifier.weight(1f))
                Icon(
                    Icons.Rounded.ContentCopy, "نسخ",
                    tint = colors.inkMuted,
                    modifier = Modifier
                        .size(18.dp)
                        .clickable { onCopy() }
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(body, style = MaterialTheme.typography.bodyLarge, color = colors.inkSoft)
        }
    }
}

@Composable
private fun ActionChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onClick: () -> Unit
) {
    val colors = MahamiTheme.colors
    Row(
        Modifier
            .clip(RoundedCornerShape(22.dp))
            .background(colors.surface)
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, null, tint = colors.accent, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(label, style = MaterialTheme.typography.labelMedium, color = colors.inkSoft)
    }
}
