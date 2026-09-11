package com.almarar.mahami.ai

import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.util.Ar
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit

/**
 * محرك محلي يعمل دون إنترنت: يستخرج المهام والتواريخ من النص العربي،
 * ويبني خطة اليوم، ويكشف المخاطر والتعارضات، ويقترح خطوات.
 * يُستخدم كبديل عندما لا يتوفر مفتاح Claude، وكطبقة تحقق عند توفره.
 */
object Heuristics {

    private val weekdayNames = mapOf(
        "الأحد" to DayOfWeek.SUNDAY, "الاحد" to DayOfWeek.SUNDAY,
        "الاثنين" to DayOfWeek.MONDAY, "الإثنين" to DayOfWeek.MONDAY,
        "الثلاثاء" to DayOfWeek.TUESDAY,
        "الأربعاء" to DayOfWeek.WEDNESDAY, "الاربعاء" to DayOfWeek.WEDNESDAY,
        "الخميس" to DayOfWeek.THURSDAY,
        "الجمعة" to DayOfWeek.FRIDAY,
        "السبت" to DayOfWeek.SATURDAY
    )

    private val monthNames = mapOf(
        "يناير" to 1, "فبراير" to 2, "مارس" to 3, "أبريل" to 4, "ابريل" to 4,
        "مايو" to 5, "يونيو" to 6, "يوليو" to 7, "أغسطس" to 8, "اغسطس" to 8,
        "سبتمبر" to 9, "أكتوبر" to 10, "اكتوبر" to 10, "نوفمبر" to 11, "ديسمبر" to 12
    )

    private val highPriorityHints = listOf("عاجل", "عاجلة", "فوري", "فورية", "ضروري", "مستعجل", "أولوية عالية", "هام جداً")
    private val lowPriorityHints = listOf("عند التفرغ", "غير عاجل", "أولوية منخفضة", "لاحقاً", "متى ما تيسر")

    private val numberWords = mapOf(
        "يوم" to 1L, "يومين" to 2L, "ثلاثة" to 3L, "ثلاث" to 3L, "أربعة" to 4L, "أربع" to 4L,
        "خمسة" to 5L, "خمس" to 5L, "ستة" to 6L, "ست" to 6L, "سبعة" to 7L, "سبع" to 7L,
        "عشرة" to 10L, "عشر" to 10L, "أسبوع" to 7L, "أسبوعين" to 14L, "شهر" to 30L
    )

    /** يحوّل الأرقام العربية الهندية إلى لاتينية */
    fun normalizeDigits(text: String): String {
        val sb = StringBuilder()
        for (ch in text) {
            sb.append(
                when (ch) {
                    in '٠'..'٩' -> ('0' + (ch - '٠'))
                    in '۰'..'۹' -> ('0' + (ch - '۰'))
                    else -> ch
                }
            )
        }
        return sb.toString()
    }

