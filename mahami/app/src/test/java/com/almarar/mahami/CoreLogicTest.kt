package com.almarar.mahami

import com.almarar.mahami.core.Ar
import com.almarar.mahami.core.CalendarUtils
import com.almarar.mahami.core.Severity
import com.almarar.mahami.core.Stats
import com.almarar.mahami.data.Converters
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskLink
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.data.Templates
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth

class CoreLogicTest {

    private val today = LocalDate.of(2026, 9, 18) // الجمعة

    private fun task(
        id: Long = 1,
        title: String = "مهمة",
        due: LocalDate = today,
        status: TaskStatus = TaskStatus.PENDING,
        completedAt: LocalDateTime? = null,
        priority: Priority = Priority.MEDIUM,
        owner: String = "",
        flexible: Boolean = false,
        subTasks: List<SubTask> = emptyList(),
        projectId: Long? = null
    ) = Task(
        id = id, title = title, dueDate = due, status = status, completedAt = completedAt,
        priority = priority, owner = owner, flexibleDeadline = flexible,
        subTasks = subTasks, projectId = projectId
    )

    // ---------- التواريخ بالعربية ----------

    @Test
    fun `greeting matches the hour, including after midnight`() {
        // 3 فجراً ليست «صباح الخير»
        assertEquals("ليلة هادئة", Ar.greeting(3))
        assertEquals("صباح الخير", Ar.greeting(8))
        assertEquals("طاب يومك", Ar.greeting(14))
        assertEquals("مساء الخير", Ar.greeting(19))
        assertEquals("مساء الخير", Ar.greeting(23))
    }

    @Test fun `اسم اليوم والتاريخ الكامل`() {
        assertEquals("الجمعة", Ar.dayName(today))
        assertEquals("الجمعة 18-09-2026", Ar.fullDate(today))
        assertEquals("18 سبتمبر 2026", Ar.longDate(today))
    }

    @Test fun `الوصف الزمني النسبي`() {
        assertEquals("اليوم", Ar.relative(today, today))
        assertEquals("غداً", Ar.relative(today.plusDays(1), today))
        assertEquals("بعد يومين", Ar.relative(today.plusDays(2), today))
        assertEquals("متأخرة يوماً", Ar.relative(today.minusDays(1), today))
        assertEquals("متأخرة 5 أيام", Ar.relative(today.minusDays(5), today))
    }

    @Test fun `صيغة العدد العربية`() {
        assertEquals("لا مهام", Ar.countTasks(0))
        assertEquals("مهمة واحدة", Ar.countTasks(1))
        assertEquals("مهمتان", Ar.countTasks(2))
        assertEquals("5 مهام", Ar.countTasks(5))
        assertEquals("12 مهمة", Ar.countTasks(12))
        assertEquals("يومان", Ar.countDays(2))
    }

    @Test fun `تنسيق الوقت صباحاً ومساءً`() {
        assertEquals("9:00 صباحاً", Ar.time(java.time.LocalTime.of(9, 0)))
        assertEquals("2:30 مساءً", Ar.time(java.time.LocalTime.of(14, 30)))
        assertEquals("12:00 مساءً", Ar.time(java.time.LocalTime.of(12, 0)))
    }

    // ---------- التقويم ----------

    @Test fun `شبكة الشهر تبدأ بالسبت وتغطي أيامه`() {
        val month = YearMonth.of(2026, 9)
        val grid = CalendarUtils.monthGrid(month)
        assertEquals(0, grid.size % 7)
        assertEquals(30, grid.filterNotNull().size)
        assertEquals(3, grid.indexOfFirst { it == month.atDay(1) }) // 1 سبتمبر ثلاثاء
        assertEquals("سبت", CalendarUtils.weekHeaders.first())
    }

    @Test fun `أسبوع التاريخ سبعة أيام يبدأ بالسبت`() {
        val week = CalendarUtils.weekOf(today)
        assertEquals(7, week.size)
        assertEquals("السبت", Ar.dayName(week.first()))
        assertTrue(week.contains(today))
    }

    // ---------- حالة المهمة ----------

