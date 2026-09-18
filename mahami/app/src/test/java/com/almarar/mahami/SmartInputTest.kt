package com.almarar.mahami

import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Quadrant
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.smart.ChipKind
import com.almarar.mahami.smart.Planner
import com.almarar.mahami.smart.SmartParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime

/** المحلّل الذكي ومخطّط التنفيذ — قلب «الإضافة السهلة» */
class SmartInputTest {

    // الأحد 13 سبتمبر 2026 — يوم عمل، فيسهل التحقق من تخطي الجمعة والسبت
    private val today = LocalDate.of(2026, 9, 13)

    // ---------- الأرقام ----------

    @Test
    fun `arabic indic digits become latin`() {
        assertEquals("16-09-2026", SmartParser.normalizeDigits("١٦-٠٩-٢٠٢٦"))
        assertEquals("الساعة 10", SmartParser.normalizeDigits("الساعة ١٠"))
    }

    // ---------- التاريخ ----------

    @Test
    fun `explicit day month year is parsed`() {
        val parsed = SmartParser.parseDate("تسليم 16-09-2026", today)
        assertEquals(LocalDate.of(2026, 9, 16), parsed?.first)
    }

    @Test
    fun `day slash month rolls to next year when already past`() {
        // 1/9 مضى بالنسبة ليوم 13 سبتمبر، فيُفهم أنه سبتمبر القادم
        val parsed = SmartParser.parseDate("موعد 1/9", today)
        assertEquals(LocalDate.of(2027, 9, 1), parsed?.first)
    }

    @Test
    fun `named month is parsed`() {
        val parsed = SmartParser.parseDate("الاجتماع 20 أكتوبر", today)
        assertEquals(LocalDate.of(2026, 10, 20), parsed?.first)
    }

    @Test
    fun `relative words are parsed`() {
        assertEquals(today, SmartParser.parseDate("اليوم", today)?.first)
        assertEquals(today.plusDays(1), SmartParser.parseDate("غداً", today)?.first)
        assertEquals(today.plusDays(2), SmartParser.parseDate("بعد غد", today)?.first)
        assertEquals(today.plusDays(3), SmartParser.parseDate("بعد 3 أيام", today)?.first)
        assertEquals(today.plusWeeks(2), SmartParser.parseDate("بعد 2 أسابيع", today)?.first)
        assertEquals(today.plusDays(14), SmartParser.parseDate("بعد أسبوعين", today)?.first)
    }

    @Test
    fun `end of month resolves to last day`() {
        assertEquals(LocalDate.of(2026, 9, 30), SmartParser.parseDate("نهاية الشهر", today)?.first)
    }

    @Test
    fun `next weekday skips today when marked as coming`() {
        // الأحد 13 سبتمبر: «الأربعاء» بلا وصف = أقرب أربعاء = 16 سبتمبر
        assertEquals(
            LocalDate.of(2026, 9, 16),
            SmartParser.parseDate("الأربعاء", today)?.first
        )
        // ولو كان اليوم نفسه أحداً فإن «الأحد القادم» يقفز أسبوعاً
        val nextSunday = SmartParser.parseDate("الأحد القادم", today)?.first
        assertEquals(DayOfWeek.SUNDAY, nextSunday?.dayOfWeek)
        assertTrue(nextSunday!!.isAfter(today))
    }

    // ---------- الوقت ----------

    @Test
    fun `time with evening marker becomes afternoon`() {
        assertEquals(LocalTime.of(14, 0), SmartParser.parseTime("الساعة 2 مساءً")?.first)
        assertEquals(LocalTime.of(14, 30), SmartParser.parseTime("14:30")?.first)
        assertEquals(LocalTime.of(9, 0), SmartParser.parseTime("الساعة 9 صباحاً")?.first)
        assertEquals(LocalTime.of(0, 15), SmartParser.parseTime("12:15 ص")?.first)
    }

