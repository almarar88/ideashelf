package com.almarar.mahami.smart

import com.almarar.mahami.data.Priority
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime

/** نتيجة تحليل سطر نصي إلى مهمة */
data class ParsedTask(
    val title: String,
    val dueDate: LocalDate,
    val dueTime: LocalTime? = null,
    val priority: Priority = Priority.MEDIUM,
    val tags: List<String> = emptyList(),
    val projectName: String? = null,
    val owner: String = "",
    val estimateMinutes: Int = 0,
    val important: Boolean = false,
    /** ما التقطه المحلّل فعلاً — يُعرض للمستخدم قبل الحفظ */
    val matches: List<ParsedChip> = emptyList()
) {
    val dateWasExplicit: Boolean get() = matches.any { it.kind == ChipKind.DATE }
}

enum class ChipKind { DATE, TIME, PRIORITY, TAG, PROJECT, OWNER, ESTIMATE }

/** قطعة معلومة استخرجها المحلّل من النص */
data class ParsedChip(val kind: ChipKind, val label: String)

/**
 * محلّل عربي يحوّل سطراً واحداً إلى مهمة كاملة، دون إنترنت ودون ذكاء اصطناعي.
 *
 * مثال: «تسليم التقرير الأربعاء القادم الساعة 10 عاجل #تقارير @العمل (45د)»
 * ينتج: عنوان «تسليم التقرير»، تاريخ الأربعاء القادم، وقت 10:00،
 * أولوية عالية، وسم «تقارير»، مشروع «العمل»، وتقدير 45 دقيقة.
 */
object SmartParser {

    private val weekdays = mapOf(
        "السبت" to DayOfWeek.SATURDAY,
        "الأحد" to DayOfWeek.SUNDAY, "الاحد" to DayOfWeek.SUNDAY,
        "الاثنين" to DayOfWeek.MONDAY, "الإثنين" to DayOfWeek.MONDAY, "الإتنين" to DayOfWeek.MONDAY,
        "الثلاثاء" to DayOfWeek.TUESDAY,
        "الأربعاء" to DayOfWeek.WEDNESDAY, "الاربعاء" to DayOfWeek.WEDNESDAY,
        "الخميس" to DayOfWeek.THURSDAY,
        "الجمعة" to DayOfWeek.FRIDAY
    )

    private val months = mapOf(
        "يناير" to 1, "كانون الثاني" to 1,
        "فبراير" to 2, "شباط" to 2,
        "مارس" to 3, "آذار" to 3,
        "أبريل" to 4, "ابريل" to 4, "نيسان" to 4,
        "مايو" to 5, "أيار" to 5,
        "يونيو" to 6, "حزيران" to 6,
        "يوليو" to 7, "تموز" to 7,
        "أغسطس" to 8, "اغسطس" to 8, "آب" to 8,
        "سبتمبر" to 9, "أيلول" to 9,
        "أكتوبر" to 10, "اكتوبر" to 10, "تشرين الأول" to 10,
        "نوفمبر" to 11, "تشرين الثاني" to 11,
        "ديسمبر" to 12, "كانون الأول" to 12
    )

    private val highWords = listOf("عاجل", "عاجلة", "مستعجل", "فوري", "فورية", "ضروري", "هام جدا", "هام جداً")
    private val importantWords = listOf("مهم", "مهمة جدا", "استراتيجي", "أساسي", "اساسي")
    private val lowWords = listOf("لاحقا", "لاحقاً", "عند التفرغ", "غير عاجل", "متى ما تيسر", "وقت الفراغ")

    /** يحوّل الأرقام العربية الهندية إلى لاتينية */
    fun normalizeDigits(text: String): String = buildString {
        text.forEach { ch ->
            append(
                when (ch) {
                    in '٠'..'٩' -> '0' + (ch - '٠')
                    in '۰'..'۹' -> '0' + (ch - '۰')
                    else -> ch
                }
            )
        }
    }

