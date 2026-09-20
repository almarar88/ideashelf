package com.almarar.mahami.core

import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/** تنسيق التواريخ والنصوص بالعربية */
object Ar {

    val weekdaysFull = listOf(
        "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"
    )
    private val weekdaysShort = listOf("اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد")

    val months = listOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    )

    fun dayName(date: LocalDate): String = weekdaysFull[date.dayOfWeek.value - 1]

    fun dayShort(date: LocalDate): String = weekdaysShort[date.dayOfWeek.value - 1]

    fun monthName(month: Int): String = months[month - 1]

    /** 16 سبتمبر 2026 */
    fun longDate(date: LocalDate): String =
        "${date.dayOfMonth} ${monthName(date.monthValue)} ${date.year}"

    /** الأربعاء 16-09-2026 */
    fun fullDate(date: LocalDate): String =
        "${dayName(date)} ${pad(date.dayOfMonth)}-${pad(date.monthValue)}-${date.year}"

    fun shortDate(date: LocalDate): String = "${pad(date.dayOfMonth)}-${pad(date.monthValue)}"

    fun time(t: LocalTime): String {
        val h = if (t.hour % 12 == 0) 12 else t.hour % 12
        val suffix = if (t.hour < 12) "صباحاً" else "مساءً"
        return "$h:${pad(t.minute)} $suffix"
    }

    /** التاريخ الهجري عبر تقويم النظام */
    fun hijri(date: LocalDate): String = runCatching {
        val cal = android.icu.util.IslamicCalendar()
        cal.set(date.year, date.monthValue - 1, date.dayOfMonth)
        val hijriMonths = listOf(
            "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
            "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
        )
        val d = cal.get(android.icu.util.Calendar.DATE)
        val m = cal.get(android.icu.util.Calendar.MONTH)
        val y = cal.get(android.icu.util.Calendar.YEAR)
        "$d ${hijriMonths[m]} $y هـ"
    }.getOrDefault("")

    /** اليوم / غداً / بعد 3 أيام / متأخرة بيومين */
    fun relative(date: LocalDate, today: LocalDate = LocalDate.now()): String {
        val days = ChronoUnit.DAYS.between(today, date)
        return when {
            days == 0L -> "اليوم"
            days == 1L -> "غداً"
            days == 2L -> "بعد يومين"
            days in 3..10 -> "بعد $days أيام"
            days > 10 -> "بعد $days يوماً"
            days == -1L -> "متأخرة يوماً"
            days == -2L -> "متأخرة يومين"
            days >= -10 -> "متأخرة ${-days} أيام"
            else -> "متأخرة ${-days} يوماً"
        }
    }

    fun greeting(hour: Int = LocalTime.now().hour): String = when (hour) {
        in 0..4 -> "ليلة هادئة"
        in 5..11 -> "صباح الخير"
        in 12..16 -> "طاب يومك"
        in 17..21 -> "مساء الخير"
        else -> "مساء الخير"
    }

    /** صيغة العدد العربية: مهمة / مهمتان / 3 مهام */
    fun countTasks(n: Int): String = when (n) {
        0 -> "لا مهام"
        1 -> "مهمة واحدة"
        2 -> "مهمتان"
        in 3..10 -> "$n مهام"
        else -> "$n مهمة"
    }

    /** اسم «مهمة» مطابقاً للعدد حين يُعرض الرقم منفصلاً عنه */
    fun taskWord(n: Int): String = if (n in 2..10) "مهام" else "مهمة"

    fun countDays(n: Long): String = when (n) {
        0L -> "اليوم"
        1L -> "يوم واحد"
        2L -> "يومان"
        in 3..10 -> "$n أيام"
        else -> "$n يوماً"
    }

    /** مدة بالدقائق بصيغة عربية مختصرة: 45 د، ساعة ونصف، ساعتان */
    fun duration(minutes: Int): String {
        if (minutes <= 0) return "غير محدّد"
        if (minutes < 60) return "$minutes د"
        val hours = minutes / 60
        val rest = minutes % 60
        val hoursText = when (hours) {
            1 -> "ساعة"
            2 -> "ساعتان"
            in 3..10 -> "$hours ساعات"
            else -> "$hours ساعة"
        }
        return when (rest) {
            0 -> hoursText
            30 -> "$hoursText ونصف"
            15 -> "$hoursText وربع"
            45 -> "$hoursText وثلاثة أرباع"
            else -> "$hoursText و$rest د"
        }
    }

    private fun pad(n: Int) = n.toString().padStart(2, '0')
}

/** أدوات شبكة التقويم — الأسبوع العربي يبدأ من السبت */
object CalendarUtils {

    val weekHeaders = listOf("سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة")

    /** خانات الشهر مع فراغات البداية والنهاية */
    fun monthGrid(month: YearMonth): List<LocalDate?> {
        val first = month.atDay(1)
        val shift = (first.dayOfWeek.value + 1) % 7 // السبت = 0
        val lead = List(shift) { null as LocalDate? }
        val days = (1..month.lengthOfMonth()).map { month.atDay(it) as LocalDate? }
        val cells = lead + days
        val tail = List((7 - cells.size % 7) % 7) { null as LocalDate? }
        return cells + tail
    }

    /** أيام الأسبوع الذي يقع فيه التاريخ، بدءاً من السبت */
    fun weekOf(date: LocalDate): List<LocalDate> {
        val shift = (date.dayOfWeek.value + 1) % 7
        val start = date.minusDays(shift.toLong())
        return (0..6).map { start.plusDays(it.toLong()) }
    }

    /** الأيام السبعة القادمة بدءاً من اليوم */
    fun nextSevenDays(today: LocalDate = LocalDate.now()): List<LocalDate> =
        (0..6).map { today.plusDays(it.toLong()) }
}
