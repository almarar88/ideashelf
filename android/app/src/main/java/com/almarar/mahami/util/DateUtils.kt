package com.almarar.mahami.util

import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.temporal.ChronoUnit

object Ar {

    val weekdaysShort = listOf("اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد")
    val weekdaysFull = listOf(
        "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"
    )
    val months = listOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    )

    /** اسم اليوم بالعربية */
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

    /** التاريخ الهجري التقريبي (تقويم أم القرى عبر ICU) */
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

    /** وصف قريب: اليوم / غداً / بعد 3 أيام / متأخرة بيومين */
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
        in 0..11 -> "صباح الخير"
        in 12..16 -> "طاب يومك"
        else -> "مساء الخير"
    }

    private fun pad(n: Int) = n.toString().padStart(2, '0')
}

object CalendarUtils {
    /** شبكة الشهر بادئة من السبت (الأسبوع العربي) */
    fun monthGrid(month: YearMonth): List<LocalDate?> {
        val first = month.atDay(1)
        // ترتيب الأعمدة: السبت، الأحد، الاثنين ... الجمعة
        val shift = (first.dayOfWeek.value + 1) % 7 // السبت = 0
        val lead = List(shift) { null as LocalDate? }
        val days = (1..month.lengthOfMonth()).map { month.atDay(it) as LocalDate? }
        val cells = lead + days
        val tail = List((7 - cells.size % 7) % 7) { null as LocalDate? }
        return cells + tail
    }

    val weekHeaders = listOf("سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة")

    /** أيام الأسبوع الحالي بدءاً من السبت */
    fun weekOf(date: LocalDate): List<LocalDate> {
        val shift = (date.dayOfWeek.value + 1) % 7
        val start = date.minusDays(shift.toLong())
        return (0..6).map { start.plusDays(it.toLong()) }
    }
}
