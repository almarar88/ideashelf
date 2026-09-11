package ai.pacto.app.domain

import ai.pacto.app.domain.engine.LoopholeDetector
import ai.pacto.app.domain.engine.LoopholeSeverity
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.TermKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoopholeDetectorTest {

    private fun contract(
        terms: List<ContractTerm> = emptyList(),
        total: Money = Money.ofMajor(1000.0),
        milestones: List<Milestone> = emptyList(),
        transcript: String = ""
    ) = Contract(
        id = "c1",
        title = "t",
        createdAt = 0L,
        terms = terms,
        total = total,
        milestones = milestones,
        transcript = transcript
    )

    @Test
    fun `a deal with no deadline is blocked`() {
        val found = LoopholeDetector.detect(contract())
        val deadline = found.first { it.id == "missing_deadline" }
        assertEquals(LoopholeSeverity.BLOCKING, deadline.severity)
    }

    @Test
    fun `repair work without a materials clause is flagged`() {
        val found = LoopholeDetector.detect(contract(transcript = "اصلاح الغسالة وتبديل قطع غيار"))
        assertTrue(found.any { it.id == "missing_materials" })
    }

    @Test
    fun `milestones that do not add up to the total are blocked`() {
        val found = LoopholeDetector.detect(
            contract(
                total = Money.ofMajor(1000.0),
                milestones = listOf(
                    Milestone("m1", "دفعة", Money.ofMajor(400.0), 0L),
                    Milestone("m2", "دفعة", Money.ofMajor(500.0), 0L)
                )
            )
        )
        val mismatch = found.first { it.id == "milestones_mismatch" }
        assertEquals(LoopholeSeverity.BLOCKING, mismatch.severity)
    }

    @Test
    fun `matching milestones raise no mismatch`() {
        val found = LoopholeDetector.detect(
            contract(
                total = Money.ofMajor(900.0),
                milestones = listOf(
                    Milestone("m1", "دفعة", Money.ofMajor(400.0), 0L),
                    Milestone("m2", "دفعة", Money.ofMajor(500.0), 0L)
                )
            )
        )
        assertFalse(found.any { it.id == "milestones_mismatch" })
    }

    @Test
    fun `adding the suggested clause clears the gap`() {
        val before = contract()
        val cancellation = LoopholeDetector.detect(before).first { it.id == "missing_cancellation" }
        val after = before.copy(terms = before.terms + cancellation.suggestedClause!!)
        assertFalse(LoopholeDetector.detect(after).any { it.id == "missing_cancellation" })
    }

    @Test
    fun `blocking findings sort ahead of advisory ones`() {
        val found = LoopholeDetector.detect(contract(transcript = "بيع جهاز مستعمل"))
        val severities = found.map { it.severity.ordinal }
        assertEquals(severities.sorted(), severities)
    }

    @Test
    fun `inspection sales need an inspection window`() {
        val found = LoopholeDetector.detect(
            contract(
                terms = listOf(ContractTerm(TermKind.PRICE, "القيمة 2300")),
                transcript = "البيع على الفحص"
            )
        )
        assertTrue(found.any { it.id == "missing_inspection_window" })
    }
}
