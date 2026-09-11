package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class KeySecurityLevel { SOFTWARE, TEE, STRONGBOX }

@Serializable
data class SignatureRecord(
    val partyId: String,
    val signedAt: Long,
    /** Hash of the canonical contract bytes that were signed. */
    val contractHash: String,
    val signatureBase64: String,
    val publicKeyBase64: String,
    val keyAlias: String,
    val securityLevel: KeySecurityLevel,
    val biometricConfirmed: Boolean,
    /** Path to the drawn signature bitmap, kept as a human-readable artefact. */
    val drawnSignaturePath: String? = null
)
