package com.almarar.mahami.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.almarar.mahami.MainActivity
import com.almarar.mahami.R
import com.almarar.mahami.data.Task
import java.time.LocalDate
import java.time.format.DateTimeFormatter

object NotificationHelper {

    const val CHANNEL_TASKS = "mahami_tasks"
    const val CHANNEL_DIGEST = "mahami_digest"

    private val dateFmt: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_TASKS,
                "تنبيهات المهام",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "تنبيهات قبل المواعيد النهائية للمهام" }
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_DIGEST,
                "الملخص اليومي",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "ملخص مهام اليوم صباحاً" }
        )
    }

    private fun openAppIntent(context: Context, taskId: Long?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (taskId != null) putExtra(MainActivity.EXTRA_TASK_ID, taskId)
        }
        return PendingIntent.getActivity(
            context,
            (taskId ?: 0L).toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun actionIntent(context: Context, action: String, taskId: Long, code: Int): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            this.action = action
            putExtra(ReminderReceiver.EXTRA_TASK_ID, taskId)
        }
        return PendingIntent.getBroadcast(
            context, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun buildTaskNotification(context: Context, task: Task, headline: String): Notification {
        val body = buildString {
            append("الموعد النهائي: ${task.dueDate.format(dateFmt)}")
            if (task.details.isNotBlank()) append("\n${task.details}")
        }
        return NotificationCompat.Builder(context, CHANNEL_TASKS)
            .setSmallIcon(R.drawable.ic_stat_task)
            .setContentTitle("$headline — ${task.title}")
            .setContentText(task.details.ifBlank { "الموعد: ${task.dueDate.format(dateFmt)}" })
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(context, task.id))
            .addAction(
                0, "تم الإنجاز",
                actionIntent(context, ReminderReceiver.ACTION_DONE, task.id, (task.id * 10 + 1).toInt())
            )
            .addAction(
                0, "تأجيل ساعة",
                actionIntent(context, ReminderReceiver.ACTION_SNOOZE, task.id, (task.id * 10 + 2).toInt())
            )
            .build()
    }

    fun notifyTask(context: Context, task: Task, headline: String) {
        if (!hasPermission(context)) return
        NotificationManagerCompat.from(context)
            .notify(task.id.toInt(), buildTaskNotification(context, task, headline))
    }

    fun notifyDigest(context: Context, tasks: List<Task>) {
        if (!hasPermission(context)) return
        val today = LocalDate.now()
        val dueToday = tasks.filter { it.dueDate == today }
        val overdue = tasks.filter { it.isOverdue() }
        val title = when {
            dueToday.isEmpty() && overdue.isEmpty() -> "لا توجد مهام مستحقة اليوم"
            overdue.isNotEmpty() -> "لديك ${dueToday.size} مهمة اليوم و ${overdue.size} متأخرة"
            else -> "لديك ${dueToday.size} مهمة مستحقة اليوم"
        }
        val lines = (overdue.map { "متأخرة • ${it.title}" } + dueToday.map { "اليوم • ${it.title}" })
            .take(6)
        val style = NotificationCompat.InboxStyle().setBigContentTitle(title)
        lines.forEach { style.addLine(it) }

        val notification = NotificationCompat.Builder(context, CHANNEL_DIGEST)
            .setSmallIcon(R.drawable.ic_stat_task)
            .setContentTitle(title)
            .setContentText(lines.firstOrNull() ?: "صباح الخير")
            .setStyle(style)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(context, null))
            .build()

        NotificationManagerCompat.from(context).notify(DIGEST_ID, notification)
    }

    fun hasPermission(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else true

    private const val DIGEST_ID = 900_001
}
