package com.almarar.mahami

import android.app.Application
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Repository
import com.almarar.mahami.notify.DailyDigestWorker
import com.almarar.mahami.notify.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MahamiApplication : Application() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannels(this)
        scope.launch {
            Repository.get(this@MahamiApplication).initializeIfNeeded()
            val hour = Prefs.get(this@MahamiApplication).settings.first().digestHour
            DailyDigestWorker.schedule(this@MahamiApplication, hour)
        }
    }
}
