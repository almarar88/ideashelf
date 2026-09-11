package ai.pacto.app.ui.screens

import ai.pacto.app.PactoApplication
import ai.pacto.app.R
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.platform.vision.AssetCapture
import ai.pacto.app.ui.components.HashChip
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.ProgressTrack
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.state.TimeFormats
import ai.pacto.app.ui.theme.PactoColors
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ContractDetailScreen(
    contractId: String,
    viewModel: PactoViewModel,
    onOpenDispute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    val contract = contracts.firstOrNull { it.id == contractId } ?: return
    val context = LocalContext.current
    val container = remember { (context.applicationContext as PactoApplication).container }
    val assetCapture = remember { AssetCapture(context) }
    val settings by viewModel.settingsState.collectAsStateWithLifecycle()

    var pending by remember { mutableStateOf<AssetCapture.PendingCapture?>(null) }
    var pendingMilestoneId by remember { mutableStateOf<String?>(null) }
    var dialog by remember { mutableStateOf<DetailDialog?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val capture = pending
        if (success && capture != null) {
            val item = assetCapture.seal(
                pending = capture,
                note = when (capture.kind) {
                    EvidenceKind.BEFORE_STATE -> "حالة ما قبل التنفيذ"
                    EvidenceKind.AFTER_STATE -> "حالة ما بعد التنفيذ"
                    EvidenceKind.DEFECT -> "عيب موثق"
                    else -> "توثيق مصور"
                },
                capturedByPartyId = settings.currentPartyId,
                milestoneId = pendingMilestoneId
            )
            if (item != null) viewModel.addEvidence(contract.id, item)
        }
        pending = null
        pendingMilestoneId = null
    }

    fun capture(kind: EvidenceKind, milestoneId: String? = null) {
        val request = assetCapture.newCapture(kind)
        pending = request
        pendingMilestoneId = milestoneId
        cameraLauncher.launch(request.uri)
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = contract.title,
                    style = MaterialTheme.typography.displaySmall,
                    color = PactoColors.OnOlive
                )
                Text(
                    text = "${contract.status} · ${TimeFormats.full(contract.createdAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PactoColors.OnOliveMuted
                )
                contract.sealedHash?.let { HashChip("بصمة: ${it.take(16)}") }
                ProgressTrack(progress = contract.progressPercent / 100f)
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.escrow_title)) {
                ValueRow(stringResource(R.string.escrow_held), contract.escrow.held.format(), emphasise = true)
                ValueRow(stringResource(R.string.escrow_released), contract.escrow.released.format())
                ValueRow(stringResource(R.string.escrow_fee), contract.escrow.feesCharged.format())
                ValueRow(stringResource(R.string.escrow_refunded), contract.escrow.refunded.format())
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.detail_parties)) {
                contract.parties.forEach { party ->
                    ValueRow(
                        label = "${party.displayName} · ${party.role}",
                        value = if (party.identity.isVerified) {
                            stringResource(R.string.identity_verified)
                        } else {
                            stringResource(R.string.identity_unverified)
                        },
                        valueColor = if (party.identity.isVerified) PactoColors.Positive else PactoColors.Urgent
                    )
                }
            }
        }

        item {
            Text(
                text = stringResource(R.string.detail_milestones),
                style = MaterialTheme.typography.headlineSmall,
                color = PactoColors.OnOlive
            )
        }

        items(contract.milestones.size) { index ->
            val milestone = contract.milestones[index]
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(PactoColors.Ink)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(milestone.title, style = MaterialTheme.typography.titleMedium, color = PactoColors.OnOlive)
                Text(
                    text = "${milestone.amount.format()} · ${TimeFormats.relativeDays(milestone.dueAt)} · ${milestone.status}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PactoColors.OnOliveMuted
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (milestone.status == MilestoneStatus.PENDING) {
                        PillButton(
                            text = stringResource(R.string.detail_mark_done),
                            onClick = { viewModel.markDelivered(contract.id, milestone.id) }
                        )
                    }
                    if (milestone.status == MilestoneStatus.DELIVERED) {
                        PillButton(
                            text = stringResource(R.string.detail_release),
                            onClick = { viewModel.releaseMilestone(contract.id, milestone.id) }
                        )
                    }
                    if (milestone.requiresEvidence) {
                        PillButton(
                            text = stringResource(R.string.evidence_capture_after),
                            leadingIcon = Icons.Filled.CameraAlt,
                            background = PactoColors.InkSoft,
                            contentColor = PactoColors.OnOlive,
                            onClick = { capture(EvidenceKind.AFTER_STATE, milestone.id) }
                        )
                    }
                }
                if (milestone.geoFence != null) {
                    PillButton(
                        text = stringResource(R.string.detail_geofence),
                        leadingIcon = Icons.Filled.LocationOn,
                        background = PactoColors.InkSoft,
                        contentColor = PactoColors.OnOlive,
                        onClick = {
                            container.locationProbe.requestFix { position ->
                                if (position == null) {
                                    notice = "تعذر الحصول على الموقع"
                                } else {
                                    viewModel.checkInAt(contract.id, milestone.id, position) { _, message ->
                                        notice = message
                                    }
                                }
                            }
                        }
                    )
                }
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.detail_evidence)) {
                if (contract.evidence.isEmpty()) {
                    Text(
                        stringResource(R.string.evidence_empty),
                        style = MaterialTheme.typography.bodyMedium,
                        color = PactoColors.OnSurfaceMuted
                    )
                }
                contract.evidence.forEach { item ->
                    ValueRow(
                        label = "${item.kind} · ${TimeFormats.full(item.capturedAt)}",
                        value = item.serial ?: item.contentHash?.take(10).orEmpty()
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    PillButton(
                        text = stringResource(R.string.evidence_capture_before),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { capture(EvidenceKind.BEFORE_STATE) }
                    )
                    PillButton(
                        text = stringResource(R.string.evidence_defect_add),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { capture(EvidenceKind.DEFECT) }
                    )
                }
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.detail_expenses)) {
                contract.expenses.forEach { expense ->
                    ValueRow(
                        label = "${expense.description} · ${expense.bearer}",
                        value = expense.amount.format(),
                        valueColor = if (expense.approved) PactoColors.OnSurface else PactoColors.Urgent
                    )
                    Text(
                        expense.allocationReason,
                        style = MaterialTheme.typography.bodySmall,
                        color = PactoColors.OnSurfaceMuted
                    )
                    if (!expense.approved) {
                        PillButton(
                            text = stringResource(R.string.action_save),
                            background = PactoColors.Ink,
                            contentColor = PactoColors.OnOlive,
                            onClick = { viewModel.approveExpense(contract.id, expense.id) }
                        )
                    }
                }
                PillButton(
                    text = stringResource(R.string.action_add),
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOlive,
                    modifier = Modifier.padding(top = 8.dp),
                    onClick = { dialog = DetailDialog.Expense }
                )
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.detail_addenda)) {
                contract.addenda.forEach { addendum ->
                    ValueRow(
                        label = TimeFormats.full(addendum.createdAt),
                        value = addendum.amountDelta?.format() ?: "-"
                    )
                    Text(
                        addendum.transcript,
                        style = MaterialTheme.typography.bodyMedium,
                        color = PactoColors.OnSurface
                    )
                }
                PillButton(
                    text = stringResource(R.string.detail_add_addendum),
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOlive,
                    modifier = Modifier.padding(top = 8.dp),
                    onClick = { dialog = DetailDialog.Addendum }
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton(
                        text = stringResource(R.string.detail_open_dispute),
                        leadingIcon = Icons.Filled.Gavel,
                        onClick = { dialog = DetailDialog.Dispute }
                    )
                    PillButton(
                        text = stringResource(R.string.detail_settle),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { viewModel.settleMutually(contract.id) }
                    )
                }
                PillButton(
                    text = stringResource(R.string.detail_export),
                    leadingIcon = Icons.Filled.PictureAsPdf,
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOlive,
                    onClick = {
                        viewModel.exportCourtFile(contract.id) { file ->
                            runCatching {
                                context.startActivity(
                                    android.content.Intent.createChooser(
                                        container.courtFileExporter.shareIntent(file),
                                        context.getString(R.string.action_share)
                                    )
                                )
                            }
                        }
                    }
                )
                if (contract.dispute != null) {
                    PillButton(
                        text = stringResource(R.string.dispute_title),
                        onClick = { onOpenDispute(contract.id) }
                    )
                }
            }
        }

        notice?.let { text ->
            item {
                Text(text, style = MaterialTheme.typography.bodyMedium, color = PactoColors.Medium)
            }
        }
    }

    when (dialog) {
        DetailDialog.Expense -> AmountNoteDialog(
            title = stringResource(R.string.detail_expenses),
            currency = contract.escrow.currency,
            onDismiss = { dialog = null },
            onConfirm = { note, amount ->
                viewModel.addExpense(contract.id, note, amount, null)
                dialog = null
            }
        )

        DetailDialog.Addendum -> AmountNoteDialog(
            title = stringResource(R.string.detail_add_addendum),
            currency = contract.escrow.currency,
            allowZero = true,
            onDismiss = { dialog = null },
            onConfirm = { note, amount ->
                viewModel.addAddendum(
                    contractId = contract.id,
                    transcript = note,
                    changes = listOf(
                        ai.pacto.app.domain.model.ContractTerm(
                            ai.pacto.app.domain.model.TermKind.OTHER,
                            note
                        )
                    ),
                    amountDelta = if (amount.isZero) null else amount
                )
                dialog = null
            }
        )

        DetailDialog.Dispute -> ClaimDialog(
            onDismiss = { dialog = null },
            onConfirm = { claim ->
                viewModel.openDispute(contract.id, claim)
                dialog = null
                onOpenDispute(contract.id)
            }
        )

        null -> Unit
    }
}

