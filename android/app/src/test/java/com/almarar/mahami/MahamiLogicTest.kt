package com.almarar.mahami

import com.almarar.mahami.data.Converters
import com.almarar.mahami.data.SeedData
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.util.Ar
import com.almarar.mahami.util.CalendarUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class MahamiLogicTest {

    @Test
    fun `المهام الأساسية خمس ومرتبة حسب الموعد`() {
        val tasks = SeedData.tasks()
        assertEquals(5, tasks.size)
        val dates = tasks.map { it.dueDate }
        assertEquals(dates.sorted(), dates)
        assertEquals(LocalDate.of(2026, 9, 14), dates.first())
        assertEquals(LocalDate.of(2026, 9, 18), dates.last())
    }

    @Test
    fun `تواريخ التسليم تقع في أيامها الصحيحة`() {
        assertEquals("الاثنين", Ar.dayName(LocalDate.of(2026, 9, 14)))
        assertEquals("الثلاثاء", Ar.dayName(LocalDate.of(2026, 9, 15)))
        assertEquals("الأربعاء", Ar.dayName(LocalDate.of(2026, 9, 16)))
        // التاريخ الوارد في رسالة ملفات المدربين يوم أحد فعلاً
        assertEquals("الأحد", Ar.dayName(LocalDate.of(2026, 8, 23)))
    }

    @Test
    fun `مهمتان في الأربعاء تعكسان ضغط اليوم`() {
        val wednesday = SeedData.tasks().filter { it.dueDate == LocalDate.of(2026, 9, 16) }
        assertEquals(2, wednesday.size)
    }

    @Test
    fun `التقدم يحسب من الخطوات المنجزة`() {
        val task = SeedData.tasks().first().copy(
            subTasks = listOf(SubTask("أ", true), SubTask("ب", true), SubTask("ج", false), SubTask("د", false))
        )
        assertEquals(0.5f, task.progress, 0.001f)
        assertEquals(1f, task.copy(status = TaskStatus.DONE).progress, 0.001f)
    }

    @Test
    fun `شبكة التقويم تبدأ بالسبت وتغطي الشهر كاملا`() {
        val month = YearMonth.of(2026, 9)
        val grid = CalendarUtils.monthGrid(month)
        assertEquals(0, grid.size % 7)
        val days = grid.filterNotNull()
        assertEquals(30, days.size)
        // أول يوم في سبتمبر 2026 هو الثلاثاء، أي العمود الرابع (السبت، الأحد، الاثنين، الثلاثاء)
        assertEquals(3, grid.indexOfFirst { it == month.atDay(1) })
        assertEquals("سبت", CalendarUtils.weekHeaders.first())
    }

    @Test
    fun `أسبوع اليوم سبعة أيام يبدأ بالسبت`() {
        val week = CalendarUtils.weekOf(LocalDate.of(2026, 9, 16))
        assertEquals(7, week.size)
        assertEquals(LocalDate.of(2026, 9, 12), week.first())
        assertEquals("السبت", Ar.dayName(week.first()))
    }

    @Test
    fun `الوصف الزمني النسبي بالعربية`() {
        val today = LocalDate.of(2026, 9, 14)
        assertEquals("اليوم", Ar.relative(today, today))
        assertEquals("غداً", Ar.relative(today.plusDays(1), today))
        assertEquals("بعد يومين", Ar.relative(today.plusDays(2), today))
        assertEquals("متأخرة يوماً", Ar.relative(today.minusDays(1), today))
    }

    @Test
    fun `محولات القاعدة تحفظ الخطوات والتنبيهات`() {
        val c = Converters()
        val subs = listOf(SubTask("خطوة أولى", true), SubTask("خطوة ثانية", false))
        assertEquals(subs, c.stringToSubTasks(c.subTasksToString(subs)))
        assertEquals(emptyList<SubTask>(), c.stringToSubTasks(""))
        val offsets = listOf(3, 1, 0)
        assertEquals(offsets, c.stringToInts(c.intsToString(offsets)))
    }

    @Test
    fun `المهمة المتأخرة تكتشف بعد فوات الموعد`() {
        val task = SeedData.tasks().first()
        val after = task.dueDateTime.plusDays(1)
        assertTrue(task.isOverdue(after))
        assertTrue(!task.isOverdue(task.dueDateTime.minusHours(1)))
        assertTrue(!task.copy(status = TaskStatus.DONE).isOverdue(after))
    }

    @Test
    fun `كل مهمة تحمل خطوات وتنبيهات`() {
        SeedData.tasks().forEach { task ->
            assertTrue(task.title.isNotBlank())
            assertTrue(task.subTasks.isNotEmpty())
            assertTrue(task.remindersEnabled)
            assertTrue(task.reminderOffsetsDays.contains(0))
        }
        assertEquals(4, SeedData.insights.size)
    }
}
