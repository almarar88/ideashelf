package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.state.CaptureMode
import ai.pacto.app.ui.state.CaptureViewModel
import ai.pacto.app.ui.theme.PactoColors
import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.content.pm.PackageManager

@Composable
fun CaptureScreen(
    viewModel: CaptureViewModel,
    onDraftReady: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.startRecording()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = stringResource(R.string.capture_title),
            style = MaterialTheme.typography.displaySmall,
            color = PactoColors.OnOlive
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ModeChip(
                text = stringResource(R.string.capture_mode_voice),
                selected = state.mode == CaptureMode.VOICE
            ) { viewModel.setMode(CaptureMode.VOICE) }
            ModeChip(
                text = stringResource(R.string.capture_mode_chat),
                selected = state.mode == CaptureMode.CHAT
            ) { viewModel.setMode(CaptureMode.CHAT) }
            ModeChip(
                text = stringResource(R.string.capture_mode_manual),
                selected = state.mode == CaptureMode.MANUAL
            ) { viewModel.setMode(CaptureMode.MANUAL) }
        }

        if (state.mode == CaptureMode.VOICE) {
            VoicePanel(
                isRecording = state.isRecording,
                amplitude = state.amplitude,
                partial = state.partialText,
                onStart = {
                    val granted = ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                    if (granted) viewModel.startRecording() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
                },
                onStop = viewModel::stopRecording
            )
        }

        OutlinedTextField(
            value = state.transcript,
            onValueChange = viewModel::setTranscript,
            label = { Text(stringResource(R.string.capture_transcript)) },
            placeholder = { Text(stringResource(R.string.capture_paste_hint)) },
            modifier = Modifier
                .fillMaxWidth()
                .height(170.dp),
            colors = fieldColors()
        )

        OutlinedTextField(
            value = state.counterpartyName,
            onValueChange = viewModel::setCounterparty,
            label = { Text(stringResource(R.string.capture_speaker_b)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (state.counterpartyIsProvider) "الطرف الآخر هو المنفّذ" else "الطرف الآخر هو الطالب",
                style = MaterialTheme.typography.bodyMedium,
                color = PactoColors.OnOliveMuted
            )
            Switch(
                checked = state.counterpartyIsProvider,
                onCheckedChange = viewModel::setCounterpartyIsProvider
            )
        }

        if (state.turns.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(PactoColors.Ink)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                state.turns.forEach { turn ->
                    Text(
                        text = "${turn.speaker}: ${turn.text}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PactoColors.OnOlive
                    )
                }
            }
        }

        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = PactoColors.Urgent)
        }

        if (state.quotaBlocked) {
            Text(
                text = "انتهت عقود الخطة المجانية لهذا الشهر. الترقية إلى Pacto Pro تتيح عقوداً غير محدودة.",
                style = MaterialTheme.typography.bodyMedium,
                color = PactoColors.Medium
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PillButton(
                text = stringResource(R.string.capture_analyze),
                leadingIcon = Icons.Filled.Bolt,
                onClick = {
                    viewModel.analyze()
                    onDraftReady()
                }
            )
            PillButton(
                text = stringResource(R.string.capture_sample),
                background = PactoColors.Ink,
                contentColor = PactoColors.OnOlive,
                onClick = viewModel::loadSampleConversation
            )
        }
    }
}

@Composable
private fun VoicePanel(
    isRecording: Boolean,
    amplitude: Int,
    partial: String,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Ink)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(if (isRecording) (84 + (amplitude / 900).coerceAtMost(28)).dp else 84.dp)
                .clip(CircleShape)
                .background(if (isRecording) PactoColors.Urgent else PactoColors.InkSoft),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (isRecording) Icons.Filled.Stop else Icons.Filled.Mic,
                contentDescription = null,
                tint = PactoColors.OnOlive,
                modifier = Modifier.size(34.dp)
            )
        }
        Text(
            text = if (isRecording) stringResource(R.string.capture_recording) else stringResource(R.string.capture_record_start),
            style = MaterialTheme.typography.bodyMedium,
            color = PactoColors.OnOliveMuted
        )
        if (partial.isNotBlank()) {
            Text(partial, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnOlive)
        }
        PillButton(
            text = if (isRecording) stringResource(R.string.capture_record_stop) else stringResource(R.string.capture_record_start),
            onClick = if (isRecording) onStop else onStart
        )
    }
}

@Composable
private fun ModeChip(text: String, selected: Boolean, onClick: () -> Unit) {
    PillButton(
        text = text,
        onClick = onClick,
        background = if (selected) PactoColors.Surface else PactoColors.Ink,
        contentColor = if (selected) PactoColors.OnSurface else PactoColors.OnOlive
    )
}

@Composable
internal fun fieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = PactoColors.Ink,
    unfocusedContainerColor = PactoColors.Ink,
    focusedTextColor = PactoColors.OnOlive,
    unfocusedTextColor = PactoColors.OnOlive,
    focusedLabelColor = PactoColors.OnOliveMuted,
    unfocusedLabelColor = PactoColors.OnOliveMuted,
    focusedIndicatorColor = PactoColors.Urgent,
    unfocusedIndicatorColor = PactoColors.InkBorder,
    cursorColor = PactoColors.Urgent
)
