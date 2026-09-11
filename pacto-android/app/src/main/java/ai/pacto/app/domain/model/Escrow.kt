package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class LedgerEntryType { DEPOSIT, RELEASE, REFUND, FEE, EXPENSE_REIMBURSEMENT }

@Serializable
data class LedgerEntry(
    val id: String,
    val at: Long,
    val type: LedgerEntryType,
    val amount: Money,
    val note: String,
    val milestoneId: String? = null
)

/**
 * Escrow balances are derived from the ledger, never stored as a mutable total, so the
 * ledger is always the single source of truth for what is owed to whom.
 */
@Serializable
data class EscrowAccount(
    val currency: String = Money.DEFAULT_CURRENCY,
    /** Platform fee in basis points: 100 bps = 1%, 150 bps = 1.5%. */
    val feeBasisPoints: Int = 125,
    val ledger: List<LedgerEntry> = emptyList()
) {
    private fun sumOf(type: LedgerEntryType): Money =
        ledger.filter { it.type == type }
            .fold(Money.zero(currency)) { acc, entry -> acc + entry.amount }

    val deposited: Money get() = sumOf(LedgerEntryType.DEPOSIT)
    val released: Money get() = sumOf(LedgerEntryType.RELEASE)
    val refunded: Money get() = sumOf(LedgerEntryType.REFUND)
    val feesCharged: Money get() = sumOf(LedgerEntryType.FEE)
    val reimbursed: Money get() = sumOf(LedgerEntryType.EXPENSE_REIMBURSEMENT)

    /** Money still frozen inside the app and payable to neither side yet. */
    val held: Money
        get() = (deposited - released - refunded - feesCharged - reimbursed).coerceAtLeastZero()
}
