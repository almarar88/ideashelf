package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.LedgerEntry
import ai.pacto.app.domain.model.LedgerEntryType
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money

sealed interface EscrowResult {
    data class Success(val contract: Contract, val entries: List<LedgerEntry>) : EscrowResult
    data class Rejected(val reason: String) : EscrowResult
}

/**
 * Every movement of money is a ledger append, never an in-place edit. A release always splits
 * into the net paid to the provider and the platform fee, so the two numbers can never drift.
 */
object EscrowEngine {

    fun fund(
        contract: Contract,
        amount: Money,
        now: Long,
        idFactory: () -> String
    ): EscrowResult {
        if (amount.minor <= 0) return EscrowResult.Rejected("مبلغ الإيداع يجب أن يكون أكبر من صفر")
        if (amount.currency != contract.escrow.currency) {
            return EscrowResult.Rejected("عملة الإيداع لا تطابق عملة العقد")
        }
        val entry = LedgerEntry(idFactory(), now, LedgerEntryType.DEPOSIT, amount, "تجميد مبلغ في الضمان")
        return EscrowResult.Success(contract.appendLedger(entry), listOf(entry))
    }

    fun markDelivered(contract: Contract, milestoneId: String, now: Long): EscrowResult {
        val milestone = contract.milestones.firstOrNull { it.id == milestoneId }
            ?: return EscrowResult.Rejected("المرحلة غير موجودة")
        if (milestone.isClosed) return EscrowResult.Rejected("المرحلة مغلقة بالفعل")
        if (milestone.requiresEvidence && milestone.evidenceIds.isEmpty()) {
            return EscrowResult.Rejected("هذه المرحلة تتطلب توثيقاً مصوراً قبل تأكيد التسليم")
        }
        val updated = contract.copy(
            milestones = contract.milestones.map {
                if (it.id == milestoneId) it.copy(status = MilestoneStatus.DELIVERED, deliveredAt = now) else it
            }
        )
        return EscrowResult.Success(updated, emptyList())
    }

    /**
     * Releases one milestone to the provider. The fee is taken from the milestone amount, so
     * the provider sees exactly what the term sheet promised minus a disclosed percentage.
     */
    fun release(
        contract: Contract,
        milestoneId: String,
        now: Long,
        idFactory: () -> String
    ): EscrowResult {
        val milestone = contract.milestones.firstOrNull { it.id == milestoneId }
            ?: return EscrowResult.Rejected("المرحلة غير موجودة")
        if (milestone.status == MilestoneStatus.RELEASED) return EscrowResult.Rejected("تم الإفراج عن هذه الدفعة مسبقاً")
        if (milestone.status == MilestoneStatus.DISPUTED) return EscrowResult.Rejected("المرحلة محل نزاع مفتوح")
        if (milestone.status != MilestoneStatus.DELIVERED) {
            return EscrowResult.Rejected("لا يمكن الإفراج قبل تأكيد تسليم المرحلة")
        }
        if (contract.escrow.held < milestone.amount) {
            return EscrowResult.Rejected("الرصيد المجمّد لا يغطي قيمة المرحلة")
        }

        val fee = milestone.amount.basisPoints(contract.escrow.feeBasisPoints)
        val net = milestone.amount - fee
        val releaseEntry = LedgerEntry(
            idFactory(), now, LedgerEntryType.RELEASE, net,
            "إفراج عن دفعة: ${milestone.title}", milestoneId
        )
        val feeEntry = LedgerEntry(
            idFactory(), now, LedgerEntryType.FEE, fee,
            "عمولة المنصة (${contract.escrow.feeBasisPoints / 100.0}%)", milestoneId
        )
        var updated = contract.appendLedger(releaseEntry).appendLedger(feeEntry)
        updated = updated.copy(
            milestones = updated.milestones.map {
                if (it.id == milestoneId) it.copy(status = MilestoneStatus.RELEASED, releasedAt = now) else it
            }
        )
        if (updated.milestones.all { it.isClosed }) {
            updated = updated.copy(status = ContractStatus.COMPLETED)
        }
        return EscrowResult.Success(updated, listOf(releaseEntry, feeEntry))
    }

    fun refund(
        contract: Contract,
        amount: Money,
        now: Long,
        note: String,
        idFactory: () -> String
    ): EscrowResult {
        if (amount.minor <= 0) return EscrowResult.Rejected("مبلغ الاسترجاع يجب أن يكون أكبر من صفر")
        if (contract.escrow.held < amount) return EscrowResult.Rejected("الرصيد المجمّد أقل من مبلغ الاسترجاع")
        val entry = LedgerEntry(idFactory(), now, LedgerEntryType.REFUND, amount, note)
        return EscrowResult.Success(contract.appendLedger(entry), listOf(entry))
    }

    fun reimburseExpense(
        contract: Contract,
        expenseId: String,
        now: Long,
        idFactory: () -> String
    ): EscrowResult {
        val expense = contract.expenses.firstOrNull { it.id == expenseId }
            ?: return EscrowResult.Rejected("المصروف غير موجود")
        if (!expense.approved) return EscrowResult.Rejected("المصروف غير معتمد من الطرف الملزم بدفعه")
        if (contract.escrow.held < expense.amount) return EscrowResult.Rejected("الرصيد المجمّد لا يغطي المصروف")
        val entry = LedgerEntry(
            idFactory(), now, LedgerEntryType.EXPENSE_REIMBURSEMENT, expense.amount,
            "تعويض مصروف: ${expense.description}"
        )
        return EscrowResult.Success(contract.appendLedger(entry), listOf(entry))
    }

    /** What the provider would receive if every remaining milestone were released today. */
    fun projectedNetPayout(contract: Contract): Money {
        val open = contract.milestones.filterNot { it.isClosed }
            .fold(Money.zero(contract.escrow.currency)) { acc, m -> acc + m.amount }
        return open - open.basisPoints(contract.escrow.feeBasisPoints)
    }

    private fun Contract.appendLedger(entry: LedgerEntry): Contract =
        copy(escrow = escrow.copy(ledger = escrow.ledger + entry))
}
