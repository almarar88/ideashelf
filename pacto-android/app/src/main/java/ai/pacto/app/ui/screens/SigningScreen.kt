package ai.pacto.app.ui.screens

import ai.pacto.app.R
import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.core.crypto.KeystoreSigner
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.KeySecurityLevel
import ai.pacto.app.domain.model.SignatureRecord
import ai.pacto.app.platform.biometric.BiometricGate
import ai.pacto.app.ui.components.HashChip
import ai.pacto.app.ui.components.PillButton
import ai.pacto.app.ui.components.SignaturePad
import ai.pacto.app.ui.components.ValueRow
import ai.pacto.app.ui.components.rememberSignatureState
import ai.pacto.app.ui.state.PactoViewModel
import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import java.io.File

/**
 * Signing is one gesture with three effects: a drawn mark, a hardware-backed signature over the
 * contract digest, and the money moving into escrow.
 */
@Composable
fun SigningScreen(
    contract: Contract,
    viewModel: PactoViewModel,
    onSigned: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    val signer = remember { KeystoreSigner() }
    val signatureState = rememberSignatureState()

    var padWidth by remember { mutableStateOf(0) }
    var padHeight by remember { mutableStateOf(0) }
    var status by remember { mutableStateOf<String?>(null) }
    var securityLevel by remember { mutableStateOf(KeySecurityLevel.SOFTWARE) }

    val settings by viewModel.settingsState.collectAsState()
    val digest = remember(contract) { ContractHasher.hash(contract) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = stringResource(R.string.sign_title),
            style = MaterialTheme.typography.displaySmall,
            color = PactoColors.OnOlive
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(PactoColors.Surface)
                .padding(18.dp)
        ) {
            Text(contract.title, style = MaterialTheme.typography.titleLarge, color = PactoColors.OnSurface)
            ValueRow(stringResource(R.string.draft_card_money), contract.total.format(), emphasise = true)
            ValueRow(
                stringResource(R.string.escrow_fee),
                "${contract.escrow.feeBasisPoints / 100.0}%"
            )
            ValueRow(
                stringResource(R.string.detail_parties),
                contract.parties.joinToString(" / ") { it.displayName }
            )
        }

        Text(
            text = stringResource(R.string.sign_hash_label),
            style = MaterialTheme.typography.bodyMedium,
            color = PactoColors.OnOliveMuted
        )
        HashChip(ContractHasher.fingerprint(digest))

        SignaturePad(
            state = signatureState,
            hint = stringResource(R.string.sign_pad_hint),
            onSizeChanged = { width, height ->
                padWidth = width
                padHeight = height
            }
        )

        Text(
            text = when (securityLevel) {
                KeySecurityLevel.STRONGBOX -> stringResource(R.string.sign_strongbox)
                KeySecurityLevel.TEE -> stringResource(R.string.sign_tee)
                KeySecurityLevel.SOFTWARE -> stringResource(R.string.sign_software_key)
            },
            style = MaterialTheme.typography.bodySmall,
            color = PactoColors.OnOliveMuted
        )

        status?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = PactoColors.Medium)
        }

        PillButton(
            text = stringResource(R.string.sign_clear),
            background = PactoColors.Ink,
            contentColor = PactoColors.OnOlive,
            onClick = { signatureState.clear() }
        )

        PillButton(
            text = stringResource(R.string.sign_confirm),
            leadingIcon = Icons.Filled.Fingerprint,
            enabled = !signatureState.isEmpty,
            onClick = {
                if (activity == null) {
                    status = "تعذر فتح نافذة التحقق"
                    return@PillButton
                }
                val drawn = signatureState.writePng(
                    File(context.filesDir, "signatures/${contract.id}_${settings.currentPartyId}.png"),
                    padWidth,
                    padHeight
                )
                val canonical = ContractHasher.canonicalForm(contract).toByteArray(Charsets.UTF_8)
                val biometricAvailable = BiometricGate.isAvailable(activity)
                val prepared = runCatching {
                    signer.prepare(settings.currentPartyId, requireUserAuthentication = biometricAvailable)
                }.getOrElse {
                    status = "تعذر تجهيز مفتاح التوقيع: ${it.message}"
                    return@PillButton
                }
                securityLevel = prepared.securityLevel

                fun complete(signature: java.security.Signature?) {
                    val payload = runCatching {
                        signer.finish(
                            prepared.copy(signature = signature ?: prepared.signature),
                            canonical
                        )
                    }.getOrElse {
                        status = "فشل التوقيع: ${it.message}"
                        return
                    }
                    val record = SignatureRecord(
                        partyId = settings.currentPartyId,
                        signedAt = System.currentTimeMillis(),
                        contractHash = digest,
                        signatureBase64 = payload.signatureBase64,
                        publicKeyBase64 = payload.publicKeyBase64,
                        keyAlias = payload.alias,
                        securityLevel = payload.securityLevel,
                        biometricConfirmed = biometricAvailable,
                        drawnSignaturePath = drawn?.absolutePath
                    )
                    viewModel.recordSignature(contract.id, record)
                    if (!contract.total.isZero && contract.escrow.deposited.isZero) {
                        viewModel.fundEscrow(contract.id, contract.total)
                    }
                    onSigned(contract.id)
                }

                if (biometricAvailable) {
                    BiometricGate.authenticate(
                        activity = activity,
                        title = activity.getString(R.string.sign_biometric_title),
                        subtitle = activity.getString(R.string.sign_biometric_subtitle),
                        cryptoSignature = prepared.signature
                    ) { outcome ->
                        when (outcome) {
                            is BiometricGate.Outcome.Signed -> complete(outcome.signature)
                            is BiometricGate.Outcome.Failed -> status = outcome.message
                            BiometricGate.Outcome.Unavailable -> complete(null)
                        }
                    }
                } else {
                    complete(null)
                }
            }
        )
    }
}
