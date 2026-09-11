package ai.pacto.app.domain

import ai.pacto.app.domain.engine.EscrowEngine
import ai.pacto.app.domain.engine.EscrowResult
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.EscrowAccount
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EscrowEngineTest {

    private var counter = 0
    private fun nextId() = "id${counter++}"

    private fun baseContract() = Contract(
        id = "c1",
        title = "صيانة",
        createdAt = 0L,
        total = Money.ofMajor(1200.0),
        milestones = listOf(
            Milestone("m1", "عربون", Money.ofMajor(300.0), 0L),
            Milestone("m2", "تسليم", Money.ofMajor(900.0), 1_000L)
        ),
        escrow = EscrowAccount(feeBasisPoints = 125)
    )

    private fun success(result: EscrowResult): Contract {
        assertTrue("expected success but was $result", result is EscrowResult.Success)
        return (result as EscrowResult.Success).contract
    }

    @Test
    fun `funding freezes the whole amount`() {
        val funded = success(EscrowEngine.fund(baseContract(), Money.ofMajor(1200.0), 1L, ::nextId))
        assertEquals(Money.ofMajor(1200.0), funded.escrow.held)
    }

    @Test
    fun `release splits into net payout and disclosed fee`() {
        var contract = success(EscrowEngine.fund(baseContract(), Money.ofMajor(1200.0), 1L, ::nextId))
        contract = success(EscrowEngine.markDelivered(contract, "m1", 2L))
        contract = success(EscrowEngine.release(contract, "m1", 3L, ::nextId))

        assertEquals(Money.ofMajor(296.25), contract.escrow.released)
        assertEquals(Money.ofMajor(3.75), contract.escrow.feesCharged)
        assertEquals(Money.ofMajor(900.0), contract.escrow.held)
    }

    @Test
    fun `money cannot be released before delivery is confirmed`() {
        val contract = success(EscrowEngine.fund(baseContract(), Money.ofMajor(1200.0), 1L, ::nextId))
        val result = EscrowEngine.release(contract, "m1", 2L, ::nextId)
        assertTrue(result is EscrowResult.Rejected)
    }

    @Test
    fun `a milestone cannot be released twice`() {
        var contract = success(EscrowEngine.fund(baseContract(), Money.ofMajor(1200.0), 1L, ::nextId))
        contract = success(EscrowEngine.markDelivered(contract, "m1", 2L))
        contract = success(EscrowEngine.release(contract, "m1", 3L, ::nextId))
        assertTrue(EscrowEngine.release(contract, "m1", 4L, ::nextId) is EscrowResult.Rejected)
    }

    @Test
    fun `delivery requiring evidence is refused without any`() {
        val contract = baseContract().let {
            it.copy(milestones = it.milestones.map { m -> m.copy(requiresEvidence = true) })
        }
        assertTrue(EscrowEngine.markDelivered(contract, "m1", 2L) is EscrowResult.Rejected)
    }

    @Test
    fun `refund beyond the held balance is refused`() {
        val contract = success(EscrowEngine.fund(baseContract(), Money.ofMajor(500.0), 1L, ::nextId))
        assertTrue(EscrowEngine.refund(contract, Money.ofMajor(600.0), 2L, "x", ::nextId) is EscrowResult.Rejected)
    }

    @Test
    fun `contract completes when the last milestone is released`() {
        var contract = success(EscrowEngine.fund(baseContract(), Money.ofMajor(1200.0), 1L, ::nextId))
        listOf("m1", "m2").forEach { id ->
            contract = success(EscrowEngine.markDelivered(contract, id, 2L))
            contract = success(EscrowEngine.release(contract, id, 3L, ::nextId))
        }
        assertEquals(ContractStatus.COMPLETED, contract.status)
        assertEquals(MilestoneStatus.RELEASED, contract.milestones.last().status)
        assertEquals(Money.ZERO, contract.escrow.held)
    }

    @Test
    fun `projected payout is the open milestones minus the fee`() {
        val contract = baseContract()
        assertEquals(Money.ofMajor(1185.0), EscrowEngine.projectedNetPayout(contract))
    }
}