private enum class DetailDialog { Expense, Addendum, Dispute }

@Composable
fun WhiteCard(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Surface)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = PactoColors.OnSurface)
        content()
    }
}

@Composable
private fun AmountNoteDialog(
    title: String,
    currency: String,
    allowZero: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (String, Money) -> Unit
) {
    var note by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            PillButton(
                text = stringResource(R.string.action_save),
                onClick = {
                    val value = amountText.toDoubleOrNull() ?: 0.0
                    if (note.isNotBlank() && (allowZero || value > 0)) {
                        onConfirm(note, Money.ofMajor(value, currency))
                    }
                }
            )
        },
        dismissButton = {
            PillButton(
                text = stringResource(R.string.action_cancel),
                background = PactoColors.Ink,
                contentColor = PactoColors.OnOlive,
                onClick = onDismiss
            )
        },
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text(stringResource(R.string.capture_transcript)) },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text(currency) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    )
}

@Composable
private fun ClaimDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var claim by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            PillButton(
                text = stringResource(R.string.dispute_open),
                onClick = { if (claim.isNotBlank()) onConfirm(claim) }
            )
        },
        dismissButton = {
            PillButton(
                text = stringResource(R.string.action_cancel),
                background = PactoColors.Ink,
                contentColor = PactoColors.OnOlive,
                onClick = onDismiss
            )
        },
        title = { Text(stringResource(R.string.dispute_open)) },
        text = {
            OutlinedTextField(
                value = claim,
                onValueChange = { claim = it },
                label = { Text(stringResource(R.string.dispute_claim_hint)) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    )
}

/** Kept next to the screen so the dispute route can reuse the same card styling. */
@Composable
fun ContractSummaryLine(contract: Contract) {
    Text(
        text = "${contract.title} · ${contract.total.format()}",
        style = MaterialTheme.typography.bodyMedium,
        color = PactoColors.OnOliveMuted
    )
}
