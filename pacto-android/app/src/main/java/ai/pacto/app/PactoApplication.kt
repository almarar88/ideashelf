package ai.pacto.app

import ai.pacto.app.platform.deadline.PactoNotifications
import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class PactoApplication : Application() {

    lateinit var container: PactoContainer
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        container = PactoContainer(this)
        PactoNotifications.ensureChannels(this)
        scope.launch { container.warmUp() }
    }
}
