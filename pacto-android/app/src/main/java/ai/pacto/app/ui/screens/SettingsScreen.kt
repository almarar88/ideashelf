package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.data.Plan
import ai.pacto.app.platform.overlay.ChatOverlayService
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.theme.PactoColors
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsScreen(viewModel: PactoViewModel, modifier: Modifier = Modifier) {
    val settings by viewModel.settingsState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.settings_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        item {
            WhiteCard(title = stringResource(R.string.settings_plan)) {
                ValueRow(
                    label = stringResource(R.string.settings_plan),
                    value = if (settings.plan == Plan.PRO) {
                        stringResource(R.string.settings_plan_pro)
                    } else {
                        stringResource(R.string.settings_plan_free)
                    },
                    emphasise = true
                )
                ValueRow(
                    label = stringResource(R.string.settings_quota, settings.contractsLeft.coerceAtMost(999)),
                    value = ""
                )
                PillButton(
                    text = if (settings.plan == Plan.PRO) {
                        stringResource(R.string.settings_plan_free)
                    } else {
                        stringResource(R.string.settings_upgrade)
                    },
                    onClick = {
                        viewModel.setPlan(if (settings.plan == Plan.PRO) Plan.FREE else Plan.PRO)
                    }
                )
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.escrow_fee)) {
                Text(
                    text = stringResource(R.string.settings_fee_policy, "${settings.feeBasisPoints / 100.0}%"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnSurfaceMuted
                )
                Slider(
                    value = settings.feeBasisPoints.toFloat(),
                    onValueChange = { viewModel.setFee(it.toInt()) },
                    valueRange = 100f..150f,
                    steps = 9,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.settings_overlay)) {
                Text(
                    text = stringResource(R.string.settings_overlay_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnSurfaceMuted
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.settings_overlay),
                        style = MaterialTheme.typography.bodyMedium,
                        color = PactoColors.OnSurface
                    )
                    Switch(
                        checked = settings.overlayEnabled,
                        onCheckedChange = { enabled ->
                            if (enabled && !ChatOverlayService.canDrawOverlays(context)) {
                                context.startActivity(
                                    Intent(
                                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                        Uri.parse("package:${context.packageName}")
                                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                )
                            } else {
                                viewModel.setOverlayEnabled(enabled)
                                if (enabled) ChatOverlayService.start(context) else ChatOverlayService.stop(context)
                            }
                        }
                    )
                }
                if (!ChatOverlayService.canDrawOverlays(context)) {
                    PillButton(
                        text = stringResource(R.string.settings_overlay_permission),
                        onClick = {
                            context.startActivity(
                                Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:${context.packageName}")
                                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        }
                    )
                }
            }
        }

        item {
            Column {
                Text(
                    text = stringResource(R.string.dispute_disclaimer),
                    style = MaterialTheme.typography.bodySmall,
                    color = PactoColors.OnOliveMuted
                )
            }
        }
    }
}