    @Test
    fun `text without a time yields null`() {
        assertNull(SmartParser.parseTime("مراجعة الملف"))
    }

    // ---------- السطر الكامل ----------

    @Test
    fun `full line yields every field`() {
        val parsed = SmartParser.parse(
            "تسليم التقرير الأربعاء القادم الساعة 10 عاجل #تقارير @العمل (45د)",
            today
        )
        assertNotNull(parsed)
        parsed!!
        assertEquals("تسليم التقرير", parsed.title)
        assertEquals(DayOfWeek.WEDNESDAY, parsed.dueDate.dayOfWeek)
        assertEquals(LocalTime.of(10, 0), parsed.dueTime)
        assertEquals(Priority.HIGH, parsed.priority)
        assertEquals(listOf("تقارير"), parsed.tags)
        assertEquals("العمل", parsed.projectName)
        assertEquals(45, parsed.estimateMinutes)
        assertTrue(parsed.important)
        assertTrue(parsed.dateWasExplicit)
    }

    @Test
    fun `title keeps its words when nothing else matches`() {
        val parsed = SmartParser.parse("حصر مناهج دورات تعليم اللغات", today)
        assertNotNull(parsed)
        assertEquals("حصر مناهج دورات تعليم اللغات", parsed!!.title)
        // لا تاريخ صريح، فيُسند تاريخ اليوم دون ادّعاء أنه مُلتقط
        assertEquals(today, parsed.dueDate)
        assertFalse(parsed.dateWasExplicit)
    }

    @Test
    fun `owner is read from a titled name`() {
        val parsed = SmartParser.parse("اجتماع المنصة مع أ. سالم العتيبي غداً", today)
        assertNotNull(parsed)
        assertEquals("أ. سالم العتيبي", parsed!!.owner)
        assertEquals(today.plusDays(1), parsed.dueDate)
    }

    @Test
    fun `owner is read from a department`() {
        val parsed = SmartParser.parse("طلب إفادة من إدارة الجودة", today)
        assertEquals("إدارة الجودة", parsed?.owner)
    }

    @Test
    fun `owner regex does not fire inside a word`() {
        // «مناهج» تبدأ بـ «م» ولا يجوز أن تُقرأ كلقب
        val parsed = SmartParser.parse("حصر مناهج دورات اللغات", today)
        assertEquals("", parsed?.owner)
    }

    @Test
    fun `parsed chips describe what was captured`() {
        val parsed = SmartParser.parse("مراجعة العقد غداً عاجل #قانوني", today)
        assertNotNull(parsed)
        val kinds = parsed!!.matches.map { it.kind }.toSet()
        assertTrue(ChipKind.DATE in kinds)
        assertTrue(ChipKind.PRIORITY in kinds)
        assertTrue(ChipKind.TAG in kinds)
    }

    @Test
    fun `very short input is rejected`() {
        assertNull(SmartParser.parse("ا", today))
        assertNull(SmartParser.parse("", today))
    }

    // ---------- الاستيراد متعدد الأسطر ----------

    @Test
    fun `bullet list becomes several tasks`() {
        val text = """
            - تجهيز العرض غداً
            1) مراجعة الميزانية بعد 3 أيام
            • اتصال بالمورد
            
            ق
        """.trimIndent()
        val tasks = SmartParser.parseMany(text, today)
        assertEquals(3, tasks.size)
        assertEquals("تجهيز العرض", tasks[0].title)
        assertEquals(today.plusDays(1), tasks[0].dueDate)
        assertEquals("مراجعة الميزانية", tasks[1].title)
        assertEquals(today.plusDays(3), tasks[1].dueDate)
        assertEquals("اتصال بالمورد", tasks[2].title)
    }

    // ---------- مخطّط التنفيذ ----------

    private fun planned(steps: List<String>, due: LocalDate) = Task(
        id = 1,
        title = "مهمة",
        dueDate = due,
        subTasks = steps.map { SubTask(it) }
    )

