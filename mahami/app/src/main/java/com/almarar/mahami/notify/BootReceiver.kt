package com.almarar.mahami.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Repository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** يعيد جدولة التنبيهات بعد إعادة التشغيل أو تحديث التطبيق أو تغيير الوقت */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                NotificationHelper.createChannels(appContext)
                Repository.get(appContext).refresh()
                val settings = Prefs.get(appContext).settings.first()
                DailyDigestWorker.schedule(appContext, settings.digestHour)
            } finally {
                pending.finish()
            }
        }
    }
}
