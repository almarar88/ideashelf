package ai.pacto.app.ui.screens

import ai.pacto.app.PactoApplication
import ai.pacto.app.R
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.ui.components.EmptyState
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.ProgressTrack
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.state.PactoViewModel
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
import androidx.compose.material.icons.filled.Balance
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlin.math.roundToInt

@Composable
fun DisputesScreen(
    viewModel: PactoViewModel,
    focusContractId: String? = null,
    onOpenContract: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val container = remember { (context.applicationContext as PactoApplication).container }

    val disputed = contracts.filter { it.dispute != null }
        .sortedByDescending { it.dispute?.openedAt ?: 0L }
        .sortedByDescending { it.id == focusContractId }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.dispute_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        if (disputed.isEmpty()) {
            item { EmptyState(stringResource(R.string.dispute_empty)) }
        } else {
            items(disputed.size) { index ->
                DisputeCard(
                    contract = disputed[index],
                    viewModel = viewModel,
                    onOpenContract = onOpenContract,
                    onExport = { contractId ->
                        viewModel.exportCourtFile(contractId) { file ->
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
            }
        }

        item {
            Text(
                text = stringResource(R.string.dispute_disclaimer),
                style = MaterialTheme.typography.bodySmall,
                color = PactoColors.OnOliveMuted
            )
        }
    }
}

@Composable
private fun DisputeCard(
    contract: Contract,
    viewModel: PactoViewModel,
    onOpenContract: (String) -> Unit,
    onExport: (String) -> Unit
) {
    val dispute = contract.dispute ?: return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Ink)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(contract.title, style = MaterialTheme.typography.titleLarge, color = PactoColors.OnOlive)
        Text(
            text = "${TimeFormats.full(dispute.openedAt)} · ${dispute.status}",
            style = MaterialTheme.typography.bodySmall,
            color = PactoColors.OnOliveMuted
        )
        Text(dispute.claim, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnOlive)

        val report = dispute.report
        if (report == null) {
            PillButton(
                text = stringResource(R.string.dispute_run_arbitrator),
                leadingIcon = Icons.Filled.Balance,
                onClick = { viewModel.runArbitrator(contract.id) }
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(PactoColors.Surface)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = stringResource(R.string.dispute_report),
                    style = MaterialTheme.typography.titleLarge,
                    color = PactoColors.OnSurface
                )
                Text(report.summary, style = MaterialTheme.typography.bodyMedium, color = PactoColors.OnSurface)
                ValueRow("للمنفّذ", report.providerAmount.format(), emphasise = true)
                ValueRow("للطرف الطالب", report.clientAmount.format(), emphasise = true)
                ValueRow(
                    stringResource(R.string.dispute_evidence_weight),
                    "${(report.confidence * 100).roundToInt()}%"
                )
                ProgressTrack(progress = report.providerShare, color = PactoColors.Positive)

                report.findings.forEach { finding ->
                    Text(
                        text = "• ${finding.explanation}",
                        style = MaterialTheme.typography.bodySmall,
                        color = PactoColors.OnSurfaceMuted
                    )
                }
                report.unresolvedPoints.forEach { point ->
                    Text(
                        text = "؟ $point",
                        style = MaterialTheme.typography.bodySmall,
                        color = PactoColors.Urgent
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton(
                    text = stringResource(R.string.dispute_accept),
                    onClick = { viewModel.acceptSettlement(contract.id) }
                )
                PillButton(
                    text = stringResource(R.string.dispute_reject),
                    background = PactoColors.InkSoft,
                    contentColor = PactoColors.OnOlive,
                    onClick = { viewModel.escalateDispute(contract.id) }
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PillButton(
                text = stringResource(R.string.dispute_export_court),
                leadingIcon = Icons.Filled.PictureAsPdf,
                background = PactoColors.InkSoft,
                contentColor = PactoColors.OnOlive,
                onClick = { onExport(contract.id) }
            )
            PillButton(
                text = stringResource(R.string.contracts_title),
                background = PactoColors.InkSoft,
                contentColor = PactoColors.OnOlive,
                onClick = { onOpenContract(contract.id) }
            )
        }
    }
}
