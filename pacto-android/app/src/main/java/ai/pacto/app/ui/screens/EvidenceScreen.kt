package ai.pacto.app.ui.screens

import ai.pacto.app.PactoApplication
import ai.pacto.app.R
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.platform.vision.AssetCapture
import ai.pacto.app.ui.components.EmptyState
import ai.pacto.app.ui.components.PillButton
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

/**
 * Everything visual across the whole book: what a thing looked like before, what it looked like
 * after, its serial number, and the documents held as collateral.
 */
@Composable
fun EvidenceScreen(
    viewModel: PactoViewModel,
    onOpenContract: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    val settings by viewModel.settingsState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val container = remember { (context.applicationContext as PactoApplication).container }
    val assetCapture = remember { AssetCapture(context) }

    var selectedContractId by remember { mutableStateOf(contracts.firstOrNull()?.id) }
    var serialText by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<AssetCapture.PendingCapture?>(null) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val capture = pending
        val contractId = selectedContractId
        if (success && capture != null && contractId != null) {
            val reading = container.serialReader.read(capture.file.absolutePath, serialText)
            val item = assetCapture.seal(
                pending = capture,
                note = if (capture.kind == EvidenceKind.SERIAL_NUMBER) "رقم تسلسلي موثق" else "توثيق مصور",
                capturedByPartyId = settings.currentPartyId,
                serial = reading?.serial
            )
            if (item != null) viewModel.addEvidence(contractId, item)
            serialText = ""
        }
        pending = null
    }

    fun capture(kind: EvidenceKind) {
        val request = assetCapture.newCapture(kind)
        pending = request
        launcher.launch(request.uri)
    }

    val allEvidence = contracts.flatMap { contract -> contract.evidence.map { contract to it } }
        .sortedByDescending { it.second.capturedAt }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.evidence_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        item {
            WhiteCard(title = stringResource(R.string.evidence_serial)) {
                Text(
                    text = contracts.firstOrNull { it.id == selectedContractId }?.title.orEmpty(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnSurfaceMuted
                )
                OutlinedTextField(
                    value = serialText,
                    onValueChange = { serialText = it },
                    label = { Text(stringResource(R.string.evidence_serial)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
                    PillButton(
                        text = stringResource(R.string.evidence_capture_before),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { capture(EvidenceKind.BEFORE_STATE) }
                    )
                    PillButton(
                        text = stringResource(R.string.evidence_serial),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { capture(EvidenceKind.SERIAL_NUMBER) }
                    )
                    PillButton(
                        text = stringResource(R.string.evidence_collateral),
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = { capture(EvidenceKind.COLLATERAL_DOCUMENT) }
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                contracts.take(4).forEach { contract ->
                    PillButton(
                        text = contract.title,
                        background = if (contract.id == selectedContractId) PactoColors.Surface else PactoColors.Ink,
                        contentColor = if (contract.id == selectedContractId) PactoColors.OnSurface else PactoColors.OnOlive,
                        onClick = { selectedContractId = contract.id }
                    )
                }
            }
        }

        if (allEvidence.isEmpty()) {
            item { EmptyState(stringResource(R.string.evidence_empty)) }
        } else {
            items(allEvidence.size) { index ->
                val (contract, item) = allEvidence[index]
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(PactoColors.Ink)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "${item.kind} · ${contract.title}",
                        style = MaterialTheme.typography.titleMedium,
                        color = PactoColors.OnOlive
                    )
                    Text(item.note, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnOliveMuted)
                    ValueRow(
                        label = stringResource(R.string.evidence_stamp, TimeFormats.full(item.capturedAt)),
                        value = item.serial ?: "",
                        valueColor = PactoColors.OnOlive
                    )
                    item.contentHash?.let {
                        Text(
                            text = "${stringResource(R.string.evidence_hash)}: ${it.take(24)}…",
                            style = MaterialTheme.typography.bodySmall,
                            color = PactoColors.OnOliveMuted
                        )
                    }
                    PillButton(
                        text = stringResource(R.string.detail_evidence),
                        background = PactoColors.InkSoft,
                        contentColor = PactoColors.OnOlive,
                        onClick = { onOpenContract(contract.id) }
                    )
                }
            }
        }
    }
}
