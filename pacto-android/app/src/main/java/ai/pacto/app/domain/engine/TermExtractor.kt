package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.DialectNote
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Priority
import ai.pacto.app.domain.model.TermKind

/** One side of a captured conversation, produced by the recorder or by the chat parser. */
data class SpeakerTurn(val speaker: String, val text: String)

data class ExtractionResult(
    val title: String,
    val terms: List<ContractTerm>,
    val total: Money?,
    val deposit: Money?,
    val penaltyPerDay: Money?,
    val deadlineDays: Int?,
    val warrantyDays: Int?,
    val currency: String,
    val dialectNotes: List<DialectNote>,
    val priority: Priority,
    val locationHint: String?
)

/**
 * Turns spoken or typed everyday language into structured contract terms. This is a
 * deterministic, fully on-device extractor: no sentence ever leaves the phone. It is the
 * fallback and the ground truth that a local language model is measured against, and the
 * rules here are the ones the loophole detector and the arbitrator both read.
 */
object TermExtractor {

    private val CURRENCIES = mapOf(
        "ريال" to "SAR", "ر س" to "SAR", "رس" to "SAR", "sar" to "SAR",
        "درهم" to "AED", "aed" to "AED",
        "دينار" to "KWD", "kwd" to "KWD",
        "جنيه" to "EGP", "egp" to "EGP",
        "دولار" to "USD", "usd" to "USD", "$" to "USD",
        "يورو" to "EUR", "eur" to "EUR"
    )

    private val THOUSAND_WORDS = listOf("الف", "الاف", "ألف")
    private val HUNDRED_WORDS = listOf("مئه", "مايه", "ميه", "مئة")

    private val SCOPE_VERBS = listOf(
        "اصلاح", "صيانه", "تركيب", "نقل", "تنظيف", "دهان", "سباكه", "كهرباء", "تمديد",
        "بيع", "شراء", "تاجير", "ايجار", "تصميم", "برمجه", "توصيل", "شحن", "خياطه",
        "تسليم", "بناء", "حفر", "قص", "زراعه", "تشطيب", "فك", "لحام", "طلاء", "غسيل"
    )

    private val URGENT_WORDS = listOf("مستعجل", "ضروري", "طارئ", "اليوم", "حالا", "بسرعه")

    fun extract(rawText: String, turns: List<SpeakerTurn> = emptyList()): ExtractionResult {
        val text = ArabicText.flatten(rawText.ifBlank { turns.joinToString(" ") { it.text } })
        val currency = detectCurrency(text)
        val amounts = findAmounts(text, currency)

        val deposit = findLabeledAmount(text, currency, listOf("عربون", "مقدم", "دفعه اولى", "تحت الحساب"))
        val penalty = findLabeledAmount(text, currency, listOf("غرامه", "غرامة", "شرط جزائي"))
        val total = pickTotal(amounts, deposit, penalty)

        val deadlineDays = findDeadlineDays(text)
        val warrantyDays = findWarrantyDays(text)
        val scope = findScope(rawText)
        val location = findLocation(text)
        val dialect = DialectLexicon.detect(rawText)

        val terms = buildList {
            if (scope.isNotBlank()) {
                add(ContractTerm(TermKind.SCOPE, scopeClause(scope), scope, 0.9f))
            }
            total?.let {
                add(ContractTerm(TermKind.PRICE, "إجمالي قيمة العقد ${it.format()} شاملاً ما تم الاتفاق عليه.", null, 0.95f))
            }
            deposit?.let {
                add(
                    ContractTerm(
                        TermKind.PAYMENT_SCHEDULE,
                        "يُدفع عربون بقيمة ${it.format()} عند التوقيع ويُخصم من الإجمالي، ويُسدد الباقي عند التسليم.",
                        null,
                        0.9f
                    )
                )
            }
            deadlineDays?.let {
                add(ContractTerm(TermKind.DEADLINE, "يلتزم المنفذ بإنجاز العمل خلال $it يوماً من تاريخ التوقيع.", null, 0.85f))
            }
            warrantyDays?.let {
                add(ContractTerm(TermKind.WARRANTY, "مدة الضمان $it يوماً من تاريخ التسليم تشمل إصلاح العيوب دون مقابل.", null, 0.85f))
            }
            penalty?.let {
                add(ContractTerm(TermKind.PENALTY, "غرامة تأخير قدرها ${it.format()} عن كل يوم تأخير عن الموعد المتفق عليه.", null, 0.8f))
            }
            location?.let {
                add(ContractTerm(TermKind.LOCATION, "يتم التنفيذ والتسليم في: $it.", location, 0.7f))
            }
            dialect.forEach { note ->
                add(ContractTerm(termKindFor(note.term), note.normalizedClause, note.term, 0.75f))
            }
        }.distinctBy { it.kind to it.text }

        return ExtractionResult(
            title = buildTitle(scope, total),
            terms = terms,
            total = total,
            deposit = deposit,
            penaltyPerDay = penalty,
            deadlineDays = deadlineDays,
            warrantyDays = warrantyDays,
            currency = currency,
            dialectNotes = dialect,
            priority = priorityOf(text, deadlineDays),
            locationHint = location
        )
    }

    private fun termKindFor(term: String): TermKind =
        DialectLexicon.entryFor(term)?.clauseKind ?: TermKind.OTHER

    private fun detectCurrency(text: String): String {
        CURRENCIES.forEach { (token, code) ->
            if (text.contains(token)) return code
        }
        return Money.DEFAULT_CURRENCY
    }

