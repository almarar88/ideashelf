package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class ContractStatus {
    DRAFT,
    AWAITING_SIGNATURE,
    ACTIVE,
    IN_DISPUTE,
    SETTLED,
    COMPLETED,
    CANCELLED
}

@Serializable
enum class CaptureSource { VOICE_SESSION, CHAT_TEXT, MANUAL, OVERLAY_BUBBLE, OFFLINE_HANDSHAKE }

@Serializable
data class Contract(
    val id: String,
    val title: String,
    val createdAt: Long,
    val status: ContractStatus = ContractStatus.DRAFT,
    val source: CaptureSource = CaptureSource.MANUAL,
    val parties: List<Party> = emptyList(),
    val terms: List<ContractTerm> = emptyList(),
    val total: Money = Money.ZERO,
    val milestones: List<Milestone> = emptyList(),
    val escrow: EscrowAccount = EscrowAccount(),
    val evidence: List<EvidenceItem> = emptyList(),
    val expenses: List<ExpenseItem> = emptyList(),
    val addenda: List<Addendum> = emptyList(),
    val deadlines: List<DeadlineItem> = emptyList(),
    val signatures: List<SignatureRecord> = emptyList(),
    val dispute: DisputeCase? = null,
    val priority: Priority = Priority.NORMAL,
    val dialectNotes: List<DialectNote> = emptyList(),
    val transcript: String = "",
    /** SHA-256 over the canonical form, stamped when both sides sign. */
    val sealedHash: String? = null,
    val sealedAt: Long? = null
) {
    val client: Party? get() = parties.firstOrNull { it.role == PartyRole.CLIENT }
    val provider: Party? get() = parties.firstOrNull { it.role == PartyRole.PROVIDER }

    val isFullySigned: Boolean
        get() = parties.isNotEmpty() && parties.all { party -> signatures.any { it.partyId == party.id } }

    /** Weighted completion, 0..100, driven by delivered or released milestones. */
    val progressPercent: Int
        get() {
            val totalWeight = milestones.sumOf { it.weight }
            if (totalWeight == 0) return if (status == ContractStatus.COMPLETED) 100 else 0
            val done = milestones.filter {
                it.status == MilestoneStatus.DELIVERED || it.status == MilestoneStatus.RELEASED
            }.sumOf { it.weight }
            return (done * 100) / totalWeight
        }

    val nextDeadline: DeadlineItem?
        get() = deadlines.filter { it.acknowledgedAt == null }.minByOrNull { it.dueAt }

    fun party(id: String): Party? = parties.firstOrNull { it.id == id }
}
