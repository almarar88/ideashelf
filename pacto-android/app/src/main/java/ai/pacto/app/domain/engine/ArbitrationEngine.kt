package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.ArbitrationFinding
import ai.pacto.app.domain.model.ArbitrationReport
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.TermKind
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * A neutral first pass over a dispute. It reads only what the contract says and what the two
 * sides actually recorded: delivery dates against deadlines, before/after evidence, logged
 * defects, approved expenses. It proposes a split of the frozen balance and states plainly
 * what it could not decide. It is a settlement proposal, not a ruling.
 */
object ArbitrationEngine {

    private const val DAY_MS = 24 * 60 * 60 * 1000L

    fun arbitrate(contract: Contract, now: Long): ArbitrationReport {
        val currency = contract.escrow.currency
        val held = contract.escrow.held
        val findings = mutableListOf<ArbitrationFinding>()
        val unresolved = mutableListOf<String>()

        val totalWeight = contract.milestones.sumOf { it.weight }
        val deliveredWeight = contract.milestones
            .filter { it.status == MilestoneStatus.DELIVERED || it.status == MilestoneStatus.RELEASED }
            .sumOf { it.weight }
        var share = if (totalWeight == 0) 0.5f else deliveredWeight.toFloat() / totalWeight.toFloat()

        findings += ArbitrationFinding(
            clause = "نسبة الإنجاز",
            evidenceIds = emptyList(),
            leaning = (share - 0.5f) * 2f,
            explanation = if (totalWeight == 0) {
                "لا توجد مراحل موثقة، فتُقسّم نقطة البداية مناصفة."
            } else {
                "تم تسليم $deliveredWeight من أصل $totalWeight من أوزان العمل."
            }
        )

        // Late delivery against the agreed deadline.
        val lateMilestones = contract.milestones.filter {
            val delivered = it.deliveredAt
            delivered != null && delivered > it.dueAt
        }
        if (lateMilestones.isNotEmpty()) {
            val totalLateDays = lateMilestones.sumOf { m ->
                ((m.deliveredAt!! - m.dueAt) / DAY_MS).coerceAtLeast(1L)
            }
            val penaltyTerm = contract.terms.firstOrNull { it.kind == TermKind.PENALTY }
            val deduction = min(0.30f, 0.03f * totalLateDays)
            share -= deduction
            findings += ArbitrationFinding(
                clause = penaltyTerm?.text ?: "التأخير عن الموعد المتفق عليه",
                evidenceIds = emptyList(),
                leaning = -deduction * 2f,
                explanation = "تأخير إجمالي $totalLateDays يوماً عن المواعيد المتفق عليها" +
                    if (penaltyTerm == null) "، وبغياب شرط جزائي مكتوب طُبّق خصم تناسبي." else "، وطُبّق الشرط الجزائي."
            )
            if (penaltyTerm == null) {
                unresolved += "لا يوجد شرط جزائي مكتوب، وقيمة الخصم عن التأخير تقديرية."
            }
        }

        // Delivery proof strengthens the provider's side.
        val afterEvidence = contract.evidence.filter {
            it.kind == EvidenceKind.AFTER_STATE || it.kind == EvidenceKind.DELIVERY_PROOF
        }
        if (afterEvidence.isNotEmpty()) {
            share += 0.08f
            findings += ArbitrationFinding(
                clause = "إثبات التسليم",
                evidenceIds = afterEvidence.map { it.id },
                leaning = 0.3f,
                explanation = "توجد ${afterEvidence.size} وثيقة مصوّرة لحالة ما بعد التنفيذ أو إثبات تسليم."
            )
        } else if (deliveredWeight > 0) {
            unresolved += "لا توجد صور لحالة ما بعد التنفيذ رغم تسجيل تسليم."
        }

        // Defects logged after delivery pull the other way.
        val defects = contract.evidence.filter { it.kind == EvidenceKind.DEFECT }
        if (defects.isNotEmpty()) {
            val impact = min(0.25f, 0.07f * defects.size)
            share -= impact
            findings += ArbitrationFinding(
                clause = contract.terms.firstOrNull { it.kind == TermKind.WARRANTY }?.text ?: "جودة التنفيذ",
                evidenceIds = defects.map { it.id },
                leaning = -impact * 2f,
                explanation = "تم توثيق ${defects.size} عيب أو ملاحظة على العمل المسلَّم."
            )
        }

        // Before/after pairing: a missing "before" makes any defect claim weaker.
        val hasBefore = contract.evidence.any { it.kind == EvidenceKind.BEFORE_STATE }
        if (defects.isNotEmpty() && !hasBefore) {
            share += 0.05f
            unresolved += "لا توجد صور للحالة قبل بدء العمل، فلا يمكن الجزم بأن العيوب حدثت أثناء التنفيذ."
        }

        // Approved expenses the client agreed to bear are owed to the provider.
        val clientExpenses = ExpenseAllocator.totalsByBearer(contract)[ai.pacto.app.domain.model.PartyRole.CLIENT]
        if (clientExpenses != null && !clientExpenses.isZero && !held.isZero) {
            val bump = min(0.20, clientExpenses.minor.toDouble() / held.minor.toDouble()).toFloat()
            share += bump
            findings += ArbitrationFinding(
                clause = contract.terms.firstOrNull { it.kind == TermKind.MATERIALS }?.text ?: "المصاريف المعتمدة",
                evidenceIds = contract.expenses.mapNotNull { it.receiptEvidenceId },
                leaning = bump * 2f,
                explanation = "مصاريف معتمدة على الطرف الطالب بقيمة ${clientExpenses.format()} دفعها المنفذ."
            )
        }

        if (contract.terms.none { it.kind == TermKind.CANCELLATION }) {
            unresolved += "لا يوجد بند إلغاء متفق عليه، وتوزيع المتبقي اجتهادي."
        }
        if (contract.parties.any { !it.identity.isVerified }) {
            unresolved += "أحد الأطراف غير موثق الهوية داخل التطبيق."
        }

        val finalShare = share.coerceIn(0f, 1f)
        val providerAmount = Money((held.minor * finalShare).roundToLong(), currency)
        val clientAmount = held - providerAmount

        val confidence = confidenceOf(contract, unresolved.size)

        val summary = buildString {
            append("يقترح التقرير صرف ${providerAmount.format()} للمنفذ و${clientAmount.format()} للطرف الطالب ")
            append("من إجمالي المبلغ المجمّد ${held.format()}، ")
            append("استناداً إلى ${findings.size} نقطة تقييم مأخوذة من بنود العقد والأدلة المسجلة.")
        }

        return ArbitrationReport(
            generatedAt = now,
            findings = findings,
            providerShare = finalShare,
            providerAmount = providerAmount,
            clientAmount = clientAmount,
            confidence = confidence,
            summary = summary,
            unresolvedPoints = unresolved
        )
    }

    private fun confidenceOf(contract: Contract, unresolvedCount: Int): Float {
        var score = 0.45f
        if (contract.evidence.size >= 2) score += 0.15f
        if (contract.evidence.any { it.kind == EvidenceKind.BEFORE_STATE }) score += 0.10f
        if (contract.isFullySigned) score += 0.10f
        if (contract.parties.all { it.identity.isVerified }) score += 0.10f
        if (contract.terms.any { it.kind == TermKind.DEADLINE }) score += 0.05f
        if (contract.terms.any { it.kind == TermKind.CANCELLATION }) score += 0.05f
        score -= 0.06f * unresolvedCount
        return score.coerceIn(0.1f, 0.95f)
    }
}
