package com.almarar.mahami.ui

import com.almarar.mahami.ai.AiSource
import com.almarar.mahami.ai.ChatMessage
import com.almarar.mahami.ai.ExtractedTask
import com.almarar.mahami.ai.PlanItem
import com.almarar.mahami.ai.RiskNote

/** حالة شاشة المساعد الذكي */
data class AssistantState(
    val messages: List<ChatMessage> = emptyList(),
    val plan: List<PlanItem> = emptyList(),
    val risks: List<RiskNote> = emptyList(),
    val summary: String = "",
    val busy: Boolean = false,
    val lastSource: AiSource? = null,
    val notice: String = "",
    val cloudReady: Boolean = false
)

/** حالة الاستخراج الذكي للمهام من نص */
data class ExtractionState(
    val input: String = "",
    val results: List<ExtractedTask> = emptyList(),
    val busy: Boolean = false,
    val source: AiSource? = null,
    val notice: String = "",
    val done: Boolean = false
)

/** نتيجة اقتراح خطوات أو صياغة رسالة لمهمة واحدة */
data class TaskAiState(
    val taskId: Long = 0,
    val steps: List<String> = emptyList(),
    val message: String = "",
    val busy: Boolean = false,
    val source: AiSource? = null,
    val notice: String = ""
)