    /** يستخرج تاريخاً من نص عربي، ويعيد null إن لم يجد */
    fun parseDate(rawText: String, today: LocalDate = LocalDate.now()): LocalDate? {
        val text = normalizeDigits(rawText)

        // 16-09-2026 أو 16/09/2026
        Regex("""(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})""").find(text)?.let { m ->
            val (d, mo, y) = m.destructured
            runCatching { return LocalDate.of(y.toInt(), mo.toInt(), d.toInt()) }
        }
        // 2026-09-16
        Regex("""(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})""").find(text)?.let { m ->
            val (y, mo, d) = m.destructured
            runCatching { return LocalDate.of(y.toInt(), mo.toInt(), d.toInt()) }
        }
        // 16 سبتمبر 2026 أو 16 سبتمبر
        for ((name, month) in monthNames) {
            Regex("""(\d{1,2})\s+$name(?:\s+(\d{4}))?""").find(text)?.let { m ->
                val day = m.groupValues[1].toInt()
                val year = m.groupValues.getOrNull(2)?.takeIf { it.isNotBlank() }?.toInt() ?: today.year
                runCatching {
                    val candidate = LocalDate.of(year, month, day)
                    return if (m.groupValues[2].isBlank() && candidate.isBefore(today))
                        candidate.plusYears(1) else candidate
                }
            }
        }

        // كلمات نسبية
        when {
            text.contains("بعد غد") -> return today.plusDays(2)
            Regex("""\bغدا\b|غداً""").containsMatchIn(text) -> return today.plusDays(1)
            text.contains("اليوم") -> return today
            text.contains("نهاية الأسبوع") || text.contains("نهاية الاسبوع") ->
                return nextWeekday(today, DayOfWeek.THURSDAY)
            text.contains("نهاية الشهر") -> return today.withDayOfMonth(today.lengthOfMonth())
            text.contains("بداية الشهر القادم") || text.contains("بداية الشهر المقبل") ->
                return today.plusMonths(1).withDayOfMonth(1)
        }

        // بعد ٣ أيام / خلال أسبوع
        Regex("""(?:بعد|خلال)\s+(\d{1,3})\s*(يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر)""")
            .find(text)?.let { m ->
                val n = m.groupValues[1].toLong()
                return when {
                    m.groupValues[2].startsWith("أسب") || m.groupValues[2].startsWith("اسب") -> today.plusWeeks(n)
                    m.groupValues[2].startsWith("شه") || m.groupValues[2].startsWith("أشه") ||
                        m.groupValues[2].startsWith("اشه") -> today.plusMonths(n)
                    else -> today.plusDays(n)
                }
            }
        Regex("""(?:بعد|خلال)\s+(يومين|أسبوعين|اسبوعين|أسبوع|اسبوع|شهر|يوم)""").find(text)?.let { m ->
            numberWords[m.groupValues[1]]?.let { return today.plusDays(it) }
        }

        // الأربعاء القادم / يوم الاثنين
        for ((name, dow) in weekdayNames) {
            if (text.contains(name)) {
                val afterName = text.substringAfter(name, "").take(12)
                val explicitNext = afterName.contains("القادم") || afterName.contains("المقبل") ||
                    afterName.contains("القادمة") || afterName.contains("المقبلة")
                return nextWeekday(today, dow, includeToday = !explicitNext)
            }
        }
        return null
    }

    private fun nextWeekday(from: LocalDate, target: DayOfWeek, includeToday: Boolean = false): LocalDate {
        var d = if (includeToday) from else from.plusDays(1)
        while (d.dayOfWeek != target) d = d.plusDays(1)
        return d
    }

    /** يستخرج وقتاً مثل «الساعة 2 مساءً» */
    fun parseTime(rawText: String): LocalTime? {
        val text = normalizeDigits(rawText)
        val m = Regex("""(?:الساعة|عند)\s*(\d{1,2})(?::(\d{2}))?\s*(صباح|ص|مساء|م)?""").find(text) ?: return null
        var hour = m.groupValues[1].toIntOrNull() ?: return null
        val minute = m.groupValues[2].toIntOrNull() ?: 0
        val marker = m.groupValues[3]
        if (marker.startsWith("م") && hour < 12) hour += 12
        if (marker.startsWith("ص") && hour == 12) hour = 0
        if (hour !in 0..23 || minute !in 0..59) return null
        return LocalTime.of(hour, minute)
    }

    fun parsePriority(text: String): Priority = when {
        highPriorityHints.any { text.contains(it) } -> Priority.HIGH
        lowPriorityHints.any { text.contains(it) } -> Priority.LOW
        else -> Priority.MEDIUM
    }

    /** يستخرج اسم شخص مسبوق بلقب مثل «أ. منى الكندي» */
    fun parseOwner(text: String): String {
        val m = Regex(
            """(?:(?<=\s)|^)(?:(?:أ|د|م)\s*\.\s*|(?:الأستاذة?|الدكتورة?|المهندسة?)\s+)""" +
                """([ء-ي]{3,}(?:\s[ء-ي]{3,}){0,2})"""
        ).find(text) ?: return ""
        val name = m.groupValues[1].trim()
        val stop = listOf("لحصر", "بشأن", "على", "إلى", "مع", "من", "في", "عن")
        val words = name.split(" ").takeWhile { it !in stop }
        return if (words.isEmpty()) "" else "أ. " + words.joinToString(" ")
    }

