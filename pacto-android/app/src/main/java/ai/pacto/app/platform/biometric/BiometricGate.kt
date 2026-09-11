package ai.pacto.app.platform.biometric

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.Signature

/**
 * The signing gate. The biometric check and the signature are a single operation: the prompt
 * carries the Keystore [Signature] object, so a signature can only exist if the person in front
 * of the phone authenticated for it.
 */
object BiometricGate {

    sealed interface Outcome {
        data class Signed(val signature: Signature?) : Outcome
        data class Failed(val message: String) : Outcome
        data object Unavailable : Outcome
    }

    private const val ALLOWED =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL

    fun isAvailable(activity: FragmentActivity): Boolean =
        BiometricManager.from(activity).canAuthenticate(ALLOWED) == BiometricManager.BIOMETRIC_SUCCESS

    fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        cryptoSignature: Signature?,
        onOutcome: (Outcome) -> Unit
    ) {
        if (!isAvailable(activity)) {
            onOutcome(Outcome.Unavailable)
            return
        }
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onOutcome(Outcome.Signed(result.cryptoObject?.signature ?: cryptoSignature))
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onOutcome(Outcome.Failed(errString.toString()))
                }

                override fun onAuthenticationFailed() {
                    // A single non-matching finger is not a final answer; the prompt stays open.
                }
            }
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(ALLOWED)
            .build()

        if (cryptoSignature != null) {
            runCatching {
                prompt.authenticate(info, BiometricPrompt.CryptoObject(cryptoSignature))
            }.onFailure { onOutcome(Outcome.Failed(it.message ?: "تعذر بدء التحقق")) }
        } else {
            prompt.authenticate(info)
        }
    }
}