    /** يحلّل سطراً واحداً */
    fun parse(raw: String, today: LocalDate = LocalDate.now()): ParsedTask? {
        val normalized = normalizeDigits(raw).trim()
        if (normalized.length < 2) return null

        var working = normalized
        val chips = mutableListOf<ParsedChip>()

        // الوسوم #وسم
        val tags = mutableListOf<String>()
        Regex("""#([^\s#@]+)""").findAll(working).forEach { match ->
            tags += match.groupValues[1]
            chips += ParsedChip(ChipKind.TAG, match.groupValues[1])
        }
        working = working.replace(Regex("""#[^\s#@]+"""), " ")

        // المشروع @مشروع
        var project: String? = null
        Regex("""@([^\s#@]+)""").find(working)?.let { match ->
            project = match.groupValues[1]
            chips += ParsedChip(ChipKind.PROJECT, match.groupValues[1])
            working = working.replace(match.value, " ")
        }

        // التقدير (45د) أو (ساعة) أو «يستغرق 30 دقيقة»
        val estimate = parseEstimate(working)
        if (estimate.first > 0) {
            chips += ParsedChip(ChipKind.ESTIMATE, "${estimate.first} دقيقة")
            working = working.replace(estimate.second, " ")
        }

        // الوقت
        val time = parseTime(working)
        if (time != null) {
            chips += ParsedChip(ChipKind.TIME, formatTime(time.first))
            working = working.replace(time.second, " ")
        }

        // التاريخ
        val date = parseDate(working, today)
        if (date != null) {
            chips += ParsedChip(ChipKind.DATE, describeDate(date.first, today))
            working = working.replace(date.second, " ")
        }

        // جهة المتابعة: «مع أ. منى» أو «من إدارة الجودة»
        val owner = parseOwner(working)
        if (owner.first.isNotBlank()) {
            chips += ParsedChip(ChipKind.OWNER, owner.first)
            working = working.replace(owner.second, " ")
        }

        // الأولوية
        val priority = when {
            highWords.any { normalized.contains(it) } -> Priority.HIGH
            lowWords.any { normalized.contains(it) } -> Priority.LOW
            else -> Priority.MEDIUM
        }
        if (priority != Priority.MEDIUM) {
            chips += ParsedChip(ChipKind.PRIORITY, priority.label)
            (highWords + lowWords).forEach { working = working.replace(it, " ") }
        }
        val important = importantWords.any { normalized.contains(it) } || priority == Priority.HIGH
        importantWords.forEach { working = working.replace(it, " ") }

        val title = cleanTitle(working)
        if (title.isBlank()) return null

        return ParsedTask(
            title = title,
            dueDate = date?.first ?: today,
            dueTime = time?.first,
            priority = priority,
            tags = tags,
            projectName = project,
            owner = owner.first,
            estimateMinutes = estimate.first,
            important = important,
            matches = chips
        )
    }

    /**
     * يقسّم جملة منطوقة واحدة إلى عدة مهام.
     *
     * نقسّم على روابط صريحة فقط («ثم»، «وبعدها»، «وأيضاً»…) ولا نقسّم على واو
     * العطف وحدها: «متابعة الجهة والرد على الخطاب» مهمة واحدة لا اثنتان.
     */
    fun splitUtterance(raw: String): List<String> {
        val separators = Regex(
            """\s+(?:""" +
                """ثم|بعدها|وبعدها|وبعدين|بعدين|""" +
                """وأيضا[ًٍ]?|وايضا[ًٍ]?|أيضا[ًٍ]?\s+|وكمان|""" +
                """وثاني[ااً]?|والمهمة\s+(?:الثانية|الثالثة|الرابعة|التالية)|""" +
                """ومهمة\s+(?:ثانية|أخرى|اخرى|جديدة)""" +
            """)\s+"""
        )
        return normalizeDigits(raw)
            .split(separators)
            .map { it.trim().trim('،', ',', '.', '-', '—') .trim() }
            .filter { it.length >= 3 }
    }

    /** يحلّل ما قيل صوتاً إلى مهمة واحدة أو أكثر */
    fun parseSpoken(raw: String, today: LocalDate = LocalDate.now()): List<ParsedTask> =
        splitUtterance(raw).mapNotNull { parse(it, today) }

    /** يحلّل نصاً متعدد الأسطر إلى عدة مهام */
    fun parseMany(raw: String, today: LocalDate = LocalDate.now()): List<ParsedTask> {
        val marker = Regex("""^\s*(?:\d{1,2}[).\-]|[-•*–—]|\*\*)\s*""")
        return normalizeDigits(raw)
            .lines()
            .map { it.trim().replace(marker, "").replace("**", "").trim() }
            .filter { it.length >= 4 }
            .mapNotNull { parse(it, today) }
    }

    // ---------- التاريخ ----------

