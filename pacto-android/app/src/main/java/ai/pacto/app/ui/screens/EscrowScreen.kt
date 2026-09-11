package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.domain.model.LedgerEntryType
import ai.pacto.app.domain.model.Money
import ai.pacto.app.ui.components.EmptyState
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.state.TimeFormats
import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun EscrowScreen(
    viewModel: PactoViewModel,
    onOpenContract: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    val settings by viewModel.settingsState.collectAsStateWithLifecycle()
    val zero = Money.zero(settings.currency)

    val held = contracts.fold(zero) { acc, c -> if (c.escrow.currency == settings.currency) acc + c.escrow.held else acc }
    val released = contracts.fold(zero) { acc, c -> if (c.escrow.currency == settings.currency) acc + c.escrow.released else acc }
    val refunded = contracts.fold(zero) { acc, c -> if (c.escrow.currency == settings.currency) acc + c.escrow.refunded else acc }
    val fees = contracts.fold(zero) { acc, c -> if (c.escrow.currency == settings.currency) acc + c.escrow.feesCharged else acc }

    val ledger = contracts.flatMap { contract ->
        contract.escrow.ledger.map { contract to it }
    }.sortedByDescending { it.second.at }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.escrow_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        item {
            WhiteCard(title = stringResource(R.string.escrow_held)) {
                ValueRow(stringResource(R.string.escrow_held), held.format(), emphasise = true)
                ValueRow(stringResource(R.string.escrow_released), released.format())
                ValueRow(stringResource(R.string.escrow_refunded), refunded.format())
                ValueRow(
                    stringResource(R.string.escrow_fee),
                    "${fees.format()} (${settings.feeBasisPoints / 100.0}%)"
                )
            }
        }

        item {
            Text(
                text = stringResource(R.string.escrow_ledger),
                style = MaterialTheme.typography.headlineSmall,
                color = PactoColors.OnOlive
            )
        }

        if (ledger.isEmpty()) {
            item { EmptyState(stringResource(R.string.contracts_empty)) }
        } else {
            items(ledger.size) { index ->
                val (contract, entry) = ledger[index]
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(PactoColors.Ink)
                        .clickable { onOpenContract(contract.id) }
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = entry.note,
                        style = MaterialTheme.typography.titleMedium,
                        color = PactoColors.OnOlive
                    )
                    Text(
                        text = "${contract.title} · ${TimeFormats.full(entry.at)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = PactoColors.OnOliveMuted
                    )
                    Text(
                        text = entry.amount.format(),
                        style = MaterialTheme.typography.titleMedium,
                        color = when (entry.type) {
                            LedgerEntryType.DEPOSIT -> PactoColors.Medium
                            LedgerEntryType.RELEASE -> PactoColors.Positive
                            LedgerEntryType.REFUND -> PactoColors.OnOlive
                            LedgerEntryType.FEE -> PactoColors.OnOliveMuted
                            LedgerEntryType.EXPENSE_REIMBURSEMENT -> PactoColors.Medium
                        }
                    )
                }
            }
        }
    }
}
