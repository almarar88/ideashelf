package ai.pacto.app.platform.export

import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.MilestoneStatus
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Produces the file a court, a police station or a lawyer can actually read: the clauses as
 * signed, the money trail, every piece of evidence with its hash and timestamp, and the
 * contract digest that proves none of it was edited afterwards.
 */
class CourtFileExporter(private val context: Context) {

    private val dateFormat = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale("ar"))

    fun export(contract: Contract): File {
        val document = PdfDocument()
        val writer = PageWriter(document)

        writer.heading("ملف عقد رقمي - تطبيق عَقْد")
        writer.body("رقم العقد: ${contract.id}")
        writer.body("العنوان: ${contract.title}")
        writer.body("تاريخ الإنشاء: ${dateFormat.format(Date(contract.createdAt))}")
        writer.body("الحالة: ${statusLabel(contract)}")
        writer.body("القيمة الإجمالية: ${contract.total.format()}")
        writer.space()

        writer.heading("الأطراف")
        contract.parties.forEach { party ->
            val verified = if (party.identity.isVerified) "موثق (${party.identity.method})" else "غير موثق"
            writer.body("• ${party.displayName} - ${party.role} - $verified")
            party.identity.documentHash?.let { writer.small("بصمة وثيقة الهوية: ${it.take(32)}…") }
        }
        writer.space()

        writer.heading("البنود المتفق عليها")
        contract.terms.forEachIndexed { index, term ->
            writer.body("${index + 1}. [${term.kind}] ${term.text}")
        }
        writer.space()

        if (contract.milestones.isNotEmpty()) {
            writer.heading("المراحل والدفعات")
            contract.milestones.forEach { milestone ->
                val delivered = milestone.deliveredAt?.let { dateFormat.format(Date(it)) } ?: "لم يُسلَّم"
                writer.body("• ${milestone.title} - ${milestone.amount.format()} - استحقاق ${dateFormat.format(Date(milestone.dueAt))} - تسليم $delivered - ${milestone.status}")
            }
            writer.space()
        }

        writer.heading("حركة الأموال في الضمان")
        writer.body("المجمّد حالياً: ${contract.escrow.held.format()}")
        writer.body("المُفرج عنه: ${contract.escrow.released.format()} | المسترجع: ${contract.escrow.refunded.format()} | العمولة: ${contract.escrow.feesCharged.format()}")
        contract.escrow.ledger.forEach { entry ->
            writer.small("${dateFormat.format(Date(entry.at))} - ${entry.type} - ${entry.amount.format()} - ${entry.note}")
        }
        writer.space()

        if (contract.evidence.isNotEmpty()) {
            writer.heading("الأدلة الموثقة")
            contract.evidence.forEach { item ->
                writer.body("• ${item.kind} - ${dateFormat.format(Date(item.capturedAt))} - ${item.note}")
                item.serial?.let { writer.small("الرقم التسلسلي: $it") }
                item.contentHash?.let { writer.small("بصمة الملف: $it") }
                item.geo?.let { writer.small("الإحداثيات: ${it.latitude}, ${it.longitude}") }
            }
            writer.space()
        }

        if (contract.addenda.isNotEmpty()) {
            writer.heading("الملاحق")
            contract.addenda.forEach { addendum ->
                writer.body("• ${dateFormat.format(Date(addendum.createdAt))} - ${addendum.transcript}")
                addendum.amountDelta?.let { writer.small("تعديل القيمة: ${it.format()}") }
            }
            writer.space()
        }

        if (contract.signatures.isNotEmpty()) {
            writer.heading("التواقيع")
            contract.signatures.forEach { signature ->
                val party = contract.party(signature.partyId)?.displayName ?: signature.partyId
                writer.body("• $party - ${dateFormat.format(Date(signature.signedAt))} - ${signature.securityLevel}")
                writer.small("التوقيع: ${signature.signatureBase64.take(48)}…")
            }
            writer.space()
        }

        contract.dispute?.let { dispute ->
            writer.heading("النزاع")
            writer.body("فتح بتاريخ ${dateFormat.format(Date(dispute.openedAt))} من ${contract.party(dispute.openedByPartyId)?.displayName ?: dispute.openedByPartyId}")
            writer.body(dispute.claim)
            dispute.report?.let { report ->
                writer.body("اقتراح التسوية: ${report.providerAmount.format()} للمنفذ و${report.clientAmount.format()} للطرف الطالب")
                report.findings.forEach { writer.small("- ${it.clause}: ${it.explanation}") }
                report.unresolvedPoints.forEach { writer.small("نقطة غير محسومة: $it") }
            }
            writer.space()
        }

        val digest = contract.sealedHash ?: ContractHasher.hash(contract)
        writer.heading("إثبات عدم التعديل")
        writer.body("بصمة العقد (SHA-256): $digest")
        writer.small("البصمة المختصرة: ${ContractHasher.fingerprint(digest)}")
        writer.small("تاريخ التصدير: ${dateFormat.format(Date())}")

        writer.finish()

        val dir = File(context.filesDir, "exports").apply { mkdirs() }
        val file = File(dir, "pacto_${contract.id}_${System.currentTimeMillis()}.pdf")
        file.outputStream().use { document.writeTo(it) }
        document.close()
        return file
    }

    fun shareIntent(file: File): Intent {
        val uri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return Intent(Intent.ACTION_SEND).apply {
            type = if (file.extension == "pdf") "application/pdf" else "text/plain"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun statusLabel(contract: Contract): String =
        "${contract.status} (${contract.milestones.count { it.status == MilestoneStatus.RELEASED }}/${contract.milestones.size} دفعات مصروفة)"

    /** Lays text out down the page and starts a new one when the margin is reached. */
    private class PageWriter(private val document: PdfDocument) {

        private val pageWidth = 595
        private val pageHeight = 842
        private val margin = 40f
        private val contentWidth = (pageWidth - margin * 2).toInt()

        private var page: PdfDocument.Page? = null
        private var cursorY = margin
        private var pageNumber = 0

        private val headingPaint = TextPaint().apply {
            isAntiAlias = true
            color = Color.parseColor("#2A2E22")
            textSize = 15f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        private val bodyPaint = TextPaint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 11.5f
        }
        private val smallPaint = TextPaint().apply {
            isAntiAlias = true
            color = Color.parseColor("#4A4A4A")
            textSize = 9.5f
        }

        private fun ensurePage() {
            if (page == null) {
                pageNumber += 1
                page = document.startPage(
                    PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                )
                cursorY = margin
            }
        }

        private fun write(text: String, paint: TextPaint, gap: Float) {
            ensurePage()
            val layout = StaticLayout.Builder
                .obtain(text, 0, text.length, paint, contentWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setIncludePad(false)
                .build()

            if (cursorY + layout.height > pageHeight - margin) {
                document.finishPage(page)
                page = null
                ensurePage()
            }

            val canvas = page!!.canvas
            canvas.save()
            canvas.translate(margin, cursorY)
            layout.draw(canvas)
            canvas.restore()
            cursorY += layout.height + gap
        }

        fun heading(text: String) = write(text, headingPaint, 6f)
        fun body(text: String) = write(text, bodyPaint, 3f)
        fun small(text: String) = write(text, smallPaint, 2f)
        fun space() {
            cursorY += 10f
        }

        fun finish() {
            page?.let { document.finishPage(it) }
            page = null
        }
    }
}
