package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.DialectNote
import ai.pacto.app.domain.model.TermKind

/**
 * Market slang carries real obligations that a literal transcript loses. Each entry maps a
 * colloquial term to the clause a court or an arbitrator can actually read.
 */
object DialectLexicon {

    data class Entry(
        val term: String,
        val aliases: List<String>,
        val meaning: String,
        val clauseKind: TermKind,
        val clause: String
    )

    val entries: List<Entry> = listOf(
        Entry(
            term = "عربون",
            aliases = listOf("عربون", "عربان", "مقدم", "دفعه مقدمه", "دفعة مقدمة"),
            meaning = "مبلغ مقدم يثبت الجدية ويخصم من إجمالي القيمة",
            clauseKind = TermKind.PAYMENT_SCHEDULE,
            clause = "يُدفع العربون عند التوقيع ويُخصم من إجمالي قيمة العقد، ولا يُرد إذا انسحب الدافع دون سبب يعود للطرف الآخر."
        ),
        Entry(
            term = "سعي",
            aliases = listOf("سعي", "سعيه", "عموله", "عمولة", "دلاله"),
            meaning = "عمولة وساطة مستحقة عند إتمام الصفقة",
            clauseKind = TermKind.PAYMENT_SCHEDULE,
            clause = "تستحق عمولة الوساطة (السعي) عند إتمام الصفقة فعلياً وتسليم محلها، ولا تستحق إذا لم تتم."
        ),
        Entry(
            term = "خلو",
            aliases = listOf("خلو", "خلو رجل", "فراغ"),
            meaning = "مبلغ مقابل التنازل عن منفعة محل أو موقع",
            clauseKind = TermKind.PRICE,
            clause = "يُدفع بدل الخلو مقابل التنازل عن المنفعة والموقع، ولا يشمل الأصول أو الترخيص ما لم يُنص على ذلك صراحة."
        ),
        Entry(
            term = "سكراب",
            aliases = listOf("سكراب", "خرده", "تشليح"),
            meaning = "بيع كقطع غير صالحة للتشغيل",
            clauseKind = TermKind.WARRANTY,
            clause = "يُباع محل العقد كسكراب (قطع غيار) دون أي ضمان للتشغيل أو الصلاحية، ويسقط حق الاسترجاع لعيب تشغيلي."
        ),
        Entry(
            term = "على الفحص",
            aliases = listOf("على الفحص", "بالفحص", "مشروط بالفحص"),
            meaning = "البيع معلّق على نتيجة فحص فني",
            clauseKind = TermKind.INSPECTION,
            clause = "البيع معلّق على نتيجة الفحص الفني خلال مدة محددة من التسليم، وللمشتري الحق في الاسترجاع الكامل إذا خالف الفحص الوصف المتفق عليه."
        ),
        Entry(
            term = "قطاعي",
            aliases = listOf("قطاعي", "مفرق", "تجزئه"),
            meaning = "بيع بالتجزئة بسعر الوحدة لا بسعر الجملة",
            clauseKind = TermKind.PRICE,
            clause = "السعر المتفق عليه هو سعر التجزئة للوحدة الواحدة، ولا يسري على طلبات الجملة."
        ),
        Entry(
            term = "تسليم مفتاح",
            aliases = listOf("تسليم مفتاح", "مفتاح"),
            meaning = "التسليم شامل المواد والعمالة والتشطيب",
            clauseKind = TermKind.SCOPE,
            clause = "التنفيذ بنظام تسليم المفتاح: يتحمل المنفذ المواد والعمالة وكل ما يلزم لتشغيل العمل دون مطالبات إضافية."
        ),
        Entry(
            term = "يد عامله",
            aliases = listOf("يد عامله", "يد عاملة", "مصنعيه", "مصنعية"),
            meaning = "أجرة العمل فقط دون المواد",
            clauseKind = TermKind.MATERIALS,
            clause = "القيمة المتفق عليها تشمل أجرة العمل فقط، وتكون المواد وقطع الغيار على حساب الطرف الطالب."
        ),
        Entry(
            term = "ضمان",
            aliases = listOf("ضمان", "كفاله", "كفالة"),
            meaning = "التزام بإصلاح العيوب خلال مدة محددة",
            clauseKind = TermKind.WARRANTY,
            clause = "يلتزم المنفذ بإصلاح أي عيب في العمل خلال مدة الضمان دون مقابل، ما لم ينتج العيب عن سوء استخدام."
        ),
        Entry(
            term = "دفعه تحت الحساب",
            aliases = listOf("تحت الحساب", "دفعه تحت الحساب"),
            meaning = "دفعة جزئية تُخصم من الإجمالي",
            clauseKind = TermKind.PAYMENT_SCHEDULE,
            clause = "تُعد الدفعة المسددة تحت الحساب جزءاً من إجمالي القيمة وتُخصم من المستحق النهائي."
        ),
        Entry(
            term = "بحاله",
            aliases = listOf("بحاله", "كما هو", "بالحاله الراهنه"),
            meaning = "قبول محل العقد بوضعه الحالي",
            clauseKind = TermKind.WARRANTY,
            clause = "يقر المشتري بمعاينة محل العقد وقبوله بحالته الراهنة، مع بقاء مسؤولية البائع عن العيوب التي أخفاها عمداً."
        )
    )

    fun detect(text: String): List<DialectNote> {
        val flat = ArabicText.flatten(text)
        return entries.mapNotNull { entry ->
            val hit = entry.aliases.any { flat.contains(ArabicText.normalize(it)) }
            if (hit) DialectNote(entry.term, entry.meaning, entry.clause) else null
        }.distinctBy { it.term }
    }

    fun entryFor(term: String): Entry? =
        entries.firstOrNull { ArabicText.normalize(it.term) == ArabicText.normalize(term) }
}
