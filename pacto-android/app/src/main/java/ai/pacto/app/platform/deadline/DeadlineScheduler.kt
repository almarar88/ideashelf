package ai.pacto.app.platform.deadline

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.DeadlineItem
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Trial periods, warranty windows and delivery dates all expire quietly unless something wakes
 * the phone up. Every scheduled alarm also records that the reminder was delivered, so "nobody
 * told me the warranty ended" is a checkable claim rather than an argument.
 */
class DeadlineScheduler(private val context: Context) {

    private val alarmManager: AlarmManager? =
        context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    fun schedule(contract: Contract, deadline: DeadlineItem) {
        val manager = alarmManager ?: return
        if (deadline.dueAt <= System.currentTimeMillis()) return
        val pending = pendingIntent(contract, deadline)

        // Warn a day ahead when the deadline is far enough out to make that useful.
        val triggerAt = if (deadline.dueAt - System.currentTimeMillis() > DAY_MS * 2) {
            deadline.dueAt - DAY_MS
        } else {
            deadline.dueAt
        }

        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            manager.canScheduleExactAlarms()
        } else {
            true
        }

        runCatching {
            if (canExact) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            } else {
                manager.setWindow(AlarmManager.RTC_WAKEUP, triggerAt, WINDOW_MS, pending)
            }
        }
    }

    fun cancel(contract: Contract, deadline: DeadlineItem) {
        alarmManager?.cancel(pendingIntent(contract, deadline))
    }

    fun rescheduleAll(contracts: List<Contract>) {
        contracts.forEach { contract ->
            contract.deadlines
                .filter { it.acknowledgedAt == null }
                .forEach { schedule(contract, it) }
        }
    }

    private fun pendingIntent(contract: Contract, deadline: DeadlineItem): PendingIntent {
        val intent = Intent(context, DeadlineReceiver::class.java).apply {
            action = "${ACTION_PREFIX}${deadline.id}"
            putExtra(DeadlineReceiver.EXTRA_CONTRACT_ID, contract.id)
            putExtra(DeadlineReceiver.EXTRA_CONTRACT_TITLE, contract.title)
            putExtra(DeadlineReceiver.EXTRA_DEADLINE_ID, deadline.id)
            putExtra(DeadlineReceiver.EXTRA_LABEL, deadline.label)
        }
        return PendingIntent.getBroadcast(
            context,
            deadline.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private companion object {
        const val ACTION_PREFIX = "ai.pacto.app.DEADLINE."
        const val DAY_MS = 24 * 60 * 60 * 1000L
        const val WINDOW_MS = 60 * 60 * 1000L
    }
}
