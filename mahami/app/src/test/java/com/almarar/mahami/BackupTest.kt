package com.almarar.mahami

import com.almarar.mahami.core.Backup
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskLink
import com.almarar.mahami.data.TaskStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class BackupTest {

    private val projects = listOf(
        Project(id = 1, name = "العمل", colorArgb = 0xFF2E9BF0),
        Project(id = 2, name = "المتابعات", colorArgb = 0xFFF5A524)
    )

    private val tasks = listOf(
        Task(
            id = 1,
            title = "إعداد التقرير الشهري",
            details = "تجميع المؤشرات وصياغة التقرير",
            notes = "يُعرض على الرئيس المباشر",
            alert = "تأكد من تاريخ العرض",
            projectId = 1,
            tags = listOf("تقرير", "شهري"),
            owner = "إدارة الجودة",
            dueDate = LocalDate.of(2026, 10, 1),
            dueTime = LocalTime.of(11, 30),
            priority = Priority.HIGH,
            repeat = Repeat.MONTHLY,
            pinned = true,
            reminderOffsetsDays = listOf(3, 1, 0),
            subTasks = listOf(SubTask("تجميع البيانات", true), SubTask("الصياغة", false)),
            links = listOf(TaskLink("المجلد", "https://example.com/folder"))
        ),
        Task(
            id = 2,
            title = "متابعة الخطاب",
            projectId = 2,
            dueDate = LocalDate.of(2026, 9, 25),
            flexibleDeadline = true,
            status = TaskStatus.DONE,
            completedAt = LocalDate.of(2026, 9, 24).atTime(13, 0)
        )
    )

    @Test fun `نسخة JSON تحفظ وتستعيد كل الحقول`() {
        val restored = Backup.fromJson(Backup.toJson(tasks, projects))
        assertEquals(2, restored.tasks.size)
        assertEquals(2, restored.projects.size)

        val first = restored.tasks.first()
        assertEquals("إعداد التقرير الشهري", first.title)
        assertEquals(LocalDate.of(2026, 10, 1), first.dueDate)
        assertEquals(LocalTime.of(11, 30), first.dueTime)
        assertEquals(Priority.HIGH, first.priority)
        assertEquals(Repeat.MONTHLY, first.repeat)
        assertTrue(first.pinned)
        assertEquals(listOf("تقرير", "شهري"), first.tags)
        assertEquals(listOf(3, 1, 0), first.reminderOffsetsDays)
        assertEquals(2, first.subTasks.size)
        assertTrue(first.subTasks.first().done)
        assertEquals("https://example.com/folder", first.links.first().url)
        assertEquals(1L, first.projectId)
        assertEquals("تأكد من تاريخ العرض", first.alert)

        val second = restored.tasks[1]
        assertTrue(second.flexibleDeadline)
        assertEquals(TaskStatus.DONE, second.status)
        assertEquals(LocalDate.of(2026, 9, 24), second.completedAt?.toLocalDate())
    }

    @Test fun `ملف ICS صالح ويحوي حدثاً لكل مهمة`() {
        val ics = Backup.toIcs(tasks)
        assertTrue(ics.startsWith("BEGIN:VCALENDAR"))
        assertTrue(ics.trim().endsWith("END:VCALENDAR"))
        assertEquals(2, Regex("BEGIN:VEVENT").findAll(ics).count())
        assertEquals(2, Regex("BEGIN:VALARM").findAll(ics).count())
        assertTrue(ics.contains("DTSTART:20261001T113000"))
        assertTrue(ics.contains("TRIGGER:-P1D"))
        assertTrue(ics.contains("SUMMARY:إعداد التقرير الشهري"))
    }

    @Test fun `التقرير النصي يرتب المكتمل أخيراً`() {
        val text = Backup.toText(tasks, LocalDate.of(2026, 9, 26))
        assertTrue(text.contains("تقرير المهام"))
        assertTrue(text.contains("المنجز: 1 من 2"))
        assertTrue(text.indexOf("إعداد التقرير الشهري") < text.indexOf("متابعة الخطاب"))
    }

    @Test fun `ملف بلا مهام لا يعطّل الاستيراد`() {
        assertEquals(0, Backup.fromJson("""{"app":"mahami","tasks":[]}""").tasks.size)
        assertEquals(0, Backup.fromJson("{}").tasks.size)
    }

    @Test fun `المهام بلا عنوان تُتجاهل عند الاستيراد`() {
        val raw = """{"app":"mahami","tasks":[{"title":"  ","dueDate":"2026-10-01"},
            {"title":"صالحة","dueDate":"2026-10-02"}]}"""
        val restored = Backup.fromJson(raw)
        assertEquals(1, restored.tasks.size)
        assertEquals("صالحة", restored.tasks.first().title)
    }
}
