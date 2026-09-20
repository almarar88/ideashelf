package com.almarar.mahami.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.almarar.mahami.core.Ar
import com.almarar.mahami.smart.ParsedTask
import com.almarar.mahami.ui.VoicePhase
import com.almarar.mahami.ui.VoiceState
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme

/**
 * ورقة الإدخال الصوتي: تستمع، تعرض ما تسمعه لحظةً بلحظة،
 * ثم تعرض ما فهمته كمهام قابلة للإلغاء قبل الحفظ.
 */
@Composable
fun VoiceSheet(
    state: VoiceState,
    onStop: () -> Unit,
    onRetry: () -> Unit,
    onToggle: (Int) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    if (!state.visible) return
    val colors = MahamiTheme.colors

    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0x99000000))
            .clickable(enabled = state.phase != VoicePhase.LISTENING) { onDismiss() },
        contentAlignment = Alignment.BottomCenter
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp))
                .background(colors.background)
                .clickable(enabled = false) {}
                .navigationBarsPadding()
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp)
            ) {
                // مقبض السحب
                Box(
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .width(44.dp)
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(colors.hairline)
                )
                Spacer(Modifier.height(18.dp))

                when (state.phase) {
                    VoicePhase.LISTENING -> Listening(state, onStop)
                    VoicePhase.REVIEW -> Review(state, onToggle, onConfirm, onRetry, onDismiss)
                    VoicePhase.ERROR -> Failure(state, onRetry, onDismiss)
                    VoicePhase.HIDDEN -> Unit
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.Listening(state: VoiceState, onStop: () -> Unit) {
    val colors = MahamiTheme.colors

    Text(
        "أستمع إليك…",
        style = MaterialTheme.typography.titleLarge,
        color = colors.ink,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )
    Spacer(Modifier.height(6.dp))
    Text(
        "قل مهمتك وموعدها. تفصل بين المهام بكلمة «ثم».",
        style = MaterialTheme.typography.bodySmall,
        color = colors.inkMuted,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )

    Spacer(Modifier.height(22.dp))
    VoiceWave(level = state.level)
    Spacer(Modifier.height(20.dp))

    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 76.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(colors.surface)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            state.partial.ifBlank { "…" },
            style = MaterialTheme.typography.bodyLarge,
            color = if (state.partial.isBlank()) colors.inkMuted else colors.ink,
            textAlign = TextAlign.Center
        )
    }

    Spacer(Modifier.height(20.dp))
    Box(
        Modifier
            .align(Alignment.CenterHorizontally)
            .size(66.dp)
            .clip(CircleShape)
            .background(colors.accent)
            .clickable { onStop() },
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.Rounded.Stop, "إنهاء", tint = Color.White, modifier = Modifier.size(28.dp))
    }
    Spacer(Modifier.height(8.dp))
    Text(
        "اضغط عند الانتهاء",
        style = MaterialTheme.typography.labelMedium,
        color = colors.inkMuted,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )
}

@Composable
private fun Review(
    state: VoiceState,
    onToggle: (Int) -> Unit,
    onConfirm: () -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit
) {
    val colors = MahamiTheme.colors
    val count = state.selected.size

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(
                "فهمت ${Ar.countTasks(state.candidates.size)}",
                style = MaterialTheme.typography.titleLarge,
                color = colors.ink,
                fontWeight = FontWeight.Bold
            )
            Text(
                "«${state.heard}»",
                style = MaterialTheme.typography.bodySmall,
                color = colors.inkMuted,
                maxLines = 2
            )
        }
        Box(
            Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(colors.surface)
                .clickable { onRetry() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Rounded.Refresh, "إعادة", tint = colors.inkSoft, modifier = Modifier.size(19.dp))
        }
    }

    Spacer(Modifier.height(16.dp))
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(max = 340.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        state.candidates.forEachIndexed { index, task ->
            CandidateRow(task, index !in state.skipped) { onToggle(index) }
        }
    }

    Spacer(Modifier.height(18.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(colors.surfaceMuted)
                .clickable { onDismiss() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Rounded.Close, "إلغاء", tint = colors.inkSoft, modifier = Modifier.size(22.dp))
        }
        Box(
            Modifier
                .weight(1f)
                .height(54.dp)
                .clip(RoundedCornerShape(27.dp))
                .background(if (count == 0) colors.surfaceMuted else colors.accent)
                .clickable(enabled = count > 0) { onConfirm() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                if (count == 0) "لم تختر شيئاً" else "أضف ${Ar.countTasks(count)}",
                style = MaterialTheme.typography.titleSmall,
                color = if (count == 0) colors.inkMuted else Color.White
            )
        }
    }
    Spacer(Modifier.height(6.dp))
}

