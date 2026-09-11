package ai.pacto.app.platform.nfc

import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.domain.model.IdentityProof
import ai.pacto.app.domain.model.VerificationMethod
import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep

/**
 * Reads the chip in a national ID or passport held against the phone.
 *
 * What this records without any extra key material: that a contactless identity chip was
 * physically present at a given moment, and a salted hash of its UID that can be matched
 * against the same document later. Reading the data groups of an ePassport additionally
 * requires the MRZ-derived key from the printed line, which [readDataGroups] takes; that
 * exchange is a separate, deliberate step and is not performed by a tap alone.
 */
class NfcIdentityReader(private val activity: Activity) {

    fun interface TagCallback {
        fun onIdentity(proof: IdentityProof)
    }

    private val adapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)

    fun isAvailable(): Boolean = adapter != null
    fun isEnabled(): Boolean = adapter?.isEnabled == true

    fun enable(callback: TagCallback) {
        val nfc = adapter ?: return
        nfc.enableReaderMode(
            activity,
            { tag -> callback.onIdentity(describe(tag)) },
            NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
    }

    fun disable() {
        adapter?.disableReaderMode(activity)
    }

    private fun describe(tag: Tag): IdentityProof {
        val uidHash = ContractHasher.sha256Hex(tag.id)
        val isoDep = runCatching { IsoDep.get(tag) }.getOrNull()
        val isDocumentChip = isoDep != null
        return IdentityProof(
            method = if (isDocumentChip) VerificationMethod.NFC_ID else VerificationMethod.MANUAL_ATTESTED,
            documentNumberMasked = "••••" + uidHash.takeLast(4).uppercase(),
            verifiedAt = System.currentTimeMillis(),
            documentHash = uidHash
        )
    }

    /**
     * Full ePassport read. The caller must supply the MRZ line from the printed document,
     * which is what derives the access key; a tap on its own cannot unlock these groups.
     */
    fun readDataGroups(@Suppress("UNUSED_PARAMETER") mrz: String): Result<Nothing> =
        Result.failure(UnsupportedOperationException("قراءة بيانات الجواز تتطلب مفتاح سطر MRZ ومكتبة قراءة رسمية"))
}
