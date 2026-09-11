package ai.pacto.app

import ai.pacto.app.ui.navigation.PactoApp
import ai.pacto.app.ui.navigation.Routes
import ai.pacto.app.ui.theme.PactoTheme
import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Single activity host. It also accepts text shared from any chat app, and text selected
 * anywhere on the device through the system PROCESS_TEXT action, dropping it straight into
 * capture.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            var incoming by mutableStateOf(readSharedText(intent))
            var route by mutableStateOf(readRoute(intent))
            PactoTheme {
                PactoApp(initialRoute = route, sharedText = incoming)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recreate()
    }

    private fun readSharedText(intent: Intent?): String? = when (intent?.action) {
        Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
        Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
        else -> null
    }

    private fun readRoute(intent: Intent?): String? = when {
        intent?.getBooleanExtra(EXTRA_OPEN_CAPTURE, false) == true -> Routes.CAPTURE
        intent?.getStringExtra(EXTRA_CONTRACT_ID) != null ->
            Routes.detail(intent.getStringExtra(EXTRA_CONTRACT_ID)!!)

        else -> null
    }

    companion object {
        const val EXTRA_OPEN_CAPTURE = "open_capture"
        const val EXTRA_CONTRACT_ID = "contract_id"
    }
}
