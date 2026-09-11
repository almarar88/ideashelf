package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class EvidenceKind {
    BEFORE_STATE,
    AFTER_STATE,
    DEFECT,
    SERIAL_NUMBER,
    COLLATERAL_DOCUMENT,
    DELIVERY_PROOF,
    EXPENSE_RECEIPT
}

@Serializable
data class EvidenceItem(
    val id: String,
    val kind: EvidenceKind,
    val capturedAt: Long,
    val note: String = "",
    /** Absolute path inside app-private storage; never world readable. */
    val filePath: String? = null,
    /** SHA-256 of the file bytes at capture time. */
    val contentHash: String? = null,
    val serial: String? = null,
    val geo: GeoPoint? = null,
    val capturedByPartyId: String? = null,
    val milestoneId: String? = null,
    /** Set once the item is written into a sealed, signed contract record. */
    val sealed: Boolean = false
)

@Serializable
data class ExpenseItem(
    val id: String,
    val description: String,
    val amount: Money,
    val incurredAt: Long,
    /** Which side the contract makes responsible for this cost. */
    val bearer: PartyRole,
    val receiptEvidenceId: String? = null,
    val approved: Boolean = false,
    /** Rule that assigned the bearer, shown to both sides so the split is explainable. */
    val allocationReason: String = ""
)

@Serializable
data class Addendum(
    val id: String,
    val createdAt: Long,
    val transcript: String,
    val changes: List<ContractTerm>,
    val amountDelta: Money? = null,
    val deadlineDeltaDays: Int = 0,
    val acceptedByPartyIds: List<String> = emptyList(),
    val recordingPath: String? = null
) {
    fun isBinding(partyIds: List<String>): Boolean = partyIds.all { it in acceptedByPartyIds }
}
