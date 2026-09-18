package com.almarar.mahami.ui

import com.almarar.mahami.smart.ParsedChip
import com.almarar.mahami.smart.ParsedTask

/** حالة حقل الإضافة الذكية مع معاينة ما فهمه المحلّل */
data class QuickInputState(
    val text: String = "",
    val title: String = "",
    val chips: List<ParsedChip> = emptyList(),
    val parsed: ParsedTask? = null
)
