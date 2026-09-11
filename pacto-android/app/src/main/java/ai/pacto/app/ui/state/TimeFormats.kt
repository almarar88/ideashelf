package ai.pacto.app.ui.state

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object TimeFormats {

    private val arabic = Locale("ar")
    private val hourFormat = SimpleDateFormat("h a", arabic)
    private val dateFormat = SimpleDateFormat("d MMMM", arabic)
    private val fullFormat = SimpleDateFormat("yyyy/MM/dd HH:mm", arabic)
    private val weekdayFormat = SimpleDateFormat("EEE", arabic)

    /** "8 - 10 ص" style window used on the obligation cards. */
    fun timeRange(millis: Long, windowHours: Int = 2): String {
        val start = hourFormat.format(Date(millis))
        val end = hourFormat.format(Date(millis + windowHours * 60 * 60 * 1000L))
        return "$start - $end"
    }

    fun time(millis: Long): String = hourFormat.format(Date(millis))
    fun date(millis: Long): String = dateFormat.format(Date(millis))
    fun full(millis: Long): String = fullFormat.format(Date(millis))
    fun weekday(millis: Long): String = weekdayFormat.format(Date(millis))

    fun dayNumber(millis: Long): Int = Calendar.getInstance().apply { timeInMillis = millis }
        .get(Calendar.DAY_OF_MONTH)

    fun relativeDays(millis: Long, now: Long = System.currentTimeMillis()): String {
        val days = ((millis - now) / (24 * 60 * 60 * 1000L)).toInt()
        return when {
            days > 1 -> "بعد $days يوم"
            days == 1 -> "غداً"
            days == 0 -> "اليوم"
            days == -1 -> "أمس"
            else -> "متأخر ${-days} يوم"
        }
    }
}
