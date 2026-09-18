package com.almarar.mahami

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.ui.MahamiApp
import com.almarar.mahami.ui.StartDestination
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private var unlocked by mutableStateOf(true)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermissionIfNeeded()

        setContent { MahamiApp(start = resolveStart(intent)) }

        lifecycleScope.launch {
            if (Prefs.get(this@MainActivity).settings.first().appLock) {
                unlocked = false
                promptUnlock()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        setContent { MahamiApp(start = resolveStart(intent)) }
    }

    private fun resolveStart(intent: Intent?): StartDestination {
        val taskId = intent?.getLongExtra(EXTRA_TASK_ID, -1L) ?: -1L
        if (taskId > 0) return StartDestination.TaskDetail(taskId)
        return when (intent?.getStringExtra(EXTRA_DESTINATION)) {
            "new_task" -> StartDestination.NewTask
            "today" -> StartDestination.Today
            "calendar" -> StartDestination.Calendar
            else -> StartDestination.None
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** قفل التطبيق ببصمة الجهاز أو رمز القفل */
    private fun promptUnlock() {
        val manager = BiometricManager.from(this)
        val allowed = BiometricManager.Authenticators.BIOMETRIC_WEAK or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (manager.canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS) {
            unlocked = true
            return
        }

        val prompt = BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    unlocked = true
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    finish()
                }
            }
        )

        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("فتح مهامي")
                .setSubtitle("استخدم بصمتك أو رمز قفل الجهاز")
                .setAllowedAuthenticators(allowed)
                .build()
        )
    }

    companion object {
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_DESTINATION = "destination"
    }
}