@Composable
private fun CandidateRow(task: ParsedTask, selected: Boolean, onToggle: () -> Unit) {
    val colors = MahamiTheme.colors
    SoftCard(
        Modifier.fillMaxWidth(),
        color = if (selected) colors.surface else colors.surfaceMuted,
        corner = 20.dp,
        elevation = if (selected) 6.dp else 0.dp,
        onClick = onToggle
    ) {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(if (selected) colors.accent else colors.hairline),
                contentAlignment = Alignment.Center
            ) {
                if (selected) {
                    Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (selected) colors.ink else colors.inkMuted
                )
                if (task.matches.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        task.matches.forEach { chip ->
                            Text(
                                chip.label,
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.accent,
                                modifier = Modifier
                                    .padding(top = 4.dp)
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(colors.accent.copy(alpha = 0.10f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.Failure(state: VoiceState, onRetry: () -> Unit, onDismiss: () -> Unit) {
    val colors = MahamiTheme.colors
    Box(
        Modifier
            .align(Alignment.CenterHorizontally)
            .size(60.dp)
            .clip(CircleShape)
            .background(AccentRed.copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(Icons.Rounded.Mic, null, tint = AccentRed, modifier = Modifier.size(26.dp))
    }
    Spacer(Modifier.height(14.dp))
    Text(
        state.message,
        style = MaterialTheme.typography.bodyLarge,
        color = colors.ink,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center
    )
    Spacer(Modifier.height(20.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .weight(1f)
                .height(52.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(colors.surfaceMuted)
                .clickable { onDismiss() },
            contentAlignment = Alignment.Center
        ) {
            Text("إغلاق", style = MaterialTheme.typography.titleSmall, color = colors.inkSoft)
        }
        if (state.canRetry) {
            Box(
                Modifier
                    .weight(1f)
                    .height(52.dp)
                    .clip(RoundedCornerShape(26.dp))
                    .background(colors.accent)
                    .clickable { onRetry() },
                contentAlignment = Alignment.Center
            ) {
                Text("أعد المحاولة", style = MaterialTheme.typography.titleSmall, color = Color.White)
            }
        }
    }
    Spacer(Modifier.height(6.dp))
}

/** موجة أعمدة ترتفع مع صوتك فعلاً — لا حركة وهمية */
@Composable
private fun VoiceWave(level: Float, bars: Int = 21) {
    val colors = MahamiTheme.colors
    val animated by animateFloatAsState(level.coerceIn(0f, 1f), tween(90), label = "voiceLevel")

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(72.dp)
    ) {
        val pitch = size.width / bars
        val barWidth = pitch * 0.34f
        val center = size.height / 2f
        repeat(bars) { index ->
            // الأعمدة الوسطى أعلى، فتبدو الموجة متمركزة حول الصوت
            val fromCenter = kotlin.math.abs(index - (bars - 1) / 2f) / ((bars - 1) / 2f)
            val shape = 1f - fromCenter * 0.78f
            val minHeight = size.height * 0.07f
            val height = minHeight + (size.height * 0.86f) * animated * shape
            val x = pitch * index + pitch / 2f
            drawRoundRect(
                color = if (animated > 0.04f) colors.accent else colors.hairline,
                topLeft = Offset(x - barWidth / 2f, center - height / 2f),
                size = androidx.compose.ui.geometry.Size(barWidth, height),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2f, barWidth / 2f)
            )
        }
    }
}
