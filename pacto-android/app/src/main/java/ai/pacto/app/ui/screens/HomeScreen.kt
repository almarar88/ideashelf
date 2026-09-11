package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.domain.model.Priority
import ai.pacto.app.ui.components.DayCell
import ai.pacto.app.ui.components.DayPill
import ai.pacto.app.ui.components.DarkTile
import ai.pacto.app.ui.components.EmptyState
import ai.pacto.app.ui.components.ObligationCard
import ai.pacto.app.ui.components.PactoTopBar
import ai.pacto.app.ui.components.SectionHeader
import ai.pacto.app.ui.state.HomeState
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.state.TimeFormats
import ai.pacto.app.ui.theme.PactoColors
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BubbleChart
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun HomeScreen(
    viewModel: PactoViewModel,
    onNewContract: () -> Unit,
    onOpenContract: (String) -> Unit,
    onOpenEscrow: () -> Unit,
    onOpenEvidence: () -> Unit,
    onOpenIdentity: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.homeState.collectAsStateWithLifecycle()
    val selectedDate by viewModel.selectedDate.collectAsStateWithLifecycle()

    val days = remember(selectedDate, state.obligations) {
        val today = PactoViewModel.startOfToday()
        (-2..4).map { offset ->
            val millis = today + offset * PactoViewModel.DAY_MS
            DayCell(
                dayNumber = TimeFormats.dayNumber(millis),
                weekdayLabel = TimeFormats.weekday(millis),
                badgeCount = viewModel.obligationCount(millis),
                isSelected = millis == selectedDate,
                dateMillis = millis
            )
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            PactoTopBar(
                trustScore = state.trustScore.value,
                statusLine = stringResource(R.string.home_active_contracts, state.activeContracts),
                onProfileClick = onOpenIdentity
            )
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(days, key = { it.dateMillis }) { cell ->
                    DayPill(cell = cell, onClick = { viewModel.selectDate(cell.dateMillis) })
                }
            }
        }

        item {
            SectionHeader(
                title = stringResource(R.string.home_today_tasks),
                actionText = stringResource(R.string.home_new_contract),
                onAction = onNewContract
            )
        }

        item {
            if (state.obligations.isEmpty()) {
                EmptyState(stringResource(R.string.home_no_tasks))
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(state.obligations) { obligation ->
                        ObligationCard(
                            timeLabel = obligation.timeLabel,
                            title = obligation.title,
                            priority = obligation.priority,
                            priorityLabel = priorityLabel(obligation.priority),
                            priorityCaption = stringResource(R.string.priority_label),
                            footnote = obligation.amount?.format() ?: obligation.caption,
                            onClick = { onOpenContract(obligation.contractId) }
                        )
                    }
                }
            }
        }

        item { WalletSection(state = state, onOpenEscrow = onOpenEscrow) }

        item {
            Text(
                text = stringResource(R.string.home_tools),
                style = MaterialTheme.typography.headlineMedium,
                color = PactoColors.OnOlive
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    DarkTile(
                        title = stringResource(R.string.capture_mode_voice),
                        subtitle = stringResource(R.string.capture_recording),
                        icon = Icons.Filled.Mic,
                        modifier = Modifier.weight(1f),
                        onClick = onNewContract,
                        accent = PactoColors.Urgent
                    )
                    DarkTile(
                        title = stringResource(R.string.evidence_title),
                        subtitle = stringResource(R.string.evidence_capture_before),
                        icon = Icons.Filled.CameraAlt,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenEvidence
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    DarkTile(
                        title = stringResource(R.string.identity_nfc),
                        subtitle = stringResource(R.string.identity_nfc_hint),
                        icon = Icons.Filled.Contactless,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenIdentity
                    )
                    DarkTile(
                        title = stringResource(R.string.identity_offline_handshake),
                        subtitle = stringResource(R.string.settings_overlay_hint),
                        icon = Icons.Filled.Bluetooth,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenIdentity
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    DarkTile(
                        title = stringResource(R.string.settings_overlay),
                        subtitle = stringResource(R.string.settings_overlay_hint),
                        icon = Icons.Filled.BubbleChart,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenSettings
                    )
                    DarkTile(
                        title = stringResource(R.string.dispute_export_court),
                        subtitle = stringResource(R.string.dispute_title),
                        icon = Icons.Filled.Description,
                        modifier = Modifier.weight(1f),
                        onClick = onOpenSettings
                    )
                }
            }
        }
    }
}

@Composable
private fun WalletSection(state: HomeState, onOpenEscrow: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title = stringResource(R.string.home_wallet))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DarkTile(
                title = state.heldTotal.format(),
                subtitle = stringResource(R.string.escrow_held),
                icon = Icons.Filled.Lock,
                modifier = Modifier.weight(1f),
                onClick = onOpenEscrow,
                accent = PactoColors.Medium
            )
            DarkTile(
                title = stringResource(R.string.settings_quota, state.settings.contractsLeft.coerceAtMost(999)),
                subtitle = stringResource(R.string.settings_fee_policy, "${state.settings.feeBasisPoints / 100.0}%"),
                icon = Icons.Filled.Payments,
                modifier = Modifier.weight(1f),
                onClick = onOpenEscrow
            )
        }
    }
}

@Composable
fun priorityLabel(priority: Priority): String = when (priority) {
    Priority.URGENT -> stringResource(R.string.priority_urgent)
    Priority.MEDIUM -> stringResource(R.string.priority_medium)
    Priority.NORMAL -> stringResource(R.string.priority_normal)
}
