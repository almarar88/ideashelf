package ai.pacto.app.platform.deadline

import ai.pacto.app.PactoApplication
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Alarms do not survive a reboot, so they are rebuilt from the stored contract book. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val app = context.applicationContext as? PactoApplication ?: return
        val container = app.container
        container.deadlineScheduler.rescheduleAll(container.contractRepository.contracts.value)
    }
}
