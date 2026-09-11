package ai.pacto.app.domain

import ai.pacto.app.domain.engine.TermExtractor
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Priority
import ai.pacto.app.domain.model.TermKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TermExtractorTest {

    private val maintenanceDeal =
        "تمام يا أبو سلطان، نبي صيانة أربع مكيفات سبليت في البيت. " +
            "المبلغ 1200 ريال وعربون 300 ريال اليوم، والباقي عند التسليم. " +
            "التسليم خلال 3 أيام، وقطع الغيار على حسابي، والضمان شهر."

    @Test
    fun `reads the headline price and the deposit separately`() {
        val result = TermExtractor.extract(maintenanceDeal)
        assertEquals(Money.ofMajor(1200.0, "SAR"), result.total)
        assertEquals(Money.ofMajor(300.0, "SAR"), result.deposit)
    }

    @Test
    fun `reads the delivery window in days`() {
        assertEquals(3, TermExtractor.extract(maintenanceDeal).deadlineDays)
    }

    @Test
    fun `a bare number next to a time word is not read as money`() {
        val result = TermExtractor.extract("التسليم خلال 5 أيام والسعر 700 ريال")
        assertEquals(Money.ofMajor(700.0, "SAR"), result.total)
        assertEquals(5, result.deadlineDays)
    }

    @Test
    fun `arabic-indic digits are understood`() {
        val result = TermExtractor.extract("الاتفاق على ٨٠٠ ريال تسليم خلال ٤ أيام")
        assertEquals(Money.ofMajor(800.0, "SAR"), result.total)
        assertEquals(4, result.deadlineDays)
    }

    @Test
    fun `currency follows the spoken word`() {
        assertEquals("AED", TermExtractor.extract("السعر 500 درهم").currency)
        assertEquals("EGP", TermExtractor.extract("السعر 5000 جنيه").currency)
    }

    @Test
    fun `dialect terms become real clauses`() {
        val result = TermExtractor.extract("بيع اللابتوب على الفحص بمبلغ 2300 ريال")
        assertTrue(result.dialectNotes.any { it.term == "على الفحص" })
        assertTrue(result.terms.any { it.kind == TermKind.INSPECTION })
    }

    @Test
    fun `today's work is urgent and next week's is not`() {
        assertEquals(Priority.URGENT, TermExtractor.extract("محتاجه مستعجل اليوم بـ 200 ريال").priority)
        assertEquals(Priority.NORMAL, TermExtractor.extract("التسليم خلال 10 أيام بمبلغ 900 ريال").priority)
    }

    @Test
    fun `warranty duration is converted to days`() {
        val result = TermExtractor.extract("تركيب بمبلغ 400 ريال مع ضمان 6 شهور")
        assertEquals(180, result.warrantyDays)
    }

    @Test
    fun `scope clause is produced from the action sentence`() {
        val result = TermExtractor.extract(maintenanceDeal)
        val scope = result.terms.firstOrNull { it.kind == TermKind.SCOPE }
        assertNotNull(scope)
        assertTrue(scope!!.text.contains("صيانه") || scope.text.contains("صيانة"))
    }
}
