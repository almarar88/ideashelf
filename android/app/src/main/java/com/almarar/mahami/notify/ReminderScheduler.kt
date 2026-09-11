package com.almarar.mahami.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

object ReminderScheduler {

    /** ساعة إرسال التنبيهات التي تسبق يوم التسليم */
    private val EARLY_HOUR = LocalTime.of(8, 0)

    private fun alarmManager(context: Context) =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun requestCode(taskId: Long, slot: Int): Int = (taskId * 100 + slot).toInt()

    private fun pendingIntent(context: Context, task: Task, slot: Int, headline: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ReminderReceiver.ACTION_REMIND
            putExtra(ReminderReceiver.EXTRA_TASK_ID, task.id)
            putExtra(ReminderReceiver.EXTRA_HEADLINE, headline)
            data = android.net.Uri.parse("mahami://task/${task.id}/$slot")
        }
        return PendingIntent.getBroadcast(
            context, requestCode(task.id, slot), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** يلغي تنبيهات مهمة واحدة */
    fun cancel(context: Context, taskId: Long) {
        val am = alarmManager(context)
        for (slot in 0..MAX_SLOTS) {
            val intent = Intent(context, ReminderReceiver::class.java).apply {
                action = ReminderReceiver.ACTION_REMIND
                data = android.net.Uri.parse("mahami://task/$taskId/$slot")
            }
            PendingIntent.getBroadcast(
                context, requestCode(taskId, slot), intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )?.let { am.cancel(it); it.cancel() }
        }
    }

    /** يعيد جدولة تنبيهات كل المهام */
    fun rescheduleAll(context: Context, tasks: List<Task>) {
        tasks.forEach { task ->
            cancel(context, task.id)
            if (task.remindersEnabled && task.status != TaskStatus.DONE) schedule(context, task)
        }
    }

    private fun schedule(context: Context, task: Task) {
        val now = LocalDateTime.now()
        val offsets = task.reminderOffsetsDays.distinct().sortedDescending()
        offsets.forEachIndexed { index, days ->
            val time = if (days == 0) task.dueTime else EARLY_HOUR
            val trigger = LocalDateTime.of(task.dueDate.minusDays(days.toLong()), time)
            if (trigger.isAfter(now)) {
                val headline = when {
                    days == 0 -> "اليوم موعد التسليم"
                    days == 1 -> "غداً موعد التسليم"
                    else -> "باقٍ $days أيام على التسليم"
                }
                setExact(context, trigger, pendingIntent(context, task, index, headline))
            }
        }
        // تنبيه متابعة بعد فوات الموعد
        val overdueAt = LocalDateTime.of(task.dueDate.plusDays(1), EARLY_HOUR)
        if (overdueAt.isAfter(now)) {
            setExact(
                context, overdueAt,
                pendingIntent(context, task, OVERDUE_SLOT, "تجاوزت الموعد النهائي")
            )
        }
    }

    fun scheduleSnooze(context: Context, task: Task, minutes: Long) {
        val trigger = LocalDateTime.now().plusMinutes(minutes)
        setExact(context, trigger, pendingIntent(context, task, SNOOZE_SLOT, "تذكير مؤجل"))
    }

    private fun setExact(context: Context, time: LocalDateTime, pi: PendingIntent) {
        val millis = time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val am = alarmManager(context)
        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.canScheduleExactAlarms()
        } else true
        try {
            if (canExact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, pi)
            }
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, pi)
        }
    }

    private const val OVERDUE_SLOT = 20
    private const val SNOOZE_SLOT = 21
    private const val MAX_SLOTS = 21
}
