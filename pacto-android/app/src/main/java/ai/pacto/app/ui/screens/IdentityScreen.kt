package ai.pacto.app.ui.screens

import ai.pacto.app.PactoApplication
import ai.pacto.app.R
import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.domain.model.IdentityProof
import ai.pacto.app.domain.model.VerificationMethod
import ai.pacto.app.platform.nfc.NfcIdentityReader
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.ProgressTrack
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.theme.PactoColors
import android.app.Activity
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
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
fun IdentityScreen(
    viewModel: PactoViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val container = remember { (context.applicationContext as PactoApplication).container }
    val settings by viewModel.settingsState.collectAsStateWithLifecycle()
    val contracts by viewModel.contracts.collectAsStateWithLifecycle()
    val trust = remember(contracts) { viewModel.trustScoreOf(settings.currentPartyId) }

    var scanning by remember { mutableStateOf(false) }
    var lastProof by remember { mutableStateOf<IdentityProof?>(null) }
    var handshakeStatus by remember { mutableStateOf<String?>(null) }
    var targetContractId by remember { mutableStateOf(contracts.firstOrNull()?.id) }
    var targetPartyId by remember { mutableStateOf<String?>(null) }

    val reader = remember(activity) { activity?.let { NfcIdentityReader(it) } }

    DisposableEffect(scanning) {
        if (scanning && reader != null) {
            reader.enable { proof ->
                lastProof = proof
                val contractId = targetContractId
                val partyId = targetPartyId
                if (contractId != null && partyId != null) {
                    viewModel.setIdentity(contractId, partyId, proof)
                }
                scanning = false
            }
        }
        onDispose { reader?.disable() }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 130.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(
                text = stringResource(R.string.identity_title),
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
        }

        item {
            WhiteCard(title = stringResource(R.string.home_trust_label)) {
                Text(
                    text = "${trust.value}",
                    style = MaterialTheme.typography.displaySmall,
                    color = PactoColors.OnSurface
                )
                ProgressTrack(progress = trust.value / 100f, color = PactoColors.Positive)
                ValueRow(stringResource(R.string.trust_on_time), "${trust.onTimeDelivery}")
                ValueRow(stringResource(R.string.trust_payment), "${trust.paymentSpeed}")
                ValueRow(stringResource(R.string.trust_disputes), "${trust.disputeRecord}")
                ValueRow(stringResource(R.string.trust_volume), "${trust.volume}")
                ValueRow(stringResource(R.string.contracts_filter_closed), "${trust.contractsCompleted}")
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.identity_nfc)) {
                Text(
                    text = stringResource(R.string.identity_nfc_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnSurfaceMuted
                )
                if (reader?.isAvailable() != true) {
                    Text(
                        text = "هذا الجهاز لا يدعم NFC",
                        style = MaterialTheme.typography.bodySmall,
                        color = PactoColors.Urgent
                    )
                }
                lastProof?.let { proof ->
                    ValueRow(stringResource(R.string.identity_verified), proof.documentNumberMasked.orEmpty())
                    proof.documentHash?.let {
                        ValueRow("بصمة الوثيقة", ContractHasher.fingerprint(it))
                    }
                }
                PillButton(
                    text = if (scanning) stringResource(R.string.action_cancel) else stringResource(R.string.identity_nfc),
                    leadingIcon = Icons.Filled.Contactless,
                    background = PactoColors.Ink,
                    contentColor = PactoColors.OnOlive,
                    modifier = Modifier.padding(top = 10.dp),
                    onClick = { scanning = !scanning }
                )
            }
        }

        item {
            Text(
                text = stringResource(R.string.detail_verify_identity),
                style = MaterialTheme.typography.headlineSmall,
                color = PactoColors.OnOlive
            )
        }

        items(contracts.size) { index ->
            val contract = contracts[index]
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(PactoColors.Ink)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(contract.title, style = MaterialTheme.typography.titleMedium, color = PactoColors.OnOlive)
                contract.parties.forEach { party ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = party.displayName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = PactoColors.OnOliveMuted
                        )
                        PillButton(
                            text = if (party.identity.isVerified) {
                                stringResource(R.string.identity_verified)
                            } else {
                                stringResource(R.string.identity_manual)
                            },
                            background = if (party.identity.isVerified) PactoColors.InkSoft else PactoColors.Surface,
                            contentColor = if (party.identity.isVerified) PactoColors.Positive else PactoColors.OnSurface,
                            onClick = {
                                targetContractId = contract.id
                                targetPartyId = party.id
                                if (reader?.isAvailable() == true) {
                                    scanning = true
                                } else {
                                    viewModel.setIdentity(
                                        contract.id,
                                        party.id,
                                        IdentityProof(
                                            method = VerificationMethod.MANUAL_ATTESTED,
                                            verifiedAt = System.currentTimeMillis()
                                        )
                                    )
                                }
                            }
                        )
                    }
                }
            }
        }

        item {
            WhiteCard(title = stringResource(R.string.identity_offline_handshake)) {
                val handshake = container.offlineHandshake
                Text(
                    text = if (handshake.isEnabled()) {
                        "البلوتوث جاهز. استضف الجلسة على أحد الهاتفين وانضم من الآخر."
                    } else {
                        "فعّل البلوتوث لبدء التعاقد دون إنترنت."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = PactoColors.OnSurfaceMuted
                )
                handshakeStatus?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = PactoColors.OnSurface)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
                    PillButton(
                        text = "استضافة",
                        leadingIcon = Icons.Filled.Bluetooth,
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = {
                            val contract = contracts.firstOrNull { it.id == targetContractId }
                            val payload = contract?.let { ContractHasher.canonicalForm(it) }.orEmpty()
                            handshakeStatus = "بانتظار اتصال الطرف الآخر…"
                            handshake.host(payload) { result ->
                                handshakeStatus = result.fold(
                                    onSuccess = { "تم استلام نسخة الطرف الآخر (${it.length} حرف) ومطابقتها" },
                                    onFailure = { "تعذر إتمام التعاقد: ${it.message}" }
                                )
                            }
                        }
                    )
                    PillButton(
                        text = "انضمام",
                        background = PactoColors.Ink,
                        contentColor = PactoColors.OnOlive,
                        onClick = {
                            val device = handshake.pairedDevices().firstOrNull()
                            if (device == null) {
                                handshakeStatus = "لا توجد أجهزة مقترنة"
                            } else {
                                val contract = contracts.firstOrNull { it.id == targetContractId }
                                val payload = contract?.let { ContractHasher.canonicalForm(it) }.orEmpty()
                                handshakeStatus = "جارٍ الاتصال بـ ${handshake.deviceName(device)}…"
                                handshake.join(device, payload) { result ->
                                    handshakeStatus = result.fold(
                                        onSuccess = { "تم تبادل العقد وتوقيعه دون إنترنت" },
                                        onFailure = { "تعذر الاتصال: ${it.message}" }
                                    )
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}
