package com.almarar.mahami.notify

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.widget.MahamiWidget
import kotlinx.coroutines.flow.first
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime

/** ملخص يومي للمهام مع تحديث الويدجت */
class DailyDigestWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = runCatching {
        val settings = Prefs.get(applicationContext).settings.first()
        val repo = Repository.get(applicationContext)
        val open = repo.allTasks().filter { it.status != TaskStatus.DONE }
        if (settings.notificationsEnabled && settings.dailyDigest) {
            NotificationHelper.notifyDigest(applicationContext, open)
        }
        MahamiWidget.refresh(applicationContext)
        Result.success()
    }.getOrElse { Result.retry() }

    companion object {
        private const val NAME = "mahami_daily_digest"

        fun schedule(context: Context, hour: Int = 8) {
            val now = LocalDateTime.now()
            var next = LocalDateTime.of(now.toLocalDate(), LocalTime.of(hour.coerceIn(0, 23), 0))
            if (!next.isAfter(now)) next = next.plusDays(1)

            val request = PeriodicWorkRequestBuilder<DailyDigestWorker>(Duration.ofDays(1))
                .setInitialDelay(Duration.between(now, next))
                .build()

            runCatching {
                WorkManager.getInstance(context)
                    .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
            }
        }
    }
}
