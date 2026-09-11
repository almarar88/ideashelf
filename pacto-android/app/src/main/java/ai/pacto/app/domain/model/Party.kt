package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class PartyRole {
    /** The side paying for the work or the goods. */
    CLIENT,

    /** The side delivering the work or the goods. */
    PROVIDER
}

@Serializable
enum class VerificationMethod { NONE, MANUAL_ATTESTED, NFC_ID, NFC_ID_WITH_BIOMETRIC, OFFLINE_HANDSHAKE }

@Serializable
data class IdentityProof(
    val method: VerificationMethod = VerificationMethod.NONE,
    val documentNumberMasked: String? = null,
    val issuingCountry: String? = null,
    val verifiedAt: Long? = null,
    /** Hash of the raw document data; the raw data itself never leaves the device. */
    val documentHash: String? = null,
    val biometricMatched: Boolean = false
) {
    val isVerified: Boolean
        get() = method != VerificationMethod.NONE && verifiedAt != null
}

@Serializable
data class Party(
    val id: String,
    val displayName: String,
    val role: PartyRole,
    val phone: String? = null,
    val identity: IdentityProof = IdentityProof(),
    val trustScore: Int = 0
)
