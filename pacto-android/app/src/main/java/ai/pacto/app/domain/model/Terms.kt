package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class TermKind {
    SCOPE,
    PRICE,
    PAYMENT_SCHEDULE,
    DEADLINE,
    WARRANTY,
    PENALTY,
    CANCELLATION,
    MATERIALS,
    LOCATION,
    INSPECTION,
    OTHER
}

@Serializable
data class ContractTerm(
    val kind: TermKind,
    /** Legally phrased clause produced from the spoken or written source. */
    val text: String,
    /** The raw fragment the clause was derived from, kept for audit. */
    val sourceFragment: String? = null,
    val confidence: Float = 1f
)

@Serializable
enum class Priority { URGENT, MEDIUM, NORMAL }

@Serializable
data class GeoPoint(
    val latitude: Double,
    val longitude: Double,
    val label: String? = null,
    /** Radius in metres that counts as "arrived". */
    val radiusMeters: Double = 150.0
)

@Serializable
data class DialectNote(
    val term: String,
    val meaning: String,
    val normalizedClause: String
)
