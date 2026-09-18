package com.almarar.mahami.data

import java.time.LocalDate

/** مهمة داخل طقم المشروع */
data class TemplateTask(
    val title: String,
    val offsetDays: Long,
    val priority: Priority = Priority.MEDIUM,
    val steps: List<String> = emptyList(),
    val important: Boolean = false
)

/**
 * طقم جاهز ينشئ مشروعاً كاملاً بمهامه المتسلسلة بضغطة واحدة،
 * بدل إنشاء ست مهام يدوياً في كل مرة.
 */
data class ProjectKit(
    val id: String,
    val name: String,
    val emoji: String,
    val hint: String,
    val colorArgb: Long,
    val tasks: List<TemplateTask>
) {
    val durationDays: Long get() = tasks.maxOfOrNull { it.offsetDays } ?: 0
}

object ProjectTemplates {

    val kits: List<ProjectKit> = listOf(
        ProjectKit(
            id = "training_course",
            name = "إطلاق دورة تدريبية",
            emoji = "🎓",
            hint = "من اعتماد المنهج حتى تسليم الشهادات",
            colorArgb = 0xFF2E9BF0,
            tasks = listOf(
                TemplateTask("اعتماد منهج الدورة ومخرجاتها", 3, Priority.HIGH, listOf(
                    "مراجعة المحتوى المقترح", "عرضه على رئيس القسم", "اعتماد النسخة النهائية"
                ), important = true),
                TemplateTask("ترشيح المدرب والتعاقد معه", 7, Priority.HIGH, listOf(
                    "حصر المدربين المؤهلين", "طلب السيرة الذاتية", "إرسال العقد"
                )),
                TemplateTask("حجز القاعة وتحديد الفترات", 10, Priority.MEDIUM, listOf(
                    "التأكد من توفر القاعة", "تحديد الفترة الصباحية والمسائية"
                )),
                TemplateTask("فتح التسجيل والإعلان", 14, Priority.HIGH, listOf(
                    "تجهيز رابط التسجيل", "إعداد مادة الإعلان", "النشر عبر القنوات"
                )),
                TemplateTask("تجهيز المواد والحضور", 20, Priority.MEDIUM, listOf(
                    "طباعة الحقائب التدريبية", "تجهيز كشف الحضور", "اختبار الأجهزة"
                )),
                TemplateTask("التقييم وإصدار الشهادات", 26, Priority.MEDIUM, listOf(
                    "توزيع استمارة التقييم", "تحليل النتائج", "إصدار الشهادات وتسليمها"
                ))
            )
        ),
        ProjectKit(
            id = "monthly_report",
            name = "التقرير الشهري",
            emoji = "📊",
            hint = "دورة تقرير كاملة من جمع البيانات حتى الرفع",
            colorArgb = 0xFF3BA55D,
            tasks = listOf(
                TemplateTask("جمع البيانات والمؤشرات", 2, Priority.MEDIUM, listOf(
                    "طلب الأرقام من الأقسام", "التأكد من اكتمالها"
                )),
                TemplateTask("صياغة التقرير", 4, Priority.HIGH, listOf(
                    "كتابة الملخص التنفيذي", "إعداد الجداول والرسوم", "كتابة التوصيات"
                ), important = true),
                TemplateTask("المراجعة اللغوية والرقمية", 5, Priority.MEDIUM),
                TemplateTask("اعتماد الرئيس المباشر", 6, Priority.HIGH),
                TemplateTask("الرفع والأرشفة", 7, Priority.MEDIUM, listOf(
                    "إرسال النسخة النهائية", "حفظها في الأرشيف"
                ))
            )
        ),
        ProjectKit(
            id = "government_liaison",
            name = "التواصل مع جهة حكومية",
            emoji = "🏛️",
            hint = "خطة مخاطبة ومتابعة حتى الرد النهائي",
            colorArgb = 0xFFF5A524,
            tasks = listOf(
                TemplateTask("حصر الجهات وجهات الاتصال", 2, Priority.MEDIUM, listOf(
                    "إعداد قائمة الجهات", "توثيق أرقام وبريد المسؤولين"
                )),
                TemplateTask("إعداد العرض التعريفي", 5, Priority.HIGH, listOf(
                    "تجهيز عرض الخدمات", "مراجعته داخلياً"
                ), important = true),
                TemplateTask("إرسال الخطابات الرسمية", 7, Priority.HIGH),
                TemplateTask("المتابعة الهاتفية الأولى", 10, Priority.MEDIUM),
                TemplateTask("تحديد موعد اجتماع", 14, Priority.HIGH),
                TemplateTask("توثيق المخرجات وخطة المتابعة", 20, Priority.MEDIUM)
            )
        ),
        ProjectKit(
            id = "event",
            name = "تنظيم فعالية",
            emoji = "🎪",
            hint = "من الفكرة حتى تقرير ما بعد الفعالية",
            colorArgb = 0xFF8B7FB8,
            tasks = listOf(
                TemplateTask("اعتماد الفكرة والميزانية", 3, Priority.HIGH, important = true),
                TemplateTask("حجز المكان والتاريخ", 6, Priority.HIGH),
                TemplateTask("دعوة المتحدثين والضيوف", 10, Priority.MEDIUM, listOf(
                    "إعداد قائمة المدعوين", "إرسال الدعوات", "متابعة التأكيدات"
                )),
                TemplateTask("التجهيزات اللوجستية", 16, Priority.MEDIUM, listOf(
                    "الضيافة", "الصوتيات والعرض", "التنظيم والاستقبال"
                )),
                TemplateTask("التنفيذ يوم الفعالية", 20, Priority.HIGH),
                TemplateTask("تقرير ما بعد الفعالية", 23, Priority.MEDIUM)
            )
        ),
        ProjectKit(
            id = "onboarding",
            name = "تهيئة موظف جديد",
            emoji = "🧑‍💼",
            hint = "أول ثلاثين يوماً للموظف الجديد",
            colorArgb = 0xFF00A3A3,
            tasks = listOf(
                TemplateTask("تجهيز المكتب والأجهزة والصلاحيات", 1, Priority.HIGH),
                TemplateTask("جلسة تعريف بالإدارة والمهام", 3, Priority.MEDIUM),
                TemplateTask("تسليم الوصف الوظيفي والأهداف", 5, Priority.HIGH, important = true),
                TemplateTask("متابعة الأسبوع الثاني", 14, Priority.MEDIUM),
                TemplateTask("تقييم نهاية الشهر الأول", 30, Priority.MEDIUM)
            )
        )
    )

    /** يبني المهام من الطقم بعد ربطها بمشروع */
    fun buildTasks(
        kit: ProjectKit,
        projectId: Long,
        today: LocalDate = LocalDate.now(),
        reminderOffsets: List<Int> = listOf(1, 0)
    ): List<Task> = kit.tasks.map { template ->
        Task(
            title = template.title,
            projectId = projectId,
            dueDate = today.plusDays(template.offsetDays),
            priority = template.priority,
            important = template.important,
            subTasks = template.steps.map { SubTask(it) },
            reminderOffsetsDays = reminderOffsets,
            tags = listOf(kit.name)
        )
    }
}
