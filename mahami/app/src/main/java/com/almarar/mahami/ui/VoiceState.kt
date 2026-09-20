package com.almarar.mahami.ui

import com.almarar.mahami.smart.ParsedTask

/** مرحلة جلسة الإدخال الصوتي */
enum class VoicePhase { HIDDEN, LISTENING, REVIEW, ERROR }

/**
 * حالة الورقة الصوتية.
 *
 * المراجعة قبل الحفظ مقصودة: التعرّف على الكلام يخطئ، وحفظ ما لم يتأكّد منه
 * المستخدم يملأ قائمته بمهام غلط أسوأ من عدم وجودها.
 */
data class VoiceState(
    val phase: VoicePhase = VoicePhase.HIDDEN,
    /** ما يُسمع الآن، يتغيّر أثناء الكلام */
    val partial: String = "",
    /** النص النهائي كما فهمه المحرّك */
    val heard: String = "",
    /** مستوى الصوت من 0 إلى 1 لتحريك الموجة */
    val level: Float = 0f,
    /** المهام المستخرجة، بانتظار تأكيد المستخدم */
    val candidates: List<ParsedTask> = emptyList(),
    /** ما ألغاه المستخدم من المقترحات */
    val skipped: Set<Int> = emptySet(),
    val message: String = "",
    val canRetry: Boolean = true
) {
    val visible: Boolean get() = phase != VoicePhase.HIDDEN
    val selected: List<ParsedTask>
        get() = candidates.filterIndexed { index, _ -> index !in skipped }
}
