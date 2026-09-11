package ai.pacto.app.domain

import ai.pacto.app.domain.model.Money
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MoneyTest {

    @Test
    fun `basis points round half up`() {
        // 1.25% of 1,200.00 is 15.00 exactly.
        assertEquals(Money.ofMajor(15.0), Money.ofMajor(1200.0).basisPoints(125))
        // 1.25% of 333.33 is 4.1666…, which must round to 4.17 and never truncate to 4.16.
        assertEquals(Money.ofMajor(4.17), Money.ofMajor(333.33).basisPoints(125))
    }

    @Test
    fun `fee never exceeds the amount it is taken from`() {
        val amount = Money.ofMajor(900.0)
        val fee = amount.basisPoints(150)
        assertTrue(fee < amount)
        assertEquals(Money.ofMajor(13.5), fee)
    }

    @Test
    fun `formatting groups thousands and keeps two decimals only when needed`() {
        assertEquals("8,500", Money.ofMajor(8500.0).formatAmount())
        assertEquals("296.25", Money.ofMajor(296.25).formatAmount())
    }

    @Test(expected = IllegalArgumentException::class)
    fun `mixing currencies is rejected`() {
        Money(100, "SAR") + Money(100, "AED")
    }
}