    /** All money amounts in reading order, with thousand words applied. */
    fun findAmounts(text: String, currency: String): List<Money> {
        val pattern = Regex("(\\d+(?:[.,]\\d{1,2})?)\\s*(الف|الاف|مئه|ميه)?")
        return pattern.findAll(text).mapNotNull { match ->
            val raw = match.groupValues[1].replace(",", ".")
            val base = raw.toDoubleOrNull() ?: return@mapNotNull null
            val multiplier = when (match.groupValues[2]) {
                in THOUSAND_WORDS -> 1000.0
                in HUNDRED_WORDS -> 100.0
                else -> 1.0
            }
            val value = base * multiplier
            // Bare small integers next to time words are durations, not prices.
            val tail = text.substring(match.range.last + 1).take(12)
            if (multiplier == 1.0 && isDurationContext(tail)) return@mapNotNull null
            if (value <= 0) null else Money.ofMajor(value, currency)
        }.toList()
    }

    private fun isDurationContext(tail: String): Boolean =
        listOf("يوم", "ايام", "اسبوع", "اسابيع", "شهر", "شهور", "ساعه", "ساعات", "سنه", "سنوات", "دقيقه")
            .any { tail.trimStart().startsWith(it) }

    private fun findLabeledAmount(text: String, currency: String, labels: List<String>): Money? {
        labels.forEach { label ->
            val idx = text.indexOf(ArabicText.normalize(label))
            if (idx >= 0) {
                val window = text.substring(idx, minOf(text.length, idx + label.length + 30))
                findAmounts(window, currency).firstOrNull()?.let { return it }
                val before = text.substring(maxOf(0, idx - 25), idx)
                findAmounts(before, currency).lastOrNull()?.let { return it }
            }
        }
        return null
    }

    private fun pickTotal(amounts: List<Money>, deposit: Money?, penalty: Money?): Money? {
        val candidates = amounts.filter { it != deposit && it != penalty }
        return candidates.maxByOrNull { it.minor } ?: amounts.maxByOrNull { it.minor }
    }

    fun findDeadlineDays(text: String): Int? {
        if (text.contains("بعد بكره") || text.contains("بعد غد")) return 2
        if (text.contains("بكره") || text.contains("غدا")) return 1
        if (text.contains("يومين")) return 2
        if (text.contains("اسبوعين")) return 14
        if (text.contains("شهرين")) return 60
        val match = Regex("(?:خلال|في|بعد|مده|خلال مده)\\s*(\\d+)\\s*(يوم|ايام|اسبوع|اسابيع|شهر|شهور|ساعه|ساعات)")
            .find(text) ?: return null
        val n = match.groupValues[1].toIntOrNull() ?: return null
        return when (match.groupValues[2]) {
            "يوم", "ايام" -> n
            "اسبوع", "اسابيع" -> n * 7
            "شهر", "شهور" -> n * 30
            "ساعه", "ساعات" -> if (n <= 24) 1 else n / 24
            else -> n
        }
    }

    fun findWarrantyDays(text: String): Int? {
        val idx = listOf("ضمان", "كفاله").map { text.indexOf(it) }.filter { it >= 0 }.minOrNull() ?: return null
        val window = text.substring(idx, minOf(text.length, idx + 40))
        val match = Regex("(\\d+)\\s*(يوم|ايام|اسبوع|اسابيع|شهر|شهور|سنه|سنوات)").find(window)
        if (match != null) {
            val n = match.groupValues[1].toIntOrNull() ?: return null
            return when (match.groupValues[2]) {
                "يوم", "ايام" -> n
                "اسبوع", "اسابيع" -> n * 7
                "شهر", "شهور" -> n * 30
                "سنه", "سنوات" -> n * 365
                else -> n
            }
        }
        if (window.contains("شهرين")) return 60
        if (window.contains("سنه")) return 365
        return null
    }

    private fun findScope(rawText: String): String {
        val sentences = ArabicText.normalize(rawText)
            .split(Regex("[.،؟!\\n]"))
            .map { it.trim() }
            .filter { it.length > 3 }
        val verbSentence = sentences.firstOrNull { sentence ->
            SCOPE_VERBS.any { sentence.contains(it) }
        }
        return (verbSentence ?: sentences.firstOrNull().orEmpty()).take(220)
    }

    private fun scopeClause(scope: String): String =
        "يلتزم المنفذ بتنفيذ العمل التالي كما اتُفق عليه: $scope."

    private fun findLocation(text: String): String? {
        val match = Regex("(?:في|بـ|عند|موقع)\\s+(البيت|المنزل|الشقه|الفيلا|المحل|المكتب|المستودع|الورشه|المزرعه|الموقع)")
            .find(text) ?: return null
        return match.groupValues[1]
    }

    private fun buildTitle(scope: String, total: Money?): String {
        val head = scope.split(" ").filter { it.isNotBlank() }.take(5).joinToString(" ")
        return when {
            head.isNotBlank() -> head
            total != null -> "اتفاق بقيمة ${total.format()}"
            else -> "اتفاق جديد"
        }
    }

    private fun priorityOf(text: String, deadlineDays: Int?): Priority = when {
        URGENT_WORDS.any { text.contains(it) } -> Priority.URGENT
        deadlineDays != null && deadlineDays <= 1 -> Priority.URGENT
        deadlineDays != null && deadlineDays <= 3 -> Priority.MEDIUM
        else -> Priority.NORMAL
    }
}
