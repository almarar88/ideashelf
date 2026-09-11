package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class TrustScore(
    val value: Int,
    val onTimeDelivery: Int,
    val paymentSpeed: Int,
    val disputeRecord: Int,
    val volume: Int,
    val contractsCompleted: Int,
    val disputesOpened: Int
) {
    val band: TrustBand
        get() = when {
            value >= 80 -> TrustBand.HIGH
            value >= 55 -> TrustBand.MEDIUM
            else -> TrustBand.LOW
        }

    companion object {
        val EMPTY = TrustScore(50, 50, 50, 50, 0, 0, 0)
    }
}

enum class TrustBand { HIGH, MEDIUM, LOW }
