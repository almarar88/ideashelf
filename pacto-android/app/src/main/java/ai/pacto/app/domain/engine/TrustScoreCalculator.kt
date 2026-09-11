package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.TrustScore
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Reputation built from behaviour the app already witnesses: deliveries against their own
 * deadlines, how fast a payer releases after delivery, and how often deals end in dispute.
 */
object TrustScoreCalculator {

    private const val DAY_MS = 24 * 60 * 60 * 1000L

    fun calculate(partyId: String, contracts: List<Contract>): TrustScore {
        val involved = contracts.filter { c -> c.parties.any { it.id == partyId } }
        if (involved.isEmpty()) return TrustScore.EMPTY

        val asProvider = involved.filter { it.party(partyId)?.role == PartyRole.PROVIDER }
        val asClient = involved.filter { it.party(partyId)?.role == PartyRole.CLIENT }

        val onTime = onTimeScore(asProvider)
        val payment = paymentScore(asClient)
        val disputesOpened = involved.count { it.dispute != null }
        val disputeRecord = (100 - min(60, disputesOpened * 20)).coerceAtLeast(20)
        val completed = involved.count {
            it.status == ContractStatus.COMPLETED || it.status == ContractStatus.SETTLED
        }
        val volume = min(100, completed * 12)

        val value = (0.35 * onTime + 0.25 * payment + 0.30 * disputeRecord + 0.10 * volume).roundToInt()

        return TrustScore(
            value = value.coerceIn(0, 100),
            onTimeDelivery = onTime,
            paymentSpeed = payment,
            disputeRecord = disputeRecord,
            volume = volume,
            contractsCompleted = completed,
            disputesOpened = disputesOpened
        )
    }

    private fun onTimeScore(contracts: List<Contract>): Int {
        val delivered = contracts.flatMap { it.milestones }.filter { it.deliveredAt != null }
        if (delivered.isEmpty()) return 50
        val punctual = delivered.count { it.deliveredAt!! <= it.dueAt }
        return ((punctual.toDouble() / delivered.size) * 100).roundToInt()
    }

    private fun paymentScore(contracts: List<Contract>): Int {
        val pairs = contracts.flatMap { it.milestones }
            .filter { it.status == MilestoneStatus.RELEASED && it.deliveredAt != null && it.releasedAt != null }
        if (pairs.isEmpty()) return 50
        val scores = pairs.map { m ->
            val gapDays = (m.releasedAt!! - m.deliveredAt!!).toDouble() / DAY_MS
            when {
                gapDays <= 1 -> 100
                gapDays <= 3 -> 85
                gapDays <= 7 -> 65
                gapDays <= 14 -> 45
                else -> 25
            }
        }
        return scores.average().roundToInt()
    }
}
