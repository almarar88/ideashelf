package ai.pacto.app.domain

import ai.pacto.app.domain.engine.ArbitrationEngine
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.EscrowAccount
import ai.pacto.app.domain.model.EvidenceItem
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.LedgerEntry
import ai.pacto.app.domain.model.LedgerEntryType
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Party
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.TermKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ArbitrationEngineTest {

    private val day = 24 * 60 * 60 * 1000L

    private fun contract(
        deliveredAt: Long? = day,
        dueAt: Long = day,
        evidence: List<EvidenceItem> = emptyList(),
        terms: List<ContractTerm> = emptyList()
    ) = Contract(
        id = "c1",
        title = "دهان",
        createdAt = 0L,
        parties = listOf(
            Party("p_client", "الطالب", PartyRole.CLIENT),
            Party("p_provider", "المنفذ", PartyRole.PROVIDER)
        ),
        terms = terms,
        total = Money.ofMajor(1000.0),
        milestones = listOf(
            Milestone(
                "m1", "التنفيذ", Money.ofMajor(1000.0), dueAt,
                if (deliveredAt == null) MilestoneStatus.PENDING else MilestoneStatus.DELIVERED,
                weight = 1,
                deliveredAt = deliveredAt
            )
        ),
        escrow = EscrowAccount(
            ledger = listOf(LedgerEntry("l1", 0L, LedgerEntryType.DEPOSIT, Money.ofMajor(1000.0), "deposit"))
        ),
        evidence = evidence
    )

    @Test
    fun `on-time delivery with proof favours the provider`() {
        val report = ArbitrationEngine.arbitrate(
            contract(
                evidence = listOf(
                    EvidenceItem("e1", EvidenceKind.BEFORE_STATE, 0L),
                    EvidenceItem("e2", EvidenceKind.AFTER_STATE, day)
                )
            ),
            now = 2 * day
        )
        assertTrue(report.providerShare > 0.9f)
        assertEquals(Money.ofMajor(1000.0), report.providerAmount + report.clientAmount)
    }

    @Test
    fun `late delivery reduces the provider share`() {
        val onTime = ArbitrationEngine.arbitrate(contract(deliveredAt = day, dueAt = day), now = 5 * day)
        val late = ArbitrationEngine.arbitrate(contract(deliveredAt = 5 * day, dueAt = day), now = 5 * day)
        assertTrue(late.providerShare < onTime.providerShare)
    }

    @Test
    fun `documented defects pull the settlement back towards the client`() {
        val clean = ArbitrationEngine.arbitrate(contract(), now = 2 * day)
        val defective = ArbitrationEngine.arbitrate(
            contract(
                evidence = listOf(
                    EvidenceItem("e1", EvidenceKind.BEFORE_STATE, 0L),
                    EvidenceItem("e2", EvidenceKind.DEFECT, day),
                    EvidenceItem("e3", EvidenceKind.DEFECT, day)
                )
            ),
            now = 2 * day
        )
        assertTrue(defective.providerShare < clean.providerShare)
    }

    @Test
    fun `a defect claim with no before photo is called out as unresolved`() {
        val report = ArbitrationEngine.arbitrate(
            contract(evidence = listOf(EvidenceItem("e1", EvidenceKind.DEFECT, day))),
            now = 2 * day
        )
        assertTrue(report.unresolvedPoints.any { it.contains("قبل بدء العمل") })
    }

    @Test
    fun `the split never leaves money unassigned`() {
        val report = ArbitrationEngine.arbitrate(contract(deliveredAt = 9 * day, dueAt = day), now = 9 * day)
        assertEquals(Money.ofMajor(1000.0), report.providerAmount + report.clientAmount)
    }

    @Test
    fun `confidence rises when the contract is complete and evidenced`() {
        val thin = ArbitrationEngine.arbitrate(contract(), now = 2 * day)
        val rich = ArbitrationEngine.arbitrate(
            contract(
                evidence = listOf(
                    EvidenceItem("e1", EvidenceKind.BEFORE_STATE, 0L),
                    EvidenceItem("e2", EvidenceKind.AFTER_STATE, day)
                ),
                terms = listOf(
                    ContractTerm(TermKind.DEADLINE, "خلال يوم"),
                    ContractTerm(TermKind.CANCELLATION, "عند الإلغاء يُحتسب المنجز")
                )
            ),
            now = 2 * day
        )
        assertTrue(rich.confidence > thin.confidence)
    }
}
