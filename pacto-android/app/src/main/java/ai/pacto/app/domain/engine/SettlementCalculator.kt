package ai.pacto.app.domain.engine

import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.MilestoneStatus
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.PartyRole

data class Settlement(
    val completionPercent: Int,
    val providerEntitlement: Money,
    val platformFee: Money,
    val providerNet: Money,
    val clientRefund: Money,
    val expenseAdjustment: Money,
    val explanation: List<String>
)

/**
 * Used when both sides walk away on good terms: work already delivered is paid for by weight,
 * approved expenses are settled, and whatever is left goes back to the client.
 */
object SettlementCalculator {

    fun calculate(contract: Contract): Settlement {
        val currency = contract.escrow.currency
        val zero = Money.zero(currency)
        val held = contract.escrow.held

        val totalWeight = contract.milestones.sumOf { it.weight }
        val deliveredWeight = contract.milestones
            .filter { it.status == MilestoneStatus.DELIVERED || it.status == MilestoneStatus.RELEASED }
            .sumOf { it.weight }

        val percent = if (totalWeight == 0) 0 else (deliveredWeight * 100) / totalWeight

        // Milestones already released are settled money; only the frozen balance is in play.
        val unreleasedDeliveredValue = contract.milestones
            .filter { it.status == MilestoneStatus.DELIVERED }
            .fold(zero) { acc, m -> acc + m.amount }

        val expenseTotals = ExpenseAllocator.totalsByBearer(contract)
        // Costs the client agreed to bear but the provider paid out of pocket.
        val expenseAdjustment = expenseTotals[PartyRole.CLIENT] ?: zero

        var providerEntitlement = unreleasedDeliveredValue + expenseAdjustment
        if (providerEntitlement > held) providerEntitlement = held

        val fee = providerEntitlement.basisPoints(contract.escrow.feeBasisPoints)
        val providerNet = providerEntitlement - fee
        val clientRefund = (held - providerEntitlement).coerceAtLeastZero()

        val explanation = buildList {
            add("نسبة الإنجاز الموثقة $percent% بحسب أوزان المراحل المسلَّمة.")
            if (!unreleasedDeliveredValue.isZero) {
                add("قيمة المراحل المسلَّمة وغير المدفوعة: ${unreleasedDeliveredValue.format()}.")
            }
            if (!expenseAdjustment.isZero) {
                add("مصاريف معتمدة على الطرف الطالب تُرد للمنفذ: ${expenseAdjustment.format()}.")
            }
            add("عمولة المنصة على المستحق: ${fee.format()}.")
            add("يُرد للطرف الطالب: ${clientRefund.format()}.")
        }

        return Settlement(
            completionPercent = percent,
            providerEntitlement = providerEntitlement,
            platformFee = fee,
            providerNet = providerNet,
            clientRefund = clientRefund,
            expenseAdjustment = expenseAdjustment,
            explanation = explanation
        )
    }
}
