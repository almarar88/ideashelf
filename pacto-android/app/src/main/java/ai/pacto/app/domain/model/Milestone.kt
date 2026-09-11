package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class MilestoneStatus { PENDING, DELIVERED, RELEASED, DISPUTED, CANCELLED }

@Serializable
data class Milestone(
    val id: String,
    val title: String,
    val amount: Money,
    val dueAt: Long,
    val status: MilestoneStatus = MilestoneStatus.PENDING,
    /** Share of the whole job this milestone represents, used by the settlement calculator. */
    val weight: Int = 1,
    val geoFence: GeoPoint? = null,
    val deliveredAt: Long? = null,
    val releasedAt: Long? = null,
    val requiresEvidence: Boolean = false,
    val evidenceIds: List<String> = emptyList()
) {
    val isClosed: Boolean get() = status == MilestoneStatus.RELEASED || status == MilestoneStatus.CANCELLED
}
