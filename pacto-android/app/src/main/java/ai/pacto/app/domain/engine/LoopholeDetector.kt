package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.TermKind

enum class LoopholeSeverity { BLOCKING, IMPORTANT, ADVISORY }

data class Loophole(
    val id: String,
    val severity: LoopholeSeverity,
    /** The question both sides should answer before signing. */
    val question: String,
    val why: String,
    /** One tap adds this clause to the draft. */
    val suggestedClause: ContractTerm?
)

/**
 * The gap between what people say and what a contract needs. Every rule here comes from a
 * concrete way small deals go wrong: who pays for the parts, what happens on a late day,
 * what a cancellation costs, and whether the numbers add up at all.
 */
object LoopholeDetector {

    private val REPAIR_WORDS = listOf("اصلاح", "صيانه", "تركيب", "تصليح", "قطع غيار", "تبديل")
    private val GOODS_WORDS = listOf("بيع", "شراء", "جهاز", "سياره", "مستعمل", "جوال", "لابتوب", "معده")
    private val ONSITE_WORDS = listOf("البيت", "المنزل", "المحل", "الموقع", "المزرعه", "الورشه", "المستودع")

    fun detect(contract: Contract): List<Loophole> {
        val found = mutableListOf<Loophole>()
        val kinds = contract.terms.map { it.kind }.toSet()
        val corpus = ArabicText.flatten(contract.transcript + " " + contract.terms.joinToString(" ") { it.text })

        if (contract.total.isZero && TermKind.PRICE !in kinds) {
            found += Loophole(
                id = "missing_price",
                severity = LoopholeSeverity.BLOCKING,
                question = "ما هي القيمة الإجمالية المتفق عليها؟",
                why = "عقد بلا قيمة محددة لا يمكن تجميد مبلغه في الضمان ولا المطالبة به.",
                suggestedClause = null
            )
        }

        if (TermKind.DEADLINE !in kinds) {
            found += Loophole(
                id = "missing_deadline",
                severity = LoopholeSeverity.BLOCKING,
                question = "ما هو موعد التسليم النهائي؟",
                why = "بدون موعد لا يوجد تأخير يمكن إثباته، ويسقط أثر أي غرامة.",
                suggestedClause = ContractTerm(
                    TermKind.DEADLINE,
                    "يلتزم المنفذ بإنجاز العمل خلال 7 أيام من تاريخ التوقيع.",
                    null,
                    0.5f
                )
            )
        }

        if (!contract.total.isZero && contract.milestones.isNotEmpty()) {
            val sum = contract.milestones.fold(Money.zero(contract.total.currency)) { acc, m -> acc + m.amount }
            if (sum != contract.total) {
                found += Loophole(
                    id = "milestones_mismatch",
                    severity = LoopholeSeverity.BLOCKING,
                    question = "مجموع الدفعات (${sum.format()}) لا يساوي إجمالي العقد (${contract.total.format()}). أيهما الصحيح؟",
                    why = "اختلاف المجموع يترك مبلغاً معلقاً لا يعرف أحد لمن يعود عند التسوية.",
                    suggestedClause = null
                )
            }
        }

        if (TermKind.PAYMENT_SCHEDULE !in kinds && !contract.total.isZero) {
            found += Loophole(
                id = "missing_payment_schedule",
                severity = LoopholeSeverity.IMPORTANT,
                question = "متى تُدفع القيمة؟ دفعة واحدة عند التسليم أم مقدم وباقٍ؟",
                why = "جدول الدفع هو ما يحدد متى يُفرج الضمان عن المال.",
                suggestedClause = ContractTerm(
                    TermKind.PAYMENT_SCHEDULE,
                    "تُدفع القيمة كاملة عند اكتمال التسليم وقبوله من الطرف الطالب.",
                    null,
                    0.5f
                )
            )
        }

        if (TermKind.MATERIALS !in kinds && ArabicText.containsAny(corpus, REPAIR_WORDS)) {
            found += Loophole(
                id = "missing_materials",
                severity = LoopholeSeverity.IMPORTANT,
                question = "من يتحمل تكلفة قطع الغيار والمواد؟",
                why = "أكثر خلافات أعمال الصيانة سببها مواد لم يتفق أحد على من يدفعها.",
                suggestedClause = ContractTerm(
                    TermKind.MATERIALS,
                    "تكون قطع الغيار والمواد على حساب الطرف الطالب، ولا يجوز شراؤها إلا بموافقته المسبقة موثقة داخل التطبيق.",
                    null,
                    0.5f
                )
            )
        }

        if (TermKind.PENALTY !in kinds && TermKind.DEADLINE in kinds) {
            found += Loophole(
                id = "missing_penalty",
                severity = LoopholeSeverity.ADVISORY,
                question = "ما غرامة التأخير عن الموعد؟",
                why = "الموعد بلا أثر مالي لا يُلزم أحداً عملياً.",
                suggestedClause = ContractTerm(
                    TermKind.PENALTY,
                    "يُخصم 2% من قيمة العقد عن كل يوم تأخير بحد أقصى 20% من الإجمالي.",
                    null,
                    0.5f
                )
            )
        }

        if (TermKind.CANCELLATION !in kinds) {
            found += Loophole(
                id = "missing_cancellation",
                severity = LoopholeSeverity.IMPORTANT,
                question = "ماذا يحدث إذا ألغى أحد الطرفين الاتفاق؟",
                why = "بدون بند إلغاء يبقى المبلغ المجمّد معلقاً حتى يتفق الطرفان أو تفصل جهة قضائية.",
                suggestedClause = ContractTerm(
                    TermKind.CANCELLATION,
                    "عند الإلغاء يُحتسب المستحق بنسبة الإنجاز الموثقة، ويُرد الباقي للطرف الطالب خلال ثلاثة أيام.",
                    null,
                    0.5f
                )
            )
        }

        if (TermKind.WARRANTY !in kinds && ArabicText.containsAny(corpus, GOODS_WORDS + REPAIR_WORDS)) {
            found += Loophole(
                id = "missing_warranty",
                severity = LoopholeSeverity.ADVISORY,
                question = "هل هناك ضمان بعد التسليم، وما مدته؟",
                why = "العيب الذي يظهر بعد يومين يحتاج مدة ضمان مكتوبة ليكون قابلاً للمطالبة.",
                suggestedClause = ContractTerm(
                    TermKind.WARRANTY,
                    "ضمان لمدة 30 يوماً من التسليم يغطي عيوب التنفيذ دون سوء الاستخدام.",
                    null,
                    0.5f
                )
            )
        }

        if (TermKind.LOCATION !in kinds && ArabicText.containsAny(corpus, ONSITE_WORDS)) {
            found += Loophole(
                id = "missing_location",
                severity = LoopholeSeverity.ADVISORY,
                question = "ما العنوان الدقيق لموقع التنفيذ أو التسليم؟",
                why = "تحديد الموقع يفعّل إثبات الوصول الجغرافي ويمنع خلاف التسليم.",
                suggestedClause = null
            )
        }

        if (ArabicText.containsAny(corpus, listOf("على الفحص", "بالفحص")) && TermKind.INSPECTION !in kinds) {
            found += Loophole(
                id = "missing_inspection_window",
                severity = LoopholeSeverity.IMPORTANT,
                question = "كم يوماً مهلة الفحص، وماذا يحدث إذا رسب الفحص؟",
                why = "شرط \"على الفحص\" بلا مهلة محددة يفتح باب الاسترجاع بلا نهاية.",
                suggestedClause = DialectLexicon.entryFor("على الفحص")?.let {
                    ContractTerm(TermKind.INSPECTION, it.clause, it.term, 0.6f)
                }
            )
        }

        val unverified = contract.parties.filterNot { it.identity.isVerified }
        if (unverified.isNotEmpty()) {
            found += Loophole(
                id = "unverified_party",
                severity = LoopholeSeverity.ADVISORY,
                question = "لم يتم توثيق هوية: ${unverified.joinToString("، ") { it.displayName }}",
                why = "الهوية الموثقة هي ما يجعل الملف القضائي قابلاً للاستخدام لاحقاً.",
                suggestedClause = null
            )
        }

        return found.sortedBy { it.severity.ordinal }
    }
}
