package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ExpenseItem
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.PartyRole
import ai.pacto.app.domain.model.TermKind

/**
 * A receipt scanned mid-job has to land on somebody's side of the account. The allocation
 * follows the contract's own wording first, and only then falls back to market convention,
 * and it always says out loud which rule it used.
 */
object ExpenseAllocator {

    private val PARTS_WORDS = listOf("قطع غيار", "قطعه", "مواد", "خامات", "اسمنت", "دهان", "سلك", "ماسوره", "فلتر", "زيت", "بطاريه")
    private val TRANSPORT_WORDS = listOf("بنزين", "وقود", "نقل", "شحن", "اجره", "توصيل", "مواصلات")
    private val TOOL_WORDS = listOf("عده", "معدات", "ايجار معده", "استئجار", "منشار", "مثقاب")

    /** Expenses above this share of the contract value always need explicit approval. */
    private const val APPROVAL_THRESHOLD = 0.10

    data class Allocation(val bearer: PartyRole, val reason: String, val requiresApproval: Boolean)

    fun allocate(contract: Contract, description: String, amount: Money): Allocation {
        val text = ArabicText.flatten(description)
        val termsText = ArabicText.flatten(contract.terms.joinToString(" ") { it.text })
        val turnkey = termsText.contains("تسليم المفتاح") || termsText.contains("تسليم مفتاح")
        val materialsOnClient = contract.terms.any {
            it.kind == TermKind.MATERIALS && ArabicText.flatten(it.text).contains("على حساب الطرف الطالب")
        }

        val requiresApproval = contract.total.minor > 0 &&
            amount.minor.toDouble() / contract.total.minor.toDouble() > APPROVAL_THRESHOLD

        return when {
            turnkey -> Allocation(
                PartyRole.PROVIDER,
                "العقد بنظام تسليم المفتاح، فالمواد والعمالة على المنفذ.",
                requiresApproval
            )

            materialsOnClient && ArabicText.containsAny(text, PARTS_WORDS) -> Allocation(
                PartyRole.CLIENT,
                "بند المواد في العقد يحمّل قطع الغيار للطرف الطالب.",
                requiresApproval
            )

            ArabicText.containsAny(text, PARTS_WORDS) -> Allocation(
                PartyRole.CLIENT,
                "قطع الغيار والمواد تُحتسب على الطرف الطالب ما لم ينص العقد على غير ذلك.",
                true
            )

            ArabicText.containsAny(text, TRANSPORT_WORDS) -> Allocation(
                PartyRole.PROVIDER,
                "تكاليف التنقل والنقل جزء من أجرة المنفذ ما لم تُشترط منفصلة.",
                requiresApproval
            )

            ArabicText.containsAny(text, TOOL_WORDS) -> Allocation(
                PartyRole.PROVIDER,
                "أدوات ومعدات التنفيذ على المنفذ.",
                requiresApproval
            )

            else -> Allocation(
                PartyRole.CLIENT,
                "مصروف خارج نطاق العمل المتفق عليه، يُعرض على الطرف الطالب لاعتماده.",
                true
            )
        }
    }

    fun build(
        contract: Contract,
        id: String,
        description: String,
        amount: Money,
        incurredAt: Long,
        receiptEvidenceId: String? = null
    ): ExpenseItem {
        val allocation = allocate(contract, description, amount)
        return ExpenseItem(
            id = id,
            description = description,
            amount = amount,
            incurredAt = incurredAt,
            bearer = allocation.bearer,
            receiptEvidenceId = receiptEvidenceId,
            approved = !allocation.requiresApproval,
            allocationReason = allocation.reason
        )
    }

    /** Running total the closing statement shows for each side. */
    fun totalsByBearer(contract: Contract): Map<PartyRole, Money> {
        val zero = Money.zero(contract.escrow.currency)
        return contract.expenses
            .filter { it.approved }
            .groupBy { it.bearer }
            .mapValues { (_, items) -> items.fold(zero) { acc, item -> acc + item.amount } }
    }
}
