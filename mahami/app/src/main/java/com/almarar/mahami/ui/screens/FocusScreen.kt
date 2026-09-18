package com.almarar.mahami.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.almarar.mahami.ui.MahamiViewModel
import com.almarar.mahami.ui.components.CircleIconButton
import com.almarar.mahami.ui.components.ProgressRing
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentRed
import com.almarar.mahami.ui.theme.MahamiTheme

/** مؤقت تركيز بسيط يسجّل الدقائق على المهمة */
@Composable
fun FocusScreen(vm: MahamiViewModel, taskId: Long, onBack: () -> Unit) {
    val colors = MahamiTheme.colors
    val focus by vm.focus.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val summary by vm.focusSummary.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val task = tasks.firstOrNull { it.id == taskId }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(18.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            CircleIconButton(Icons.Rounded.ArrowForward, "رجوع") {
                onBack()
            }
            Spacer(Modifier.width(12.dp))
            Text("وضع التركيز", style = MaterialTheme.typography.headlineSmall, color = colors.ink)
        }

        Spacer(Modifier.height(10.dp))

        Text(
            task?.title ?: focus.taskTitle,
            style = MaterialTheme.typography.titleMedium,
            color = colors.inkMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(28.dp))

        Box(
            Modifier
                .fillMaxWidth()
                .height(260.dp),
            contentAlignment = Alignment.Center
        ) {
            ProgressRing(
                progress = focus.progress,
                modifier = Modifier.size(230.dp),
                stroke = 16.dp,
                color = colors.accent,
                label = if (focus.active) focus.display else "${settings.focusMinutes}:00"
            )
        }

        Spacer(Modifier.height(24.dp))

        if (!focus.active) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(15, 25, 45, 60).forEach { minutes ->
                    val selected = settings.focusMinutes == minutes
                    Box(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(18.dp))
                            .background(if (selected) colors.ink else colors.surfaceMuted)
                            .clickable { vm.setFocusMinutes(minutes) }
                            .padding(vertical = 11.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "$minutes د",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (selected) Color.White else colors.inkMuted
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            PrimaryButton("ابدأ التركيز", colors.accent) { task?.let { vm.startFocus(it) } }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) {
                    if (focus.running) {
                        PrimaryButton("إيقاف مؤقت", colors.ink) { vm.pauseFocus() }
                    } else {
                        PrimaryButton("متابعة", AccentGreen) { vm.resumeFocus() }
                    }
                }
                Box(Modifier.weight(1f)) {
                    PrimaryButton("إنهاء وحفظ", AccentRed) { vm.stopFocus(save = true) }
                }
            }
        }

        Spacer(Modifier.height(22.dp))

        SoftCard(Modifier.fillMaxWidth(), corner = 24.dp) {
            Column(Modifier.padding(18.dp)) {
                Text("تركيزك", style = MaterialTheme.typography.titleMedium, color = colors.ink)
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    FocusStat("اليوم", "${summary.todayMinutes} د")
                    FocusStat("هذا الأسبوع", "${summary.weekMinutes} د")
                    FocusStat("هذه المهمة", "${task?.focusMinutes ?: 0} د")
                }
            }
        }
    }
}

@Composable
private fun FocusStat(label: String, value: String) {
    val colors = MahamiTheme.colors
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.headlineSmall, color = colors.ink)
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.inkMuted)
    }
}

@Composable
private fun PrimaryButton(label: String, color: Color, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(27.dp))
            .background(color)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(label, style = MaterialTheme.typography.titleMedium, color = Color.White)
    }
}
