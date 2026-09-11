package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.CaptureSource
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.DeadlineItem
import ai.pacto.app.domain.model.DeadlineKind
import ai.pacto.app.domain.model.EscrowAccount
import ai.pacto.app.domain.model.Milestone
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Party
import ai.pacto.app.domain.model.PartyRole
import java.util.UUID

/** Assembles a signable contract out of what the capture engine understood. */
object ContractFactory {

    private const val DAY_MS = 24 * 60 * 60 * 1000L

    fun fromExtraction(
        extraction: ExtractionResult,
        now: Long,
        me: Party,
        counterpartyName: String,
        counterpartyRole: PartyRole,
        source: CaptureSource,
        transcript: String,
        feeBasisPoints: Int,
        idFactory: () -> String = { UUID.randomUUID().toString() }
    ): Contract {
        val counterparty = Party(
            id = idFactory(),
            displayName = counterpartyName.ifBlank { "الطرف الآخر" },
            role = counterpartyRole
        )
        val total = extraction.total ?: Money.zero(extraction.currency)
        val deadlineAt = now + (extraction.deadlineDays ?: 7) * DAY_MS

        val milestones = buildMilestones(extraction, total, now, deadlineAt, idFactory)
        val deadlines = buildList {
            add(
                DeadlineItem(
                    id = idFactory(),
                    kind = DeadlineKind.DELIVERY,
                    label = "الموعد النهائي للتسليم",
                    dueAt = deadlineAt
                )
            )
            extraction.warrantyDays?.let { days ->
                add(
                    DeadlineItem(
                        id = idFactory(),
                        kind = DeadlineKind.WARRANTY_EXPIRY,
                        label = "انتهاء مدة الضمان",
                        dueAt = deadlineAt + days * DAY_MS
                    )
                )
            }
        }

        return Contract(
            id = idFactory(),
            title = extraction.title,
            createdAt = now,
            status = ContractStatus.DRAFT,
            source = source,
            parties = listOf(me, counterparty),
            terms = extraction.terms,
            total = total,
            milestones = milestones,
            escrow = EscrowAccount(currency = total.currency, feeBasisPoints = feeBasisPoints),
            deadlines = deadlines,
            priority = extraction.priority,
            dialectNotes = extraction.dialectNotes,
            transcript = transcript
        )
    }

    private fun buildMilestones(
        extraction: ExtractionResult,
        total: Money,
        now: Long,
        deadlineAt: Long,
        idFactory: () -> String
    ): List<Milestone> {
        if (total.isZero) return emptyList()
        val deposit = extraction.deposit
        if (deposit != null && deposit < total) {
            return listOf(
                Milestone(
                    id = idFactory(),
                    title = "العربون عند التوقيع",
                    amount = deposit,
                    dueAt = now,
                    weight = 1
                ),
                Milestone(
                    id = idFactory(),
                    title = "الدفعة النهائية عند التسليم",
                    amount = total - deposit,
                    dueAt = deadlineAt,
                    weight = 3,
                    requiresEvidence = true
                )
            )
        }
        return listOf(
            Milestone(
                id = idFactory(),
                title = "التسليم الكامل",
                amount = total,
                dueAt = deadlineAt,
                weight = 1,
                requiresEvidence = true
            )
        )
    }
}
