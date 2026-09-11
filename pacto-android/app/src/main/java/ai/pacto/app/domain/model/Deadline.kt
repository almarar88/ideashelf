package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class DeadlineKind { DELIVERY, PAYMENT, WARRANTY_EXPIRY, TRIAL_PERIOD_END, INSPECTION }

@Serializable
data class DeadlineItem(
    val id: String,
    val kind: DeadlineKind,
    val label: String,
    val dueAt: Long,
    val milestoneId: String? = null,
    /** Recorded when the alarm is delivered, so "I was never told" is answerable. */
    val notifiedAt: Long? = null,
    val acknowledgedAt: Long? = null,
    val acknowledgedByPartyId: String? = null
)
