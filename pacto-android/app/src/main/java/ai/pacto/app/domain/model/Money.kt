package ai.pacto.app.domain.model

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Amounts are stored in minor units (halalas, cents, fils) so no arithmetic in the
 * escrow ledger ever goes through a floating point value.
 */
@Serializable
data class Money(
    val minor: Long,
    val currency: String = DEFAULT_CURRENCY
) : Comparable<Money> {

    operator fun plus(other: Money): Money {
        require(other.currency == currency) { "currency mismatch: $currency vs ${other.currency}" }
        return copy(minor = minor + other.minor)
    }

    operator fun minus(other: Money): Money {
        require(other.currency == currency) { "currency mismatch: $currency vs ${other.currency}" }
        return copy(minor = minor - other.minor)
    }

    operator fun times(factor: Double): Money = copy(minor = (minor * factor).roundToLong())

    /** Basis points, rounded half-up. 150 bps of 1000.00 is 15.00. */
    fun basisPoints(bps: Int): Money = copy(minor = (minor * bps + 5_000) / 10_000)

    fun coerceAtLeastZero(): Money = if (minor < 0) copy(minor = 0) else this

    val isZero: Boolean get() = minor == 0L

    override fun compareTo(other: Money): Int {
        require(other.currency == currency) { "currency mismatch: $currency vs ${other.currency}" }
        return minor.compareTo(other.minor)
    }

    /** Plain formatting; the UI appends the currency label. */
    fun formatAmount(): String {
        val sign = if (minor < 0) "-" else ""
        val units = abs(minor) / 100
        val cents = abs(minor) % 100
        val grouped = units.toString().reversed().chunked(3).joinToString(",").reversed()
        return if (cents == 0L) "$sign$grouped" else "$sign$grouped.${cents.toString().padStart(2, '0')}"
    }

    fun format(): String = "${formatAmount()} $currency"

    companion object {
        const val DEFAULT_CURRENCY = "SAR"
        val ZERO = Money(0)
        fun zero(currency: String) = Money(0, currency)
        fun ofMajor(major: Double, currency: String = DEFAULT_CURRENCY) =
            Money((major * 100).roundToLong(), currency)
    }
}