    @Test fun `التقدم يحسب من الخطوات`() {
        val t = task(subTasks = listOf(SubTask("أ", true), SubTask("ب", false)))
        assertEquals(0.5f, t.progress, 0.001f)
        assertEquals(1f, t.copy(status = TaskStatus.DONE).progress, 0.001f)
        assertEquals(0f, task().progress, 0.001f)
    }

    @Test fun `التأخر يعتمد على لحظة مرجعية`() {
        val t = task(due = today)
        assertTrue(t.isOverdue(today.plusDays(1).atTime(9, 0)))
        assertTrue(!t.isOverdue(today.atTime(8, 0)))
        assertTrue(!t.copy(status = TaskStatus.DONE).isOverdue(today.plusDays(9).atTime(9, 0)))
    }

    @Test fun `التسليم في الموعد يحسب من وقت الإنجاز`() {
        val onTime = task(due = today, status = TaskStatus.DONE, completedAt = today.atTime(10, 0))
        val late = task(due = today, status = TaskStatus.DONE, completedAt = today.plusDays(2).atTime(10, 0))
        assertEquals(true, onTime.deliveredOnTime())
        assertEquals(false, late.deliveredOnTime())
        assertNull(task().deliveredOnTime())
    }

    // ---------- الإحصاءات ----------

    @Test fun `الملخص يحسب المتأخر واليوم والقادم`() {
        val tasks = listOf(
            task(1, due = today.minusDays(2)),
            task(2, due = today),
            task(3, due = today.plusDays(3)),
            task(4, due = today.minusDays(1), status = TaskStatus.DONE, completedAt = today.minusDays(1).atTime(9, 0))
        )
        val s = Stats.summarize(tasks, today)
        assertEquals(4, s.total)
        assertEquals(1, s.done)
        assertEquals(1, s.late)
        assertEquals(1, s.today)
        assertEquals(1, s.upcoming)
        assertEquals(0.25f, s.completionRate, 0.001f)
        assertEquals(1f, s.onTimeRate, 0.001f)
    }

    @Test fun `سلسلة الإنجاز تحسب الأيام المتتالية`() {
        val tasks = listOf(
            task(1, status = TaskStatus.DONE, completedAt = today.atTime(9, 0)),
            task(2, status = TaskStatus.DONE, completedAt = today.minusDays(1).atTime(9, 0)),
            task(3, status = TaskStatus.DONE, completedAt = today.minusDays(2).atTime(9, 0)),
            task(4, status = TaskStatus.DONE, completedAt = today.minusDays(6).atTime(9, 0))
        )
        val (current, longest) = Stats.streaks(tasks, today)
        assertEquals(3, current)
        assertEquals(3, longest)
    }

    @Test fun `السلسلة تنقطع إذا مضى يومان بلا إنجاز`() {
        val tasks = listOf(
            task(1, status = TaskStatus.DONE, completedAt = today.minusDays(3).atTime(9, 0))
        )
        assertEquals(0, Stats.streaks(tasks, today).first)
    }

    @Test fun `توزيع الأسبوع سبعة أيام يبدأ اليوم`() {
        val tasks = listOf(task(1, due = today), task(2, due = today), task(3, due = today.plusDays(2)))
        val load = Stats.weekLoad(tasks, today)
        assertEquals(7, load.size)
        assertEquals(today, load.first().date)
        assertTrue(load.first().isToday)
        assertEquals(2, load.first().count)
        assertEquals(1, load[2].count)
    }

    @Test fun `إحصاء المشاريع يشمل المهام بلا مشروع`() {
        val projects = listOf(Project(id = 1, name = "العمل", colorArgb = 0xFF2E9BF0))
        val tasks = listOf(
            task(1, projectId = 1, status = TaskStatus.DONE, completedAt = today.atTime(9, 0)),
            task(2, projectId = 1),
            task(3, projectId = null)
        )
        val stats = Stats.byProject(tasks, projects)
        val work = stats.first { it.project?.id == 1L }
        assertEquals(2, work.total)
        assertEquals(1, work.done)
        assertEquals(0.5f, work.rate, 0.001f)
        assertTrue(stats.any { it.project == null && it.total == 1 })
    }

