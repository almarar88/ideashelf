package ai.pacto.app.platform.deadline

import ai.pacto.app.PactoApplication
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DeadlineReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val contractId = intent.getStringExtra(EXTRA_CONTRACT_ID) ?: return
        val deadlineId = intent.getStringExtra(EXTRA_DEADLINE_ID) ?: return
        val title = intent.getStringExtra(EXTRA_CONTRACT_TITLE).orEmpty()
        val label = intent.getStringExtra(EXTRA_LABEL).orEmpty()

        PactoNotifications.ensureChannels(context)
        PactoNotifications.post(
            context,
            deadlineId.hashCode(),
            PactoNotifications.deadlineNotification(context, contractId, title, label)
        )

        val app = context.applicationContext as? PactoApplication ?: return
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val now = System.currentTimeMillis()
                app.container.contractRepository.mutate(contractId) { contract ->
                    contract.copy(
                        deadlines = contract.deadlines.map {
                            if (it.id == deadlineId && it.notifiedAt == null) it.copy(notifiedAt = now) else it
                        }
                    )
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val EXTRA_CONTRACT_ID = "contract_id"
        const val EXTRA_CONTRACT_TITLE = "contract_title"
        const val EXTRA_DEADLINE_ID = "deadline_id"
        const val EXTRA_LABEL = "label"
    }
}
