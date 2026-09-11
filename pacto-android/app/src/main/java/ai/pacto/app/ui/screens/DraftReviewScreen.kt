package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.domain.engine.Loophole
import ai.pacto.app.domain.engine.LoopholeSeverity
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.TermKind
import ai.pacto.app.platform.speech.SummaryReader
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.state.CaptureViewModel
import ai.pacto.app.ui.state.TimeFormats
import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Draw
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun DraftReviewScreen(
    viewModel: CaptureViewModel,
    onContinue: (Contract) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val draft = state.draft
    val context = LocalContext.current
    val reader = remember { SummaryReader(context) }

    DisposableEffect(Unit) {
        onDispose { reader.release() }
    }

    if (draft == null) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.capture_analyze),
                style = MaterialTheme.typography.headlineSmall,
                color = PactoColors.OnOlive
            )
        }
        return
    }

    val summary = remember(draft) { spokenSummary(draft) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.draft_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton(
                    text = stringResource(R.string.draft_read_aloud),
                    leadingIcon = Icons.Filled.VolumeUp,
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOlive,
                    onClick = { reader.speak(summary) }
                )
                PillButton(
                    text = stringResource(R.string.draft_stop_reading),
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOliveMuted,
                    onClick = { reader.stop() }
                )
            }
        }

        item {
            TermCard(
                title = stringResource(R.string.draft_card_work),
                body = draft.terms.firstOrNull { it.kind == TermKind.SCOPE }?.text ?: "لم يُحدَّد نطاق العمل بعد"
            )
        }
        item {
            TermCard(
                title = stringResource(R.string.draft_card_money),
                body = buildString {
                    append(draft.total.format())
                    draft.terms.firstOrNull { it.kind == TermKind.PAYMENT_SCHEDULE }?.let {
                        append("\n"); append(it.text)
                    }
                }
            )
        }
        item {
            TermCard(
                title = stringResource(R.string.draft_card_time),
                body = draft.terms.firstOrNull { it.kind == TermKind.DEADLINE }?.text
                    ?: draft.milestones.lastOrNull()?.let { "التسليم ${TimeFormats.date(it.dueAt)}" }
                    ?: "لم تُحدَّد مهلة"
            )
        }
        item {
            TermCard(
                title = stringResource(R.string.draft_card_cancel),
                body = draft.terms.firstOrNull { it.kind == TermKind.CANCELLATION }?.text
                    ?: "لا يوجد بند إلغاء متفق عليه"
            )
        }

        if (draft.dialectNotes.isNotEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.draft_dialect_notes),
                    style = MaterialTheme.typography.headlineSmall,
                    color = PactoColors.OnOlive
                )
            }
            items(draft.dialectNotes.size) { index ->
                val note = draft.dialectNotes[index]
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(PactoColors.Ink)
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(note.term, style = MaterialTheme.typography.titleMedium, color = PactoColors.Medium)
                    Text(note.meaning, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnOliveMuted)
                    Text(note.normalizedClause, style = MaterialTheme.typography.bodySmall, color = PactoColors.OnOlive)
                }
            }
        }

        item {
            Text(
                text = stringResource(R.string.draft_loopholes),
                style = MaterialTheme.typography.headlineSmall,
                color = PactoColors.OnOlive
            )
        }

        if (state.loopholes.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.draft_no_loopholes),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnOliveMuted
                )
            }
        } else {
            items(state.loopholes.size) { index ->
                LoopholeCard(
                    loophole = state.loopholes[index],
                    onApply = { term -> viewModel.applyClause(term) },
                    onDismiss = { viewModel.dismissLoophole(state.loopholes[index].id) }
                )
            }
        }

        item {
            PillButton(
                text = stringResource(R.string.draft_continue),
                leadingIcon = Icons.Filled.Draw,
                onClick = { onContinue(draft) }
            )
        }
    }
}

@Composable
private fun TermCard(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Surface)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(title, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnSurfaceMuted)
        Text(body, style = MaterialTheme.typography.titleLarge, color = PactoColors.OnSurface)
    }
}

@Composable
private fun LoopholeCard(
    loophole: Loophole,
    onApply: (ai.pacto.app.domain.model.ContractTerm) -> Unit,
    onDismiss: () -> Unit
) {
    val accent = when (loophole.severity) {
        LoopholeSeverity.BLOCKING -> PactoColors.Urgent
        LoopholeSeverity.IMPORTANT -> PactoColors.Medium
        LoopholeSeverity.ADVISORY -> PactoColors.OnOliveMuted
    }
    val severityLabel = when (loophole.severity) {
        LoopholeSeverity.BLOCKING -> stringResource(R.string.draft_severity_blocking)
        LoopholeSeverity.IMPORTANT -> stringResource(R.string.draft_severity_important)
        LoopholeSeverity.ADVISORY -> stringResource(R.string.draft_severity_advisory)
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(PactoColors.Ink)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(severityLabel, style = MaterialTheme.typography.labelLarge, color = accent)
        Text(loophole.question, style = MaterialTheme.typography.titleMedium, color = PactoColors.OnOlive)
        Text(loophole.why, style = MaterialTheme.typography.bodySmall, color = PactoColors.OnOliveMuted)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            loophole.suggestedClause?.let { clause ->
                PillButton(
                    text = stringResource(R.string.draft_fix),
                    onClick = { onApply(clause) },
                    background = PactoColors.Surface,
                    contentColor = PactoColors.OnSurface
                )
            }
            PillButton(
                text = stringResource(R.string.draft_dismiss),
                onClick = onDismiss,
                background = Color.Transparent,
                contentColor = PactoColors.OnOliveMuted
            )
        }
    }
}

private fun spokenSummary(contract: Contract): String = buildString {
    append("ملخص الاتفاق. ")
    contract.terms.firstOrNull { it.kind == TermKind.SCOPE }?.let { append(it.text); append(" ") }
    append("القيمة ${contract.total.format()}. ")
    contract.terms.firstOrNull { it.kind == TermKind.DEADLINE }?.let { append(it.text); append(" ") }
    contract.terms.firstOrNull { it.kind == TermKind.CANCELLATION }?.let { append(it.text) }
}
