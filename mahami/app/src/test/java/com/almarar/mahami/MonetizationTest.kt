package com.almarar.mahami

import com.almarar.mahami.billing.FreeLimits
import com.almarar.mahami.billing.PlanId
import com.almarar.mahami.billing.ProFeature
import com.almarar.mahami.core.Export
import com.almarar.mahami.core.Stats
import com.almarar.mahami.data.FocusSession
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class MonetizationTest {

    private val today = LocalDate.of(2026, 9, 18) // الجمعة

    // ---------- خطط الاشتراك ----------

    @Test fun `معرّفات المنتجات مطابقة لما يُنشأ في Play Console`() {
        assertEquals("pro_monthly", PlanId.MONTHLY.productId)
        assertEquals("pro_yearly", PlanId.YEARLY.productId)
        assertEquals("pro_lifetime", PlanId.LIFETIME.productId)
        assertEquals(listOf("pro_monthly", "pro_yearly"), PlanId.subscriptionIds)
        assertEquals(listOf("pro_lifetime"), PlanId.oneTimeIds)
        assertEquals(PlanId.YEARLY, PlanId.from("pro_yearly"))
        assertNull(PlanId.from("unknown_product"))
    }

    @Test fun `خطة مدى الحياة ليست اشتراكاً متجدداً`() {
        assertTrue(PlanId.MONTHLY.isSubscription)
        assertTrue(PlanId.YEARLY.isSubscription)
        assertTrue(!PlanId.LIFETIME.isSubscription)
    }

    @Test fun `كل ميزة مدفوعة لها عنوان ووصف`() {
        assertTrue(ProFeature.entries.size >= 8)
        ProFeature.entries.forEach {
            assertTrue(it.title.isNotBlank())
            assertTrue(it.description.isNotBlank())
        }
    }

    @Test fun `حدود النسخة المجانية لا تحد عدد المهام`() {
        assertEquals(3, FreeLimits.PROJECTS)
        assertEquals(1, FreeLimits.REMINDERS_PER_TASK)
        assertEquals(Int.MAX_VALUE, FreeLimits.TASKS)
    }

    // ---------- التكرار المتقدم ----------

    @Test fun `التكرار كل عدة أيام يحترم الفاصل`() {
        assertEquals(
            today.plusDays(3),
            Repository.nextOccurrence(today, Repeat.EVERY_N_DAYS, interval = 3)
        )
        assertEquals(
            today.plusDays(1),
            Repository.nextOccurrence(today, Repeat.EVERY_N_DAYS, interval = 0)
        )
    }

    @Test fun `التكرار في أيام محددة ينتقل لأقرب يوم مختار`() {
        // اليوم الجمعة (5) — الأيام المختارة: الاثنين (1) والأربعاء (3)
        val next = Repository.nextOccurrence(today, Repeat.WEEKDAYS, days = listOf(1, 3))
        assertEquals(LocalDate.of(2026, 9, 21), next) // الاثنين التالي
        assertEquals(1, next?.dayOfWeek?.value)
    }

    @Test fun `أيام فارغة في التكرار المحدد تعود لأسبوع كامل`() {
        assertEquals(
            today.plusWeeks(1),
            Repository.nextOccurrence(today, Repeat.WEEKDAYS, days = emptyList())
        )
    }

    @Test fun `التكرار المتقدم مصنّف كميزة مدفوعة`() {
        assertTrue(Repeat.EVERY_N_DAYS.isAdvanced)
        assertTrue(Repeat.WEEKDAYS.isAdvanced)
        assertTrue(!Repeat.DAILY.isAdvanced)
        assertTrue(!Repeat.NONE.isAdvanced)
    }

    // ---------- التركيز ----------

    @Test fun `ملخص التركيز يحسب اليوم والأسبوع`() {
        val sessions = listOf(
            FocusSession(taskId = 1, minutes = 25, at = today.atTime(9, 0)),
            FocusSession(taskId = 1, minutes = 15, at = today.atTime(11, 0)),
            FocusSession(taskId = 2, minutes = 45, at = today.minusDays(2).atTime(10, 0)),
            FocusSession(taskId = 2, minutes = 30, at = today.minusDays(20).atTime(10, 0))
        )
        val summary = Stats.focusSummary(sessions, today)
        assertEquals(115, summary.totalMinutes)
        assertEquals(40, summary.todayMinutes)
        assertEquals(85, summary.weekMinutes)
        assertEquals(4, summary.sessions)
        assertEquals(7, summary.perDay.size)
        assertEquals(today, summary.perDay.last().date)
    }

    @Test fun `لا جلسات يعني ملخصاً صفرياً`() {
        val summary = Stats.focusSummary(emptyList(), today)
        assertEquals(0, summary.totalMinutes)
        assertTrue(summary.perDay.isEmpty())
    }

    @Test fun `الإنجاز الشهري يغطي ستة أشهر`() {
        val tasks = listOf(
            Task(id = 1, title = "أ", dueDate = today, status = TaskStatus.DONE,
                completedAt = today.atTime(9, 0)),
            Task(id = 2, title = "ب", dueDate = today, status = TaskStatus.DONE,
                completedAt = today.minusMonths(2).atTime(9, 0))
        )
        val months = Stats.monthlyCompleted(tasks, today)
        assertEquals(6, months.size)
        assertEquals(1, months.last().second)
        assertEquals(1, months[3].second)
    }

    // ---------- تصدير CSV ----------

    @Test fun `ملف CSV يحوي ترويسة وصفاً لكل مهمة`() {
        val projects = listOf(Project(id = 1, name = "العمل", colorArgb = 0xFF2E9BF0))
        val tasks = listOf(
            Task(
                id = 1, title = "إعداد التقرير", projectId = 1,
                dueDate = today, priority = Priority.HIGH,
                subTasks = listOf(SubTask("جمع", true), SubTask("صياغة", false)),
                focusMinutes = 50, tags = listOf("تقرير")
            ),
            Task(id = 2, title = "متابعة, بفاصلة", dueDate = today.minusDays(3))
        )
        val csv = Export.toCsv(tasks, projects, today)

        assertTrue(csv.startsWith("﻿"))
        val lines = csv.trim().lines()
        assertEquals(3, lines.size)
        assertTrue(lines[0].contains("العنوان"))
        assertTrue(lines.any { it.contains("إعداد التقرير") && it.contains("العمل") && it.contains("50") })
        // الفاصلة داخل النص تُقتبس ولا تكسر الأعمدة
        assertTrue(lines.any { it.contains("\"متابعة, بفاصلة\"") })
        // الصفوف مرتبة بالموعد، والمتأخرة تُعلَّم بـ «نعم»
        val lateRow = lines.first { it.contains("بفاصلة") }
        assertTrue(lateRow.trim().endsWith("نعم"))
        val onTimeRow = lines.first { it.contains("إعداد التقرير") }
        assertTrue(onTimeRow.trim().endsWith("لا"))
    }

    @Test fun `CSV يعمل مع قائمة فارغة`() {
        val csv = Export.toCsv(emptyList(), emptyList(), today)
        assertEquals(1, csv.trim().lines().size)
        assertNotNull(csv)
    }
}
