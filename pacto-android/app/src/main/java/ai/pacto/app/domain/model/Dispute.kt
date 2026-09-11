package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class DisputeStatus { OPEN, REPORT_READY, SETTLED, ESCALATED, WITHDRAWN }

@Serializable
data class ArbitrationFinding(
    val clause: String,
    val evidenceIds: List<String>,
    /** Positive favours the provider, negative favours the client, range -1f..1f. */
    val leaning: Float,
    val explanation: String
)

@Serializable
data class ArbitrationReport(
    val generatedAt: Long,
    val findings: List<ArbitrationFinding>,
    /** Share of the held escrow proposed for the provider, 0f..1f. */
    val providerShare: Float,
    val providerAmount: Money,
    val clientAmount: Money,
    val confidence: Float,
    val summary: String,
    val unresolvedPoints: List<String> = emptyList()
)

@Serializable
data class DisputeCase(
    val id: String,
    val openedByPartyId: String,
    val openedAt: Long,
    val claim: String,
    val status: DisputeStatus = DisputeStatus.OPEN,
    val report: ArbitrationReport? = null,
    val acceptedByPartyIds: List<String> = emptyList(),
    val courtFilePath: String? = null
)
