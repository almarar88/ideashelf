package ai.pacto.app.core

import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.EvidenceItem
import ai.pacto.app.domain.model.EvidenceKind
import ai.pacto.app.domain.model.KeySecurityLevel
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.SignatureRecord
import ai.pacto.app.domain.model.TermKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ContractHasherTest {

    private val base = Contract(
        id = "c1",
        title = "صيانة مكيفات",
        createdAt = 1_700_000_000_000L,
        terms = listOf(ContractTerm(TermKind.PRICE, "القيمة 1200")),
        total = Money.ofMajor(1200.0)
    )

    @Test
    fun `the same contract always hashes the same`() {
        assertEquals(ContractHasher.hash(base), ContractHasher.hash(base.copy()))
    }

    @Test
    fun `clause order does not change the digest`() {
        val a = base.copy(
            terms = listOf(
                ContractTerm(TermKind.PRICE, "القيمة 1200"),
                ContractTerm(TermKind.DEADLINE, "خلال 3 أيام")
            )
        )
        val b = base.copy(
            terms = listOf(
                ContractTerm(TermKind.DEADLINE, "خلال 3 أيام"),
                ContractTerm(TermKind.PRICE, "القيمة 1200")
            )
        )
        assertEquals(ContractHasher.hash(a), ContractHasher.hash(b))
    }

    @Test
    fun `changing an amount changes the digest`() {
        assertNotEquals(ContractHasher.hash(base), ContractHasher.hash(base.copy(total = Money.ofMajor(1300.0))))
    }

    @Test
    fun `swapping a piece of evidence changes the digest`() {
        val withEvidence = base.copy(
            evidence = listOf(EvidenceItem("e1", EvidenceKind.BEFORE_STATE, 1L, contentHash = "aaa"))
        )
        val tampered = withEvidence.copy(
            evidence = listOf(EvidenceItem("e1", EvidenceKind.BEFORE_STATE, 1L, contentHash = "bbb"))
        )
        assertNotEquals(ContractHasher.hash(withEvidence), ContractHasher.hash(tampered))
    }

    @Test
    fun `signatures are excluded so both sides sign identical bytes`() {
        val signed = base.copy(
            signatures = listOf(
                SignatureRecord(
                    partyId = "p1",
                    signedAt = 2L,
                    contractHash = "x",
                    signatureBase64 = "sig",
                    publicKeyBase64 = "key",
                    keyAlias = "alias",
                    securityLevel = KeySecurityLevel.STRONGBOX,
                    biometricConfirmed = true
                )
            )
        )
        assertEquals(ContractHasher.hash(base), ContractHasher.hash(signed))
    }

    @Test
    fun `time stamps chain so the sequence is tamper evident`() {
        val hash = ContractHasher.hash(base)
        val first = ContractHasher.timeStamp(hash, 1_000L)
        val second = ContractHasher.timeStamp(hash, 1_000L, previousStamp = first)
        assertNotEquals(first, second)
        assertEquals(first, ContractHasher.timeStamp(hash, 1_000L))
    }

    @Test
    fun `fingerprint is a readable four group prefix`() {
        val fingerprint = ContractHasher.fingerprint(ContractHasher.hash(base))
        assertEquals(4, fingerprint.split(" ").size)
    }

    @Test
    fun `known digest of empty input matches the SHA-256 specification`() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ContractHasher.sha256Hex(ByteArray(0))
        )
    }
}
