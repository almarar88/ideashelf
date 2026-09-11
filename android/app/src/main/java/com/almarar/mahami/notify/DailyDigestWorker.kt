package com.almarar.mahami.notify

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.widget.MahamiWidget
import kotlinx.coroutines.flow.first
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime

/** ملخص يومي للمهام + تحديث الويدجت */
class DailyDigestWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val settings = Prefs.get(applicationContext).settings.first()
        val repo = TaskRepository.get(applicationContext)
        val tasks = repo.all().filter { it.status != TaskStatus.DONE }
        if (settings.notificationsEnabled && settings.dailyDigest) {
            NotificationHelper.notifyDigest(applicationContext, tasks)
        }
        MahamiWidget.refresh(applicationContext)
        return Result.success()
    }

    companion object {
        private const val NAME = "mahami_daily_digest"

        fun schedule(context: Context, hour: Int = 8) {
            val now = LocalDateTime.now()
            var next = LocalDateTime.of(now.toLocalDate(), LocalTime.of(hour, 0))
            if (!next.isAfter(now)) next = next.plusDays(1)
            val delay = Duration.between(now, next)

            val request = PeriodicWorkRequestBuilder<DailyDigestWorker>(Duration.ofDays(1))
                .setInitialDelay(delay)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                NAME, ExistingPeriodicWorkPolicy.UPDATE, request
            )
        }
    }
}
