package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.ui.components.EmptyState
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.PriorityBadge
import ai.pacto.app.ui.components.ProgressTrack
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.state.TimeFormats
import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

private enum class ContractFilter { ALL, ACTIVE, PENDING, CLOSED }

@Composable
fun ContractsScreen(
    viewModel: PactoViewModel,
    onOpenContract: (String) -> Unit,
    onNewContract: () -> Unit,
    modifier: Modifier = Modifier
) {
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    var filter by remember { mutableStateOf(ContractFilter.ALL) }

    val filtered = remember(contracts, filter) {
        contracts.filter { contract ->
            when (filter) {
                ContractFilter.ALL -> true
                ContractFilter.ACTIVE -> contract.status == ContractStatus.ACTIVE
                ContractFilter.PENDING -> contract.status == ContractStatus.AWAITING_SIGNATURE ||
                    contract.status == ContractStatus.DRAFT

                ContractFilter.CLOSED -> contract.status == ContractStatus.COMPLETED ||
                    contract.status == ContractStatus.CANCELLED ||
                    contract.status == ContractStatus.SETTLED
            }
        }.sortedByDescending { it.createdAt }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.contracts_title),
                    style = MaterialTheme.typography.displaySmall,
                    color = PactoColors.OnOlive
                )
                PillButton(text = stringResource(R.string.home_new_contract), onClick = onNewContract)
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(ContractFilter.entries.toList()) { option ->
                    val label = when (option) {
                        ContractFilter.ALL -> stringResource(R.string.contracts_filter_all)
                        ContractFilter.ACTIVE -> stringResource(R.string.contracts_filter_active)
                        ContractFilter.PENDING -> stringResource(R.string.contracts_filter_pending)
                        ContractFilter.CLOSED -> stringResource(R.string.contracts_filter_closed)
                    }
                    PillButton(
                        text = label,
                        onClick = { filter = option },
                        background = if (filter == option) PactoColors.Surface else PactoColors.Ink,
                        contentColor = if (filter == option) PactoColors.OnSurface else PactoColors.OnOlive
                    )
                }
            }
        }

        if (filtered.isEmpty()) {
            item { EmptyState(stringResource(R.string.contracts_empty)) }
        } else {
            items(filtered, key = { it.id }) { contract ->
                ContractRow(contract = contract, onClick = { onOpenContract(contract.id) })
            }
        }
    }
}

@Composable
fun ContractRow(contract: Contract, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Ink)
            .clickable(onClick = onClick)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                Text(contract.title, style = MaterialTheme.typography.titleLarge, color = PactoColors.OnOlive)
                Text(
                    text = contract.parties.joinToString(" / ") { it.displayName },
                    style = MaterialTheme.typography.bodySmall,
                    color = PactoColors.OnOliveMuted
                )
            }
            PriorityBadge(priority = contract.priority, label = priorityLabel(contract.priority))
        }

        ProgressTrack(
            progress = contract.progressPercent / 100f,
            color = when (contract.status) {
                ContractStatus.IN_DISPUTE -> PactoColors.Danger
                ContractStatus.COMPLETED, ContractStatus.SETTLED -> PactoColors.Positive
                else -> PactoColors.Urgent
            }
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = stringResource(R.string.detail_progress, contract.progressPercent),
                style = MaterialTheme.typography.bodySmall,
                color = PactoColors.OnOliveMuted
            )
            Text(
                text = contract.total.format(),
                style = MaterialTheme.typography.titleMedium,
                color = PactoColors.OnOlive
            )
        }

        contract.nextDeadline?.let { deadline ->
            Text(
                text = "${deadline.label} · ${TimeFormats.relativeDays(deadline.dueAt)}",
                style = MaterialTheme.typography.bodySmall,
                color = PactoColors.Medium
            )
        }
    }
}
