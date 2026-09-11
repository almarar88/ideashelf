package com.almarar.mahami.ai

import com.almarar.mahami.data.Priority
import java.time.LocalDate
import java.time.LocalTime

/** مهمة مستخرجة من نص قبل حفظها */
data class ExtractedTask(
    val title: String,
    val details: String = "",
    val dueDate: LocalDate,
    val dueTime: LocalTime = LocalTime.of(9, 0),
    val priority: Priority = Priority.MEDIUM,
    val owner: String = "",
    val category: String = "عام",
    val steps: List<String> = emptyList(),
    val confidence: Float = 0.6f,
    val dateWasExplicit: Boolean = true,
    val selected: Boolean = true
)

/** بند في خطة اليوم */
data class PlanItem(
    val taskId: Long?,
    val title: String,
    val slot: String,
    val reason: String
)

enum class RiskLevel(val label: String) { HIGH("مرتفع"), MEDIUM("متوسط"), LOW("منخفض") }

/** ملاحظة مخاطرة أو تعارض */
data class RiskNote(
    val title: String,
    val body: String,
    val level: RiskLevel,
    val taskIds: List<Long> = emptyList()
)

data class ChatMessage(
    val fromUser: Boolean,
    val text: String,
    val pending: Boolean = false
)

/** مصدر النتيجة: نموذج Claude أو المحرك المحلي */
enum class AiSource(val label: String) {
    CLAUDE("Claude"), LOCAL("المحرك المحلي")
}

data class AiResult<T>(
    val value: T,
    val source: AiSource,
    val note: String = ""
)

class AiException(message: String) : Exception(message)