    /** يعيد التاريخ والنص الذي طابقه */
    fun parseDate(text: String, today: LocalDate = LocalDate.now()): Pair<LocalDate, String>? {
        Regex("""(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})""").find(text)?.let { m ->
            val (d, mo, y) = m.destructured
            runCatching { return LocalDate.of(y.toInt(), mo.toInt(), d.toInt()) to m.value }
        }
        Regex("""(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})""").find(text)?.let { m ->
            val (y, mo, d) = m.destructured
            runCatching { return LocalDate.of(y.toInt(), mo.toInt(), d.toInt()) to m.value }
        }
        Regex("""(\d{1,2})\s*/\s*(\d{1,2})(?!\s*[/\d])""").find(text)?.let { m ->
            val day = m.groupValues[1].toInt()
            val month = m.groupValues[2].toInt()
            runCatching {
                val candidate = LocalDate.of(today.year, month, day)
                return (if (candidate.isBefore(today)) candidate.plusYears(1) else candidate) to m.value
            }
        }
        for ((name, month) in months) {
            Regex("""(\d{1,2})\s+$name(?:\s+(\d{4}))?""").find(text)?.let { m ->
                val day = m.groupValues[1].toInt()
                val year = m.groupValues.getOrNull(2)?.takeIf { it.isNotBlank() }?.toInt()
                runCatching {
                    val candidate = LocalDate.of(year ?: today.year, month, day)
                    val adjusted = if (year == null && candidate.isBefore(today)) {
                        candidate.plusYears(1)
                    } else candidate
                    return adjusted to m.value
                }
            }
        }

        Regex("""بعد\s+غد""").find(text)?.let { return today.plusDays(2) to it.value }
        Regex("""غدا[ًٍ]?|بكرة""").find(text)?.let { return today.plusDays(1) to it.value }
        Regex("""اليوم""").find(text)?.let { return today to it.value }
        Regex("""نهاية\s+الأسبوع|نهاية\s+الاسبوع""").find(text)?.let {
            return nextWeekday(today, DayOfWeek.THURSDAY) to it.value
        }
        Regex("""نهاية\s+الشهر""").find(text)?.let {
            return today.withDayOfMonth(today.lengthOfMonth()) to it.value
        }
        Regex("""(?:بداية|أول|اول)\s+الشهر\s+(?:القادم|المقبل)""").find(text)?.let {
            return today.plusMonths(1).withDayOfMonth(1) to it.value
        }
        Regex("""الأسبوع\s+(?:القادم|المقبل)|الاسبوع\s+(?:القادم|المقبل)""").find(text)?.let {
            return today.plusWeeks(1) to it.value
        }
        Regex("""(?:بعد|خلال)\s+(\d{1,3})\s*(يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر|شهور)""")
            .find(text)?.let { m ->
                val n = m.groupValues[1].toLong()
                val unit = m.groupValues[2]
                // «أسبوع» و«أسابيع» يختلفان في الحرف الثالث، فنطابق الجذر لا البادئة
                val weekRoots = listOf("أسبوع", "اسبوع", "أسابيع", "اسابيع")
                val monthRoots = listOf("شهر", "أشهر", "اشهر", "شهور")
                val result = when (unit) {
                    in weekRoots -> today.plusWeeks(n)
                    in monthRoots -> today.plusMonths(n)
                    else -> today.plusDays(n)
                }
                return result to m.value
            }
        Regex("""(?:بعد|خلال)\s+(يومين|أسبوعين|اسبوعين|أسبوع|اسبوع|شهر|شهرين|يوم)""").find(text)?.let { m ->
            val days = when (m.groupValues[1]) {
                "يوم" -> 1L
                "يومين" -> 2L
                "أسبوع", "اسبوع" -> 7L
                "أسبوعين", "اسبوعين" -> 14L
                "شهر" -> 30L
                "شهرين" -> 60L
                else -> 1L
            }
            return today.plusDays(days) to m.value
        }

        for ((name, dow) in weekdays) {
            Regex("""(?:يوم\s+)?$name(\s+(?:القادم|المقبل|القادمة|المقبلة))?""").find(text)?.let { m ->
                val explicitNext = m.groupValues[1].isNotBlank()
                return nextWeekday(today, dow, includeToday = !explicitNext) to m.value
            }
        }
        return null
    }

    private fun nextWeekday(from: LocalDate, target: DayOfWeek, includeToday: Boolean = false): LocalDate {
        var day = if (includeToday) from else from.plusDays(1)
        while (day.dayOfWeek != target) day = day.plusDays(1)
        return day
    }

    // ---------- الوقت ----------

