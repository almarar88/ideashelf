package com.almarar.mahami.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.almarar.mahami.data.TaskRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getLongExtra(EXTRA_TASK_ID, -1L)
        if (taskId <= 0) return
        val headline = intent.getStringExtra(EXTRA_HEADLINE) ?: "تذكير بمهمة"
        val appContext = context.applicationContext
        val pending = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repo = TaskRepository.get(appContext)
                when (intent.action) {
                    ACTION_DONE -> {
                        repo.markDoneById(taskId)
                        NotificationManagerCompat.from(appContext).cancel(taskId.toInt())
                    }
                    ACTION_SNOOZE -> {
                        repo.snooze(taskId, 60)
                        NotificationManagerCompat.from(appContext).cancel(taskId.toInt())
                    }
                    else -> {
                        val task = repo.all().firstOrNull { it.id == taskId } ?: return@launch
                        if (task.status != com.almarar.mahami.data.TaskStatus.DONE) {
                            NotificationHelper.notifyTask(appContext, task, headline)
                        }
                    }
                }
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_REMIND = "com.almarar.mahami.REMIND"
        const val ACTION_DONE = "com.almarar.mahami.DONE"
        const val ACTION_SNOOZE = "com.almarar.mahami.SNOOZE"
        const val EXTRA_TASK_ID = "task_id"
        const val EXTRA_HEADLINE = "headline"
    }
}