    /**
     * يقسّم نصاً (رسالة، محضر اجتماع، قائمة) إلى مهام مرشّحة.
     * يتعرف على الترقيم والنقاط والأسطر المستقلة.
     */
    fun extractTasks(rawText: String, today: LocalDate = LocalDate.now()): List<ExtractedTask> {
        val text = normalizeDigits(rawText).trim()
        if (text.isBlank()) return emptyList()

        val blocks = splitBlocks(text)
        val tasks = blocks.mapNotNull { block -> blockToTask(block, today) }
        return if (tasks.isEmpty()) listOfNotNull(blockToTask(text, today)) else tasks
    }

    private fun splitBlocks(text: String): List<String> {
        val lines = text.lines()
        val blocks = mutableListOf<StringBuilder>()
        val markerRegex = Regex("""^\s*(?:\*\*)?(?:\d{1,2}[).\-]|[-•*–—]|المهمة\s*\d*)\s*""")
        lines.forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isBlank()) {
                if (blocks.isNotEmpty() && blocks.last().isNotBlank()) blocks.add(StringBuilder())
                return@forEach
            }
            val isNew = markerRegex.containsMatchIn(trimmed)
            if (isNew || blocks.isEmpty()) {
                blocks.add(StringBuilder(trimmed.replace(markerRegex, "")))
            } else {
                blocks.last().append("\n").append(trimmed)
            }
        }
        return blocks.map { it.toString().trim() }.filter { it.length >= 6 }
    }

    private fun blockToTask(block: String, today: LocalDate): ExtractedTask? {
        val clean = block.replace("**", "").replace("##", "").trim()
        if (clean.length < 6) return null

        val firstLine = clean.lines().first().trim()
        val date = parseDate(clean, today)
        val title = cleanTitle(firstLine)
        if (title.isBlank()) return null

        val details = clean.lines().drop(1).joinToString("\n").trim()
        val steps = clean.lines().drop(1)
            .map { it.trim().removePrefix("-").removePrefix("•").trim() }
            .filter { it.length in 6..120 }
            .take(6)

        return ExtractedTask(
            title = title.take(90),
            details = details,
            dueDate = date ?: today.plusDays(1),
            dueTime = parseTime(clean) ?: LocalTime.of(9, 0),
            priority = parsePriority(clean),
            owner = parseOwner(clean),
            steps = steps,
            dateWasExplicit = date != null,
            confidence = if (date != null) 0.85f else 0.5f
        )
    }

    private fun cleanTitle(line: String): String {
        var t = line.replace("**", "").trim()
        t = t.removePrefix("المطلوب:").removePrefix("الموعد:").trim()
        t = t.substringBefore(" — ").substringBefore(" - ").trim()
        t = t.replace(Regex("""^\s*(?:\d{1,2}[).\-])\s*"""), "")
        // قص التاريخ من نهاية العنوان إن وُجد
        t = t.replace(Regex("""\s*\(?\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{4}\)?\s*$"""), "")
        return t.trim().trimEnd('.', '،', ':')
    }

    /** خطة اليوم: ترتيب المهام حسب ضغط الموعد والأولوية والاعتماد على الآخرين */
    fun dailyPlan(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<PlanItem> {
        val open = tasks.filter { it.status != TaskStatus.DONE }
        if (open.isEmpty()) return emptyList()

        val scored = open.map { task ->
            val days = ChronoUnit.DAYS.between(today, task.dueDate)
            var score = when {
                days < 0 -> 100.0
                days == 0L -> 90.0
                days == 1L -> 70.0
                days <= 3 -> 50.0
                else -> 30.0 - days.coerceAtMost(20)
            }
            score += when (task.priority) {
                Priority.HIGH -> 12.0
                Priority.MEDIUM -> 5.0
                Priority.LOW -> 0.0
            }
            // المهام المعتمدة على رد الآخرين تُبدأ مبكراً
            if (task.owner.isNotBlank()) score += 8.0
            if (task.flexibleDeadline) score += 6.0
            score += task.progress * 4.0
            task to score
        }.sortedByDescending { it.second }

        val slots = listOf("الفترة الصباحية الأولى", "قبل الظهر", "بعد الظهر", "نهاية اليوم")
        return scored.take(6).mapIndexed { index, (task, _) ->
            val days = ChronoUnit.DAYS.between(today, task.dueDate)
            PlanItem(
                taskId = task.id,
                title = task.title,
                slot = slots.getOrElse(index) { "وقت إضافي" },
                reason = when {
                    days < 0 -> "تجاوزت الموعد بـ ${-days} يوم — ابدأ بها"
                    days == 0L -> "تسليمها اليوم"
                    task.owner.isNotBlank() -> "تعتمد على رد ${task.owner} — بادر مبكراً"
                    task.flexibleDeadline -> "موعد مرن، وتأخيرها يضيّع الأسبوع"
                    else -> "${Ar.relative(task.dueDate, today)} — وزّع العمل عليها"
                }
            )
        }
    }

    /** كشف المخاطر: ازدحام يوم، تأخّر، مواعيد مرنة، اعتماد على الغير */
    fun risks(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<RiskNote> {
        val notes = mutableListOf<RiskNote>()
        val open = tasks.filter { it.status != TaskStatus.DONE }

        open.groupBy { it.dueDate }
            .filter { it.value.size >= 2 }
            .toSortedMap()
            .forEach { (date, list) ->
                notes.add(
                    RiskNote(
                        title = "ازدحام يوم ${Ar.dayName(date)}",
                        body = "${list.size} تسليمات في ${Ar.fullDate(date)}: " +
                            list.joinToString("، ") { it.title } +
                            ". ابدأ ما يعتمد على ردود الآخرين قبله بيومين على الأقل.",
                        level = if (list.size >= 3) RiskLevel.HIGH else RiskLevel.MEDIUM,
                        taskIds = list.map { it.id }
                    )
                )
            }

        val late = open.filter { it.dueDate.isBefore(today) }
        if (late.isNotEmpty()) {
            notes.add(
                RiskNote(
                    title = "مهام تجاوزت موعدها",
                    body = late.joinToString("، ") { "${it.title} (${Ar.relative(it.dueDate, today)})" } +
                        ". أعد جدولتها أو أبلغ الجهة المعنية اليوم.",
                    level = RiskLevel.HIGH,
                    taskIds = late.map { it.id }
                )
            )
        }

        open.filter { it.flexibleDeadline }.forEach { task ->
            notes.add(
                RiskNote(
                    title = "موعد غير محدد: ${task.title}",
                    body = "الموعد مرن وخارج سيطرتك جزئياً. ثبّت التاريخ باتصال مبكر" +
                        (if (task.owner.isNotBlank()) " مع ${task.owner}" else "") + ".",
                    level = RiskLevel.MEDIUM,
                    taskIds = listOf(task.id)
                )
            )
        }

        open.filter { it.warning.isNotBlank() }.forEach { task ->
            notes.add(
                RiskNote(
                    title = "تحقق من بيانات: ${task.title}",
                    body = task.warning,
                    level = RiskLevel.MEDIUM,
                    taskIds = listOf(task.id)
                )
            )
        }

        val untouched = open.filter { it.progress == 0f && ChronoUnit.DAYS.between(today, it.dueDate) in 0..2 }
        if (untouched.isNotEmpty()) {
            notes.add(
                RiskNote(
                    title = "لم تبدأ رغم قرب الموعد",
                    body = untouched.joinToString("، ") { it.title } + ". خصّص لها أول ساعة من اليوم.",
                    level = RiskLevel.HIGH,
                    taskIds = untouched.map { it.id }
                )
            )
        }

        return notes.sortedBy { it.level.ordinal }
    }

    /** خطوات مقترحة محلياً حسب طبيعة المهمة */
    fun suggestSteps(title: String, details: String = ""): List<String> {
        val text = "$title $details"
        val base = mutableListOf<String>()
        when {
            text.contains("اجتماع") || text.contains("تنسيق") -> base += listOf(
                "تحديد المشاركين والجهة المعنية",
                "الاتصال هاتفياً لتثبيت الموعد",
                "إرسال دعوة وجدول أعمال",
                "تدوين المخرجات بعد الاجتماع"
            )
            text.contains("خطة") || text.contains("مقترح") -> base += listOf(
                "جمع المعطيات والمراجع المطلوبة",
                "إعداد المسودة الأولى",
                "مراجعتها داخلياً",
                "عرضها على الجهة المعتمِدة",
                "تعديلها حسب الملاحظات"
            )
            text.contains("حصر") || text.contains("ملفات") || text.contains("وثائق") -> base += listOf(
                "إعداد قائمة بالمطلوب حصره",
                "مخاطبة الجهات أو الأشخاص المعنيين",
                "متابعة الردود واستكمال الناقص",
                "حفظ الملفات في مكانها المعتمد",
                "وضع آلية تحديث دورية"
            )
            text.contains("تقرير") -> base += listOf(
                "تجميع البيانات",
                "صياغة التقرير",
                "المراجعة اللغوية والرقمية",
                "الإرسال والأرشفة"
            )
            else -> base += listOf(
                "تحديد المطلوب بدقة",
                "جمع ما يلزم من معلومات",
                "التنفيذ",
                "المراجعة والتسليم"
            )
        }
        return base
    }

    /** مسودة رسالة متابعة */
    fun draftMessage(task: Task, formal: Boolean = true): String {
        val greeting = if (formal) "السلام عليكم ورحمة الله وبركاته،" else "السلام عليكم،"
        val target = task.owner.ifBlank { "حضرتكم" }
        return buildString {
            appendLine(greeting)
            appendLine()
            appendLine("إشارة إلى موضوع «${task.title}»،")
            if (task.details.isNotBlank()) appendLine(task.details)
            appendLine()
            appendLine("نأمل من $target التكرم بإفادتنا بما يلزم قبل ${Ar.fullDate(task.dueDate)}.")
            if (task.subTasks.any { !it.done }) {
                appendLine()
                appendLine("المطلوب تحديداً:")
                task.subTasks.filter { !it.done }.forEach { appendLine("- ${it.title}") }
            }
            appendLine()
            appendLine("وتفضلوا بقبول فائق الاحترام والتقدير.")
        }.trim()
    }

    /** ملخص أسبوعي نصي */
    fun weeklySummary(tasks: List<Task>, today: LocalDate = LocalDate.now()): String {
        val done = tasks.filter { it.status == TaskStatus.DONE }
        val late = tasks.filter { it.isOverdue() }
        val week = tasks.filter { ChronoUnit.DAYS.between(today, it.dueDate) in 0..6 && it.status != TaskStatus.DONE }
        return buildString {
            appendLine("ملخص الأسبوع — ${Ar.fullDate(today)}")
            appendLine()
            appendLine("• المنجز: ${done.size} مهمة")
            appendLine("• المستحق خلال 7 أيام: ${week.size} مهمة")
            appendLine("• المتأخر: ${late.size} مهمة")
            if (week.isNotEmpty()) {
                appendLine()
                appendLine("التسليمات القادمة:")
                week.sortedBy { it.dueDate }.forEach {
                    appendLine("- ${Ar.fullDate(it.dueDate)}: ${it.title}")
                }
            }
            val heaviest = week.groupBy { it.dueDate }.maxByOrNull { it.value.size }
            if (heaviest != null && heaviest.value.size >= 2) {
                appendLine()
                appendLine("انتبه: ${Ar.dayName(heaviest.key)} يحمل ${heaviest.value.size} تسليمات.")
            }
        }.trim()
    }
}
