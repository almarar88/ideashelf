package ai.pacto.app.platform.vision

import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.domain.model.EvidenceItem
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.GeoPoint
import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

/**
 * Visual audit of the thing being agreed over. Each photo is written to app-private storage
 * and hashed immediately, so the stamp covers the exact bytes that were captured; replacing
 * the file later changes the hash and breaks the contract digest.
 */
class AssetCapture(private val context: Context) {

    data class PendingCapture(val file: File, val uri: Uri, val kind: EvidenceKind)

    fun newCapture(kind: EvidenceKind): PendingCapture {
        val dir = File(context.filesDir, "evidence").apply { mkdirs() }
        val file = File(dir, "ev_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return PendingCapture(file, uri, kind)
    }

    /** Turns a completed camera capture into a hashed, timestamped evidence item. */
    fun seal(
        pending: PendingCapture,
        note: String,
        capturedByPartyId: String?,
        milestoneId: String? = null,
        serial: String? = null,
        geo: GeoPoint? = null,
        now: Long = System.currentTimeMillis()
    ): EvidenceItem? {
        if (!pending.file.exists() || pending.file.length() == 0L) return null
        val hash = ContractHasher.sha256Hex(pending.file.readBytes())
        return EvidenceItem(
            id = UUID.randomUUID().toString(),
            kind = pending.kind,
            capturedAt = now,
            note = note,
            filePath = pending.file.absolutePath,
            contentHash = hash,
            serial = serial,
            geo = geo,
            capturedByPartyId = capturedByPartyId,
            milestoneId = milestoneId
        )
    }

    /** Re-hashes a stored file to prove it has not been swapped since capture. */
    fun verify(item: EvidenceItem): Boolean {
        val path = item.filePath ?: return false
        val file = File(path)
        if (!file.exists()) return false
        return ContractHasher.sha256Hex(file.readBytes()) == item.contentHash
    }
}
