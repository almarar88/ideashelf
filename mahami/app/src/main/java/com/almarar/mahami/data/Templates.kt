package com.almarar.mahami.data

import java.time.LocalDate

/**
 * قوالب جاهزة لإنشاء المهام بخطواتها المعتادة،
 * ونماذج رسائل تُعبَّأ آلياً من بيانات المهمة.
 */
data class TaskTemplate(
    val id: String,
    val name: String,
    val emoji: String,
    val hint: String,
    val offsetDays: Long,
    val priority: Priority,
    val steps: List<String>,
    val reminderOffsets: List<Int> = listOf(2, 1, 0),
    val tags: List<String> = emptyList()
) {
    /** يبني مهمة جاهزة من القالب */
    fun toTask(today: LocalDate = LocalDate.now(), projectId: Long? = null): Task = Task(
        title = name,
        details = hint,
        projectId = projectId,
        dueDate = today.plusDays(offsetDays),
        priority = priority,
        subTasks = steps.map { SubTask(it) },
        reminderOffsetsDays = reminderOffsets,
        tags = tags
    )
}

data class MessageTemplate(
    val id: String,
    val name: String,
    val hint: String,
    val body: String
)

object Templates {

    val tasks: List<TaskTemplate> = listOf(
        TaskTemplate(
            id = "meeting",
            name = "اجتماع تنسيقي",
            emoji = "🤝",
            hint = "تنسيق اجتماع مع جهة داخلية أو خارجية ومتابعة مخرجاته.",
            offsetDays = 3,
            priority = Priority.HIGH,
            steps = listOf(
                "تحديد المشاركين والجهة المعنية",
                "الاتصال لتثبيت الموعد",
                "إرسال الدعوة وجدول الأعمال",
                "عقد الاجتماع وتدوين المحضر",
                "توزيع المخرجات ومتابعة التنفيذ"
            ),
            tags = listOf("اجتماع")
        ),
        TaskTemplate(
            id = "report",
            name = "تقرير دوري",
            emoji = "📊",
            hint = "إعداد تقرير وتسليمه للجهة المختصة.",
            offsetDays = 7,
            priority = Priority.MEDIUM,
            steps = listOf(
                "تجميع البيانات والمؤشرات",
                "صياغة التقرير",
                "المراجعة اللغوية والرقمية",
                "اعتماد الرئيس المباشر",
                "الإرسال والأرشفة"
            ),
            tags = listOf("تقرير")
        ),
        TaskTemplate(
            id = "letter",
            name = "مخاطبة جهة",
            emoji = "✉️",
            hint = "إعداد خطاب رسمي وإرساله ومتابعة الرد.",
            offsetDays = 4,
            priority = Priority.MEDIUM,
            steps = listOf(
                "صياغة مسودة الخطاب",
                "المراجعة والاعتماد",
                "التوقيع والصادر",
                "الإرسال للجهة",
                "متابعة الرد بعد أسبوع"
            ),
            tags = listOf("مراسلات")
        ),
        TaskTemplate(
            id = "documents",
            name = "حصر وثائق",
            emoji = "🗂️",
            hint = "حصر ملفات أو وثائق واستكمال الناقص منها.",
            offsetDays = 5,
            priority = Priority.MEDIUM,
            steps = listOf(
                "إعداد قائمة بالمطلوب حصره",
                "مخاطبة المعنيين",
                "متابعة الردود واستكمال الناقص",
                "الحفظ في المجلد المعتمد",
                "وضع آلية تحديث دورية"
            ),
            tags = listOf("وثائق")
        ),
        TaskTemplate(
            id = "course",
            name = "تنظيم دورة تدريبية",
            emoji = "🎓",
            hint = "الإعداد الكامل لطرح دورة وتشغيلها.",
            offsetDays = 14,
            priority = Priority.HIGH,
            steps = listOf(
                "اعتماد المنهج ومحتوى الدورة",
                "ترشيح المدرب والتعاقد",
                "حجز القاعة وتحديد الفترات",
                "فتح التسجيل والإعلان",
                "تجهيز الحضور والمواد",
                "التقييم وإصدار الشهادات"
            ),
            reminderOffsets = listOf(7, 3, 1, 0),
            tags = listOf("تدريب")
        ),
        TaskTemplate(
            id = "followup",
            name = "متابعة معاملة",
            emoji = "🔁",
            hint = "متابعة معاملة أو طلب لدى جهة أخرى حتى الإغلاق.",
            offsetDays = 2,
            priority = Priority.MEDIUM,
            steps = listOf(
                "تسجيل رقم المعاملة والجهة",
                "الاتصال الأول للاستفسار",
                "تذكير بعد يومين",
                "توثيق الرد وإغلاق المتابعة"
            ),
            tags = listOf("متابعة")
        ),
        TaskTemplate(
            id = "quick",
            name = "مهمة سريعة",
            emoji = "⚡",
            hint = "مهمة قصيرة بخطوة واحدة.",
            offsetDays = 1,
            priority = Priority.LOW,
            steps = emptyList(),
            reminderOffsets = listOf(0)
        )
    )