    @Test
    fun `plan skips friday and saturday`() {
        // الأحد 13 ← الخميس 24 سبتمبر
        val task = planned(listOf("أ", "ب", "ج", "د"), LocalDate.of(2026, 9, 24))
        val plan = Planner.plan(task, today)
        assertTrue(plan.isNotEmpty())
        plan.forEach {
            assertTrue(
                "أُسندت خطوة ليوم عطلة: ${it.date.dayOfWeek}",
                it.date.dayOfWeek != DayOfWeek.FRIDAY && it.date.dayOfWeek != DayOfWeek.SATURDAY
            )
        }
    }

    @Test
    fun `plan leaves a safety day before the deadline`() {
        val due = LocalDate.of(2026, 9, 24)
        val task = planned(listOf("أ", "ب", "ج"), due)
        val plan = Planner.plan(task, today)
        assertTrue(plan.all { it.date.isBefore(due) })
    }

    @Test
    fun `plan covers every unfinished step exactly once`() {
        val steps = listOf("أ", "ب", "ج", "د", "هـ", "و", "ز")
        val task = planned(steps, LocalDate.of(2026, 9, 23))
        val assigned = Planner.plan(task, today).flatMap { it.steps }
        assertEquals(steps.size, assigned.size)
        assertEquals(steps.toSet(), assigned.toSet())
    }

    @Test
    fun `plan for a deadline today puts everything on that day`() {
        val task = planned(listOf("أ", "ب"), today)
        val plan = Planner.plan(task, today)
        assertEquals(1, plan.size)
        assertEquals(today, plan.first().date)
        assertEquals(2, plan.first().steps.size)
    }

    @Test
    fun `plan ignores steps already done`() {
        val task = Task(
            id = 1,
            title = "مهمة",
            dueDate = LocalDate.of(2026, 9, 23),
            subTasks = listOf(
                SubTask("منجزة", done = true),
                SubTask("باقية")
            )
        )
        val assigned = Planner.plan(task, today).flatMap { it.steps }
        assertEquals(listOf("باقية"), assigned)
    }

    @Test
    fun `applyTo writes a target date on each open step`() {
        val task = planned(listOf("أ", "ب", "ج"), LocalDate.of(2026, 9, 23))
        val result = Planner.applyTo(task, today)
        assertTrue(result.subTasks.all { it.targetDate != null })
    }

    @Test
    fun `steps due today includes overdue steps and skips done tasks`() {
        val open = Task(
            id = 1,
            title = "مفتوحة",
            dueDate = today.plusDays(5),
            subTasks = listOf(
                SubTask("متأخرة", targetDate = today.minusDays(1)),
                SubTask("اليوم", targetDate = today),
                SubTask("لاحقاً", targetDate = today.plusDays(2)),
                SubTask("منجزة", done = true, targetDate = today)
            )
        )
        val due = Planner.stepsDueToday(listOf(open), today)
        assertEquals(listOf("متأخرة", "اليوم"), due.map { it.second.title })
    }

    // ---------- مصفوفة الأولويات ----------

    @Test
    fun `quadrant follows importance and urgency`() {
        val urgentImportant = Task(title = "أ", dueDate = today.plusDays(1), important = true)
        val laterImportant = Task(title = "ب", dueDate = today.plusDays(20), important = true)
        val urgentOnly = Task(title = "ج", dueDate = today.plusDays(1))
        val neither = Task(title = "د", dueDate = today.plusDays(20))

        assertEquals(Quadrant.DO_NOW, urgentImportant.quadrant(today))
        assertEquals(Quadrant.SCHEDULE, laterImportant.quadrant(today))
        assertEquals(Quadrant.DELEGATE, urgentOnly.quadrant(today))
        assertEquals(Quadrant.LATER, neither.quadrant(today))
    }
}
