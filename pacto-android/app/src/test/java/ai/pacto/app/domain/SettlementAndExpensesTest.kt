package ai.pacto.app.domain

import ai.pacto.app.domain.engine.ExpenseAllocator
import ai.pacto.app.domain.engine.SettlementCalculator
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.EscrowAccount
import ai.pacto.app.domain.model.LedgerEntry
import ai.pacto.app.domain.model.LedgerEntryType
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.TermKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SettlementAndExpensesTest {

    private fun fundedContract(terms: List<ContractTerm> = emptyList()) = Contract(
        id = "c1",
        title = "مطبخ",
        createdAt = 0L,
        total = Money.ofMajor(1000.0),
        terms = terms,
        milestones = listOf(
            Milestone("m1", "مرحلة 1", Money.ofMajor(400.0), 0L, MilestoneStatus.DELIVERED, weight = 2, deliveredAt = 1L),
            Milestone("m2", "مرحلة 2", Money.ofMajor(600.0), 0L, MilestoneStatus.PENDING, weight = 2)
        ),
        escrow = EscrowAccount(
            feeBasisPoints = 125,
            ledger = listOf(
                LedgerEntry("l1", 0L, LedgerEntryType.DEPOSIT, Money.ofMajor(1000.0), "deposit")
            )
        )
    )

    @Test
    fun `half the work delivered pays for half and refunds the rest`() {
        val settlement = SettlementCalculator.calculate(fundedContract())
        assertEquals(50, settlement.completionPercent)
        assertEquals(Money.ofMajor(395.0), settlement.providerNet)
        assertEquals(Money.ofMajor(5.0), settlement.platformFee)
        assertEquals(Money.ofMajor(600.0), settlement.clientRefund)
    }

    @Test
    fun `provider entitlement never exceeds what is actually held`() {
        val contract = fundedContract().let {
            it.copy(
                escrow = it.escrow.copy(
                    ledger = listOf(LedgerEntry("l1", 0L, LedgerEntryType.DEPOSIT, Money.ofMajor(100.0), "deposit"))
                )
            )
        }
        val settlement = SettlementCalculator.calculate(contract)
        assertTrue(settlement.providerEntitlement <= Money.ofMajor(100.0))
        assertEquals(Money.ZERO, settlement.clientRefund)
    }

    @Test
    fun `parts are billed to the client when the contract says so`() {
        val contract = fundedContract(
            listOf(
                ContractTerm(
                    TermKind.MATERIALS,
                    "تكون قطع الغيار والمواد على حساب الطرف الطالب، ولا تُشترى إلا بموافقته."
                )
            )
        )
        val allocation = ExpenseAllocator.allocate(contract, "شراء قطع غيار للمضخة", Money.ofMajor(120.0))
        assertEquals(PartyRole.CLIENT, allocation.bearer)
    }

    @Test
    fun `a turnkey contract absorbs materials into the provider side`() {
        val contract = fundedContract(
            listOf(ContractTerm(TermKind.SCOPE, "التنفيذ بنظام تسليم المفتاح: يتحمل المنفذ المواد والعمالة."))
        )
        val allocation = ExpenseAllocator.allocate(contract, "شراء مواد ودهان", Money.ofMajor(120.0))
        assertEquals(PartyRole.PROVIDER, allocation.bearer)
    }

    @Test
    fun `fuel and transport stay with the provider`() {
        val allocation = ExpenseAllocator.allocate(fundedContract(), "بنزين ونقل العدة", Money.ofMajor(50.0))
        assertEquals(PartyRole.PROVIDER, allocation.bearer)
    }

    @Test
    fun `large expenses always need approval`() {
        val allocation = ExpenseAllocator.allocate(fundedContract(), "بنزين", Money.ofMajor(500.0))
        assertTrue(allocation.requiresApproval)
    }

    @Test
    fun `built expenses carry the reason they were assigned`() {
        val expense = ExpenseAllocator.build(
            contract = fundedContract(),
            id = "e1",
            description = "قطع غيار",
            amount = Money.ofMajor(20.0),
            incurredAt = 0L
        )
        assertTrue(expense.allocationReason.isNotBlank())
    }
}
