package com.almarar.mahami.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.almarar.mahami.data.TaskRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** يعيد جدولة التنبيهات بعد إعادة التشغيل أو تحديث التطبيق أو تغيير الوقت */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                NotificationHelper.createChannels(appContext)
                TaskRepository.get(appContext).refreshSideEffects()
                DailyDigestWorker.schedule(appContext)
            } finally {
                pending.finish()
            }
        }
    }
}
