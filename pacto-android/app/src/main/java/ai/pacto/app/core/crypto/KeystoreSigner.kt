package ai.pacto.app.core.crypto

import ai.pacto.app.domain.model.KeySecurityLevel
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * Signing keys live inside the device secure processor. The private key is never readable by
 * this process, and on devices with a StrongBox it never leaves the dedicated security chip,
 * which is what makes a signature here different from a picture of a signature.
 */
class KeystoreSigner {

    data class PreparedSignature(
        val signature: Signature,
        val alias: String,
        val securityLevel: KeySecurityLevel,
        val requiresUserAuthentication: Boolean
    )

    data class SignedPayload(
        val signatureBase64: String,
        val publicKeyBase64: String,
        val alias: String,
        val securityLevel: KeySecurityLevel
    )

    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    }

    fun aliasForParty(partyId: String): String = "$KEY_PREFIX$partyId"

    /**
     * Creates the party key if it is missing. [requireUserAuthentication] binds every single
     * use of the key to a fresh biometric or device-credential check.
     */
    fun ensureKey(alias: String, requireUserAuthentication: Boolean): KeySecurityLevel {
        if (!keyStore.containsAlias(alias)) {
            try {
                generate(alias, requireUserAuthentication, strongBox = true)
            } catch (_: StrongBoxUnavailableException) {
                generate(alias, requireUserAuthentication, strongBox = false)
            } catch (_: Exception) {
                generate(alias, requireUserAuthentication, strongBox = false)
            }
        }
        return securityLevelOf(alias)
    }

    private fun generate(alias: String, requireUserAuthentication: Boolean, strongBox: Boolean) {
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)

        if (requireUserAuthentication) {
            builder.setUserAuthenticationRequired(true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setUserAuthenticationParameters(
                    0,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
            } else {
                @Suppress("DEPRECATION")
                builder.setUserAuthenticationValidityDurationSeconds(-1)
            }
        }
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
        }

        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        generator.initialize(builder.build())
        generator.generateKeyPair()
    }

    fun securityLevelOf(alias: String): KeySecurityLevel {
        return try {
            val key = keyStore.getKey(alias, null) as? PrivateKey ?: return KeySecurityLevel.SOFTWARE
            val factory = KeyFactory.getInstance(key.algorithm, ANDROID_KEYSTORE)
            val info = factory.getKeySpec(key, KeyInfo::class.java)
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
                    when (info.securityLevel) {
                        KeyProperties.SECURITY_LEVEL_STRONGBOX -> KeySecurityLevel.STRONGBOX
                        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> KeySecurityLevel.TEE
                        else -> KeySecurityLevel.SOFTWARE
                    }

                @Suppress("DEPRECATION")
                info.isInsideSecureHardware -> KeySecurityLevel.TEE

                else -> KeySecurityLevel.SOFTWARE
            }
        } catch (_: Exception) {
            KeySecurityLevel.SOFTWARE
        }
    }

    /**
     * Returns a [Signature] already initialised with the party key. Hand it to BiometricPrompt
     * inside a CryptoObject so the unlock and the signature are the same operation.
     */
    fun prepare(partyId: String, requireUserAuthentication: Boolean): PreparedSignature {
        val alias = aliasForParty(partyId)
        val level = ensureKey(alias, requireUserAuthentication)
        val privateKey = keyStore.getKey(alias, null) as PrivateKey
        val signature = Signature.getInstance(SIGNATURE_ALGORITHM).apply { initSign(privateKey) }
        return PreparedSignature(signature, alias, level, requireUserAuthentication)
    }

    fun finish(prepared: PreparedSignature, payload: ByteArray): SignedPayload {
        prepared.signature.update(payload)
        val signed = prepared.signature.sign()
        val certificate = keyStore.getCertificate(prepared.alias)
        val publicKey = certificate?.publicKey?.encoded ?: ByteArray(0)
        return SignedPayload(
            signatureBase64 = Base64.encodeToString(signed, Base64.NO_WRAP),
            publicKeyBase64 = Base64.encodeToString(publicKey, Base64.NO_WRAP),
            alias = prepared.alias,
            securityLevel = prepared.securityLevel
        )
    }

    fun verify(publicKeyBase64: String, payload: ByteArray, signatureBase64: String): Boolean = try {
        val keyBytes = Base64.decode(publicKeyBase64, Base64.NO_WRAP)
        val spec = java.security.spec.X509EncodedKeySpec(keyBytes)
        val publicKey = KeyFactory.getInstance("EC").generatePublic(spec)
        Signature.getInstance(SIGNATURE_ALGORITHM).run {
            initVerify(publicKey)
            update(payload)
            verify(Base64.decode(signatureBase64, Base64.NO_WRAP))
        }
    } catch (_: Exception) {
        false
    }

    fun deleteKey(alias: String) {
        runCatching { keyStore.deleteEntry(alias) }
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_PREFIX = "pacto_party_"
        const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
    }
}
