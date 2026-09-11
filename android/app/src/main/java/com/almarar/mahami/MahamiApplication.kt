package com.almarar.mahami

import android.app.Application
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.notify.DailyDigestWorker
import com.almarar.mahami.notify.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MahamiApplication : Application() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannels(this)
        scope.launch {
            TaskRepository.get(this@MahamiApplication).seedIfEmpty()
            DailyDigestWorker.schedule(this@MahamiApplication)
        }
    }
}
