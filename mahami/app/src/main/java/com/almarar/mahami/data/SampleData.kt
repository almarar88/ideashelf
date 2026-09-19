package com.almarar.mahami.data

import java.time.LocalDate
import java.time.LocalTime

/** مشاريع افتراضية تُنشأ عند أول تشغيل، وبيانات تجريبية اختيارية */
object SampleData {

    val defaultProjects: List<Project> = listOf(
        Project(name = "العمل", colorArgb = 0xFF2E9BF0),
        Project(name = "المتابعات", colorArgb = 0xFFF5A524),
        Project(name = "شخصي", colorArgb = 0xFF3BA55D)
    )

    /** مهام تجريبية عامة لاستعراض التطبيق — يمكن حذفها بالكامل */
    fun demoTasks(today: LocalDate = LocalDate.now(), projectIds: List<Long>): List<Task> {
        val work = projectIds.getOrNull(0)
        val followUp = projectIds.getOrNull(1)
        val personal = projectIds.getOrNull(2)
        return listOf(
            // مهمة اليوم — مختارة ضمن «أهم ثلاث مهام» ولها خطة تنفيذ
            Task(
                title = "إعداد التقرير الشهري",
                details = "تجميع المؤشرات وصياغة التقرير وعرضه على الرئيس المباشر.",
                projectId = work,
                dueDate = today,
                dueTime = LocalTime.of(13, 0),
                priority = Priority.HIGH,
                important = true,
                mitDate = today,
                estimateMinutes = 90,
                tags = listOf("تقرير"),
                subTasks = listOf(
                    SubTask("تجميع البيانات", true, today),
                    SubTask("صياغة التقرير", false, today),
                    SubTask("المراجعة والاعتماد", false, today.plusDays(1))
                )
            ),
            // مهمة متأخرة — تُظهر بطاقة «متأخرة» والنقطة النابضة
            Task(
                title = "متابعة رد الجهة على الخطاب",
                details = "الاتصال بالجهة للتأكد من استلام الخطاب ومعرفة الموقف.",
                projectId = followUp,
                owner = "إدارة الشؤون الإدارية",
                dueDate = today.minusDays(1),
                priority = Priority.HIGH,
                important = true,
                mitDate = today,
                tags = listOf("متابعة")
            ),
            // مهمة أُنجزت اليوم مع وقت تركيز — تُحيي مؤشرات الإنجاز
            Task(
                title = "مراجعة محضر الاجتماع",
                details = "قراءة المحضر واعتماد التوصيات قبل إرساله.",
                projectId = work,
                dueDate = today,
                priority = Priority.MEDIUM,
                status = TaskStatus.DONE,
                completedAt = today.atTime(10, 20),
                focusMinutes = 50,
                estimateMinutes = 45,
                tags = listOf("اجتماعات")
            ),
            Task(
                title = "تنظيم اجتماع الفريق",
                details = "تحديد موعد مناسب وإرسال جدول الأعمال.",
                projectId = work,
                dueDate = today.plusDays(2),
                flexibleDeadline = true,
                priority = Priority.MEDIUM,
                mitDate = today,
                estimateMinutes = 30,
                subTasks = listOf(
                    SubTask("استطلاع المواعيد المناسبة", true),
                    SubTask("حجز القاعة"),
                    SubTask("إرسال الدعوة")
                )
            ),
            Task(
                title = "حصر مناهج دورات تعليم اللغات",
                details = "جرد المناهج المعتمدة ومطابقتها بالمستويات.",
                projectId = work,
                dueDate = today.plusDays(4),
                priority = Priority.MEDIUM,
                tags = listOf("تدريب")
            ),
            Task(
                title = "تجديد الاشتراك السنوي",
                projectId = personal,
                dueDate = today.plusDays(9),
                priority = Priority.LOW,
                repeat = Repeat.MONTHLY
            )
        )
    }
}