    fun parseTime(text: String): Pair<LocalTime, String>? {
        Regex("""(?:الساعة\s*)?(\d{1,2}):(\d{2})\s*(صباح[اً]?|ص|مساء[ًٍ]?|م)?""").find(text)?.let { m ->
            var hour = m.groupValues[1].toIntOrNull() ?: return@let
            val minute = m.groupValues[2].toIntOrNull() ?: 0
            val marker = m.groupValues[3]
            if (marker.startsWith("م") && hour < 12) hour += 12
            if (marker.startsWith("ص") && hour == 12) hour = 0
            if (hour in 0..23 && minute in 0..59) return LocalTime.of(hour, minute) to m.value
        }
        Regex("""الساعة\s*(\d{1,2})\s*(صباح[اً]?|ص|مساء[ًٍ]?|م)?""").find(text)?.let { m ->
            var hour = m.groupValues[1].toIntOrNull() ?: return@let
            val marker = m.groupValues[2]
            if (marker.startsWith("م") && hour < 12) hour += 12
            if (marker.startsWith("ص") && hour == 12) hour = 0
            if (hour in 0..23) return LocalTime.of(hour, 0) to m.value
        }
        return null
    }

    // ---------- التقدير ----------

    private fun parseEstimate(text: String): Pair<Int, String> {
        Regex("""\(\s*(\d{1,3})\s*(?:د|دق|دقيقة|دقائق)\s*\)""").find(text)?.let {
            return (it.groupValues[1].toIntOrNull() ?: 0) to it.value
        }
        Regex("""\(\s*(?:ساعة|ساعه)\s*\)""").find(text)?.let { return 60 to it.value }
        Regex("""\(\s*(?:ساعتين|ساعتان)\s*\)""").find(text)?.let { return 120 to it.value }
        Regex("""(?:يستغرق|مدتها|تستغرق)\s+(\d{1,3})\s*(?:دقيقة|دقائق|د)""").find(text)?.let {
            return (it.groupValues[1].toIntOrNull() ?: 0) to it.value
        }
        Regex("""(?:يستغرق|مدتها|تستغرق)\s+(\d{1,2})\s*(?:ساعة|ساعات|س)""").find(text)?.let {
            return ((it.groupValues[1].toIntOrNull() ?: 0) * 60) to it.value
        }
        return 0 to ""
    }

    // ---------- جهة المتابعة ----------

    private fun parseOwner(text: String): Pair<String, String> {
        Regex("""(?:مع|من|إلى|الى)\s+((?:أ|د|م)\s*\.\s*[ء-ي]{3,}(?:\s[ء-ي]{3,}){0,2})""")
            .find(text)?.let { m ->
                return cleanOwner(m.groupValues[1]) to m.value
            }
        Regex("""(?:مع|من|إلى|الى)\s+((?:إدارة|ادارة|قسم|مكتب|شركة|جهة)\s+[ء-ي]{3,}(?:\s[ء-ي]{3,}){0,2})""")
            .find(text)?.let { m ->
                return m.groupValues[1].trim() to m.value
            }
        return "" to ""
    }

    private fun cleanOwner(raw: String): String {
        val normalized = raw.replace(Regex("""\s+"""), " ").trim()
        val stop = listOf("بشأن", "على", "في", "عن", "حول", "لأجل")
        val parts = normalized.split(" ")
        val title = parts.first().replace(".", "").trim()
        val name = parts.drop(1).takeWhile { it !in stop }
        return if (name.isEmpty()) normalized else "$title. ${name.joinToString(" ")}"
    }

    // ---------- العنوان ----------

    private fun cleanTitle(raw: String): String {
        var title = raw
            .replace(Regex("""\s+"""), " ")
            .replace(Regex("""^(?:مطلوب|يجب|لازم|تذكير|تذكيري|ذكرني|أضف|اضف)\s+"""), "")
            .replace(Regex("""^(?:أن|ان|ب)\s+"""), "")
            .trim()
        title = title.trim(' ', '-', '—', '–', '،', ',', ':', '.', '(', ')')
        return title.take(120).trim()
    }

    // ---------- عرض ----------

    private fun describeDate(date: LocalDate, today: LocalDate): String = when (date) {
        today -> "اليوم"
        today.plusDays(1) -> "غداً"
        else -> com.almarar.mahami.core.Ar.fullDate(date)
    }

    private fun formatTime(time: LocalTime): String = com.almarar.mahami.core.Ar.time(time)
}