    val messages: List<MessageTemplate> = listOf(
        MessageTemplate(
            id = "reminder",
            name = "تذكير مهذّب",
            hint = "رسالة قصيرة تصلح للواتساب أو البريد",
            body = """
                السلام عليكم ورحمة الله،
                
                تذكير بخصوص «{المهمة}»، والموعد المحدد {التاريخ} ({المتبقي}).
                {الخطوات}
                شاكرين لكم تعاونكم.
            """.trimIndent()
        ),
        MessageTemplate(
            id = "official",
            name = "طلب إفادة رسمي",
            hint = "صيغة إدارية للمخاطبات الرسمية",
            body = """
                السلام عليكم ورحمة الله وبركاته،
                
                إشارة إلى موضوع «{المهمة}»،
                {التفاصيل}
                
                نأمل من {الجهة} التكرم بإفادتنا بما يلزم في موعد أقصاه {التاريخ}.
                {الخطوات}
                
                وتفضلوا بقبول فائق الاحترام والتقدير.
            """.trimIndent()
        ),
        MessageTemplate(
            id = "meeting",
            name = "تأكيد موعد اجتماع",
            hint = "لتثبيت موعد متفق عليه",
            body = """
                السلام عليكم ورحمة الله،
                
                نفيدكم بتحديد موعد الاجتماع بخصوص «{المهمة}» يوم {التاريخ} الساعة {الوقت}.
                {التفاصيل}
                
                برجاء تأكيد الحضور.
            """.trimIndent()
        ),
        MessageTemplate(
            id = "done",
            name = "إشعار إنجاز",
            hint = "لإبلاغ الجهة بإتمام المطلوب",
            body = """
                السلام عليكم ورحمة الله،
                
                نفيدكم بإتمام المطلوب في موضوع «{المهمة}» بتاريخ {اليوم}.
                {التفاصيل}
                
                ونبقى على استعداد لأي استفسار.
            """.trimIndent()
        ),
        MessageTemplate(
            id = "extension",
            name = "طلب تمديد موعد",
            hint = "لطلب مهلة إضافية مع تبرير",
            body = """
                السلام عليكم ورحمة الله وبركاته،
                
                بالإشارة إلى «{المهمة}» والمحدد لها {التاريخ}،
                نأمل التكرم بالموافقة على تمديد الموعد نظراً لـ (اذكر السبب).
                {الخطوات}
                
                وتفضلوا بقبول فائق الاحترام.
            """.trimIndent()
        )
    )

    /** يعبّئ حقول النموذج من بيانات المهمة */
    fun render(
        template: MessageTemplate,
        task: Task,
        today: LocalDate = LocalDate.now()
    ): String {
        val openSteps = task.subTasks.filter { !it.done }
        val stepsText = if (openSteps.isEmpty()) "" else buildString {
            appendLine()
            appendLine("المطلوب تحديداً:")
            openSteps.forEach { appendLine("- ${it.title}") }
        }
        return template.body
            .replace("{المهمة}", task.title)
            .replace("{التفاصيل}", task.details)
            .replace("{الجهة}", task.owner.ifBlank { "حضرتكم" })
            .replace("{التاريخ}", com.almarar.mahami.core.Ar.fullDate(task.dueDate))
            .replace("{الوقت}", com.almarar.mahami.core.Ar.time(task.dueTime))
            .replace("{اليوم}", com.almarar.mahami.core.Ar.fullDate(today))
            .replace("{المتبقي}", com.almarar.mahami.core.Ar.relative(task.dueDate, today))
            .replace("{الخطوات}", stepsText)
            .lines()
            .joinToString("\n") { it.trimEnd() }
            .replace(Regex("\n{3,}"), "\n\n")
            .trim()
    }
}