    @Test fun `الملاحظات تكشف الازدحام والتأخر`() {
        val tasks = listOf(
            task(1, title = "أ", due = today.plusDays(2)),
            task(2, title = "ب", due = today.plusDays(2)),
            task(3, title = "ج", due = today.minusDays(1)),
            task(4, title = "د", due = today.plusDays(5), flexible = true)
        )
        val insights = Stats.insights(tasks, today)
        assertTrue(insights.any { it.title.contains("تجاوزت موعدها") && it.severity == Severity.HIGH })
        assertTrue(insights.any { it.title.contains("ازدحام") })
        assertTrue(insights.any { it.title.contains("موعد غير محدد") })
    }

    @Test fun `لا ملاحظات عند اكتمال كل المهام`() {
        val tasks = listOf(task(1, status = TaskStatus.DONE, completedAt = today.atTime(9, 0)))
        assertTrue(Stats.insights(tasks, today).isEmpty())
    }

    @Test fun `الترتيب المقترح يقدّم المتأخر`() {
        val tasks = listOf(
            task(1, title = "قادمة", due = today.plusDays(6)),
            task(2, title = "متأخرة", due = today.minusDays(2)),
            task(3, title = "اليوم", due = today)
        )
        val ordered = Stats.suggestedOrder(tasks, today)
        assertEquals("متأخرة", ordered.first().title)
        assertEquals("اليوم", ordered[1].title)
    }

    // ---------- القوالب ----------

    @Test fun `القوالب تنتج مهاماً بخطوات ومواعيد`() {
        assertTrue(Templates.tasks.size >= 6)
        Templates.tasks.forEach { template ->
            val created = template.toTask(today, projectId = 7)
            assertEquals(template.name, created.title)
            assertEquals(today.plusDays(template.offsetDays), created.dueDate)
            assertEquals(7L, created.projectId)
            assertEquals(template.steps.size, created.subTasks.size)
            assertTrue(created.subTasks.none { it.done })
        }
    }

    @Test fun `نموذج الرسالة يُعبّأ ببيانات المهمة`() {
        val t = task(
            title = "إعداد التقرير",
            due = today.plusDays(3),
            owner = "إدارة الجودة",
            subTasks = listOf(SubTask("تجميع البيانات", false))
        )
        val template = Templates.messages.first { it.id == "official" }
        val text = Templates.render(template, t, today)
        assertTrue(text.contains("إعداد التقرير"))
        assertTrue(text.contains("إدارة الجودة"))
        assertTrue(text.contains(Ar.fullDate(today.plusDays(3))))
        assertTrue(text.contains("تجميع البيانات"))
        assertTrue(!text.contains("{"))
    }

    @Test fun `النموذج يعمل مع مهمة بلا جهة ولا خطوات`() {
        val text = Templates.render(Templates.messages.first(), task(title = "متابعة"), today)
        assertTrue(text.contains("متابعة"))
        assertTrue(!text.contains("{"))
    }

    // ---------- التكرار ----------

    @Test fun `التاريخ التالي للمهام المتكررة`() {
        val d = LocalDate.of(2026, 9, 30)
        assertNull(Repository.nextOccurrence(d, Repeat.NONE))
        assertEquals(LocalDate.of(2026, 10, 1), Repository.nextOccurrence(d, Repeat.DAILY))
        assertEquals(LocalDate.of(2026, 10, 7), Repository.nextOccurrence(d, Repeat.WEEKLY))
        assertEquals(LocalDate.of(2026, 10, 30), Repository.nextOccurrence(d, Repeat.MONTHLY))
    }

    // ---------- محولات قاعدة البيانات ----------

    @Test fun `المحولات تحفظ الخطوات والروابط والوسوم`() {
        val c = Converters()
        val subs = listOf(SubTask("خطوة أولى", true), SubTask("خطوة ثانية", false))
        assertEquals(subs, c.stringToSubTasks(c.subTasksToString(subs)))

        val links = listOf(TaskLink("الملف", "https://example.com/a"), TaskLink("", "example.org"))
        assertEquals(links, c.stringToLinks(c.linksToString(links)))

        val tags = listOf("تقرير", "عاجل")
        assertEquals(tags, c.stringToTags(c.tagsToString(tags)))

        assertEquals(listOf(3, 1, 0), c.stringToInts(c.intsToString(listOf(3, 1, 0))))
        assertEquals(emptyList<SubTask>(), c.stringToSubTasks(""))
        assertEquals(emptyList<String>(), c.stringToTags(""))
    }
}
