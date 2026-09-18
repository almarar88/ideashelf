package com.almarar.mahami.data

import java.time.LocalDate

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
            Task(
                title = "إعداد التقرير الشهري",
                details = "تجميع المؤشرات وصياغة التقرير وعرضه على الرئيس المباشر.",
                projectId = work,
                dueDate = today.plusDays(2),
                priority = Priority.HIGH,
                tags = listOf("تقرير"),
                subTasks = listOf(
                    SubTask("تجميع البيانات", true),
                    SubTask("صياغة التقرير"),
                    SubTask("المراجعة والاعتماد")
                )
            ),
            Task(
                title = "متابعة رد الجهة على الخطاب",
                details = "الاتصال بالجهة للتأكد من استلام الخطاب ومعرفة الموقف.",
                projectId = followUp,
                owner = "إدارة الشؤون الإدارية",
                dueDate = today.plusDays(1),
                priority = Priority.MEDIUM,
                tags = listOf("متابعة")
            ),
            Task(
                title = "تنظيم اجتماع الفريق",
                details = "تحديد موعد مناسب وإرسال جدول الأعمال.",
                projectId = work,
                dueDate = today.plusDays(4),
                flexibleDeadline = true,
                priority = Priority.MEDIUM,
                subTasks = listOf(
                    SubTask("استطلاع المواعيد المناسبة"),
                    SubTask("حجز القاعة"),
                    SubTask("إرسال الدعوة")
                )
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
