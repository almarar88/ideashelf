package ai.pacto.app.domain

import ai.pacto.app.domain.engine.TrustScoreCalculator
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.DisputeCase
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Party
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.TrustScore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustScoreTest {

    private val day = 24 * 60 * 60 * 1000L

    private fun providerContract(
        deliveredAt: Long,
        dueAt: Long,
        dispute: DisputeCase? = null
    ) = Contract(
        id = "c${deliveredAt}_$dueAt",
        title = "عمل",
        createdAt = 0L,
        status = ContractStatus.COMPLETED,
        parties = listOf(Party("pro", "المنفذ", PartyRole.PROVIDER)),
        total = Money.ofMajor(500.0),
        milestones = listOf(
            Milestone("m", "تسليم", Money.ofMajor(500.0), dueAt, MilestoneStatus.RELEASED, deliveredAt = deliveredAt, releasedAt = deliveredAt + day)
        ),
        dispute = dispute
    )

    @Test
    fun `an unknown party starts neutral`() {
        assertEquals(TrustScore.EMPTY, TrustScoreCalculator.calculate("nobody", emptyList()))
    }

    @Test
    fun `always on time beats always late`() {
        val punctual = TrustScoreCalculator.calculate("pro", listOf(providerContract(day, 2 * day)))
        val late = TrustScoreCalculator.calculate("pro", listOf(providerContract(5 * day, day)))
        assertTrue(punctual.value > late.value)
        assertEquals(100, punctual.onTimeDelivery)
        assertEquals(0, late.onTimeDelivery)
    }

    @Test
    fun `disputes cut the score and are counted`() {
        val clean = TrustScoreCalculator.calculate("pro", listOf(providerContract(day, 2 * day)))
        val disputed = TrustScoreCalculator.calculate(
            "pro",
            listOf(providerContract(day, 2 * day, DisputeCase("d1", "pro", 0L, "خلاف")))
        )
        assertTrue(disputed.value < clean.value)
        assertEquals(1, disputed.disputesOpened)
    }

    @Test
    fun `the score stays inside zero to one hundred`() {
        val contracts = (1..20).map { providerContract(day, 2 * day) }
        val score = TrustScoreCalculator.calculate("pro", contracts)
        assertTrue(score.value in 0..100)
    }
}
