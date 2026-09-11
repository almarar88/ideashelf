package com.almarar.mahami

import com.almarar.mahami.ai.Heuristics
import com.almarar.mahami.ai.RiskLevel
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.SeedData
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.util.Backup
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class AiLogicTest {

    private val today = LocalDate.of(2026, 9, 11) // الجمعة

    // ---------- تحليل التواريخ العربية ----------

    @Test fun `تاريخ صريح بصيغة يوم-شهر-سنة`() {
        assertEquals(LocalDate.of(2026, 9, 16), Heuristics.parseDate("التسليم 16-09-2026", today))
        assertEquals(LocalDate.of(2026, 9, 16), Heuristics.parseDate("التسليم 16/09/2026", today))
    }

    @Test fun `تاريخ باسم الشهر العربي`() {
        assertEquals(LocalDate.of(2026, 11, 1), Heuristics.parseDate("ابتداءً من 1 نوفمبر 2026", today))
    }

    @Test fun `الأرقام العربية الهندية تُقرأ`() {
        assertEquals(LocalDate.of(2026, 9, 14), Heuristics.parseDate("الموعد ١٤-٠٩-٢٠٢٦", today))
    }

    @Test fun `الكلمات النسبية`() {
        assertEquals(today, Heuristics.parseDate("مطلوب اليوم", today))
        assertEquals(today.plusDays(1), Heuristics.parseDate("أرسلها غداً", today))
        assertEquals(today.plusDays(2), Heuristics.parseDate("بعد غد إن شاء الله", today))
        assertEquals(today.plusDays(3), Heuristics.parseDate("خلال 3 أيام", today))
        assertEquals(today.plusWeeks(1), Heuristics.parseDate("بعد أسبوع", today))
    }

    @Test fun `أيام الأسبوع تُحسب للمستقبل`() {
        // الجمعة 11 سبتمبر → الاثنين القادم هو 14
        assertEquals(LocalDate.of(2026, 9, 14), Heuristics.parseDate("يوم الاثنين القادم", today))
        assertEquals(LocalDate.of(2026, 9, 16), Heuristics.parseDate("الأربعاء القادم", today))
    }

    @Test fun `نص بلا تاريخ يعيد فراغاً`() {
        assertNull(Heuristics.parseDate("متابعة الموضوع مع الإدارة", today))
    }

    @Test fun `استخراج الوقت والأولوية والمسؤول`() {
        assertEquals(14, Heuristics.parseTime("الاجتماع الساعة 2 مساءً")?.hour)
        assertEquals(9, Heuristics.parseTime("الساعة 9 صباحاً")?.hour)
        assertEquals(Priority.HIGH, Heuristics.parsePriority("مطلوب عاجل جداً"))
        assertEquals(Priority.LOW, Heuristics.parsePriority("عند التفرغ"))
        assertEquals("أ. منى الكندي", Heuristics.parseOwner("التنسيق مع أ. منى الكندي لحصر الوثائق"))
    }

    // ---------- استخراج المهام من نص ----------

    @Test fun `استخراج عدة مهام من رسالة مرقّمة`() {
        val text = """
            1. إعداد خطة زمنية للتواصل مع الجهات الحكومية — الموعد 14-09-2026
            2. حصر مناهج دورات تعليم اللغات بالتنسيق مع أ. منى الكندي — 15-09-2026
            3. مقترح طرح دورات اللغات — الأربعاء 16-09-2026
        """.trimIndent()

        val tasks = Heuristics.extractTasks(text, today)
        assertEquals(3, tasks.size)
        assertEquals(LocalDate.of(2026, 9, 14), tasks[0].dueDate)
        assertEquals(LocalDate.of(2026, 9, 15), tasks[1].dueDate)
        assertEquals(LocalDate.of(2026, 9, 16), tasks[2].dueDate)
        assertTrue(tasks.all { it.title.isNotBlank() })
        assertTrue(tasks.all { it.dateWasExplicit })
        assertEquals("أ. منى الكندي", tasks[1].owner)
    }

    @Test fun `نص بلا تاريخ يُعلَّم كتاريخ مستنتج`() {
        val tasks = Heuristics.extractTasks("متابعة تجهيز قاعة التدريب", today)
        assertEquals(1, tasks.size)
        assertTrue(!tasks.first().dateWasExplicit)
        assertEquals(today.plusDays(1), tasks.first().dueDate)
    }

    @Test fun `النص الفارغ لا ينتج مهاماً`() {
        assertTrue(Heuristics.extractTasks("   ", today).isEmpty())
    }

    // ---------- الخطة والمخاطر ----------

    @Test fun `خطة اليوم ترتب المتأخر أولاً`() {
        val tasks = SeedData.tasks().mapIndexed { i, t -> t.copy(id = (i + 1).toLong()) }
        val plan = Heuristics.dailyPlan(tasks, LocalDate.of(2026, 9, 17))
        assertTrue(plan.isNotEmpty())
        val first = tasks.first { it.id == plan.first().taskId }
        assertTrue(first.dueDate.isBefore(LocalDate.of(2026, 9, 17)))
    }

    @Test fun `المخاطر تكشف ازدحام الأربعاء`() {
        val tasks = SeedData.tasks().mapIndexed { i, t -> t.copy(id = (i + 1).toLong()) }
        val risks = Heuristics.risks(tasks, today)
        assertTrue(risks.any { it.title.contains("الأربعاء") })
        assertTrue(risks.any { it.title.contains("موعد غير محدد") })
    }

    @Test fun `لا مخاطر عند عدم وجود مهام مفتوحة`() {
        val done = SeedData.tasks().map { it.copy(status = TaskStatus.DONE) }
        assertTrue(Heuristics.risks(done, today).isEmpty())
    }

    @Test fun `المهام المتأخرة تُصنّف خطراً مرتفعاً`() {
        val tasks = SeedData.tasks().mapIndexed { i, t -> t.copy(id = (i + 1).toLong()) }
        val risks = Heuristics.risks(tasks, LocalDate.of(2026, 9, 20))
        assertTrue(risks.any { it.level == RiskLevel.HIGH })
    }

    @Test fun `الخطوات المقترحة تناسب نوع المهمة`() {
        assertTrue(Heuristics.suggestSteps("تنسيق اجتماع مع إدارة التقنية").any { it.contains("الاتصال") })
        assertTrue(Heuristics.suggestSteps("حصر وثائق المدربين").any { it.contains("حفظ") })
        assertTrue(Heuristics.suggestSteps("أي مهمة أخرى").size >= 3)
    }

    @Test fun `مسودة الرسالة تذكر الموعد والمطلوب`() {
        val task = SeedData.tasks().first()
        val draft = Heuristics.draftMessage(task, formal = true)
        assertTrue(draft.contains(task.title))
        assertTrue(draft.contains("14-09-2026"))
        assertTrue(draft.contains("السلام عليكم"))
    }

    // ---------- التكرار ----------

    @Test fun `التكرار يحسب التاريخ التالي`() {
        val d = LocalDate.of(2026, 9, 16)
        assertNull(TaskRepository.nextOccurrence(d, Repeat.NONE))
        assertEquals(d.plusDays(1), TaskRepository.nextOccurrence(d, Repeat.DAILY))
        assertEquals(d.plusWeeks(1), TaskRepository.nextOccurrence(d, Repeat.WEEKLY))
        assertEquals(LocalDate.of(2026, 10, 16), TaskRepository.nextOccurrence(d, Repeat.MONTHLY))
    }

    // ---------- النسخ الاحتياطي والتقويم ----------

    @Test fun `نسخة JSON تحفظ وتستعيد كل الحقول`() {
        val original = SeedData.tasks()
        val restored = Backup.fromJson(Backup.toJson(original))
        assertEquals(original.size, restored.size)
        original.zip(restored).forEach { (a, b) ->
            assertEquals(a.title, b.title)
            assertEquals(a.dueDate, b.dueDate)
            assertEquals(a.priority, b.priority)
            assertEquals(a.owner, b.owner)
            assertEquals(a.subTasks.size, b.subTasks.size)
            assertEquals(a.reminderOffsetsDays, b.reminderOffsetsDays)
        }
    }

    @Test fun `ملف ICS صالح ويحوي حدثاً لكل مهمة`() {
        val tasks = SeedData.tasks().mapIndexed { i, t -> t.copy(id = (i + 1).toLong()) }
        val ics = Backup.toIcs(tasks)
        assertTrue(ics.startsWith("BEGIN:VCALENDAR"))
        assertTrue(ics.trim().endsWith("END:VCALENDAR"))
        assertEquals(tasks.size, Regex("BEGIN:VEVENT").findAll(ics).count())
        assertTrue(ics.contains("DTSTART:20260914T090000"))
        assertTrue(ics.contains("TRIGGER:-P1D"))
    }

    @Test fun `استيراد ملف تالف لا ينتج مهاماً`() {
        assertEquals(0, Backup.fromJson("""{"app":"mahami","tasks":[]}""").size)
        assertNotNull(runCatching { Backup.fromJson("{}") }.getOrNull())
    }
}
