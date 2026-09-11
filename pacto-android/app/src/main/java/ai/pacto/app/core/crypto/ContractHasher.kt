package ai.pacto.app.core.crypto

import ai.pacto.app.domain.model.Contract
import java.security.MessageDigest

/**
 * Proof of existence. The canonical form is a deterministic, field-ordered rendering of the
 * contract, so the same agreement always produces the same digest on any device, and any edit
 * to any clause, amount or piece of evidence changes it.
 *
 * Signatures are deliberately excluded: the parties sign the canonical form, so it cannot
 * depend on their own signatures.
 */
object ContractHasher {

    fun canonicalForm(contract: Contract): String = buildString {
        appendLine("pacto/v1")
        appendLine("id=${contract.id}")
        appendLine("title=${contract.title.trim()}")
        appendLine("createdAt=${contract.createdAt}")
        appendLine("source=${contract.source}")
        appendLine("total=${contract.total.minor}:${contract.total.currency}")

        contract.parties.sortedBy { it.id }.forEach { party ->
            appendLine(
                "party=${party.id}|${party.role}|${party.displayName.trim()}|" +
                    "${party.identity.method}|${party.identity.documentHash ?: "-"}"
            )
        }

        contract.terms
            .map { "${it.kind}|${it.text.trim().replace('\n', ' ')}" }
            .sorted()
            .forEach { appendLine("term=$it") }

        contract.milestones.sortedBy { it.id }.forEach { m ->
            appendLine("milestone=${m.id}|${m.title.trim()}|${m.amount.minor}|${m.dueAt}|${m.weight}|${m.status}")
        }

        appendLine("escrowFeeBps=${contract.escrow.feeBasisPoints}")
        contract.escrow.ledger.sortedBy { it.id }.forEach { entry ->
            appendLine("ledger=${entry.id}|${entry.type}|${entry.amount.minor}|${entry.at}|${entry.milestoneId ?: "-"}")
        }

        contract.evidence.sortedBy { it.id }.forEach { e ->
            appendLine("evidence=${e.id}|${e.kind}|${e.capturedAt}|${e.contentHash ?: "-"}|${e.serial ?: "-"}")
        }

        contract.expenses.sortedBy { it.id }.forEach { x ->
            appendLine("expense=${x.id}|${x.amount.minor}|${x.bearer}|${x.approved}")
        }

        contract.addenda.sortedBy { it.id }.forEach { a ->
            appendLine("addendum=${a.id}|${a.createdAt}|${a.amountDelta?.minor ?: 0}|${a.deadlineDeltaDays}")
        }

        contract.deadlines.sortedBy { it.id }.forEach { d ->
            appendLine("deadline=${d.id}|${d.kind}|${d.dueAt}")
        }
    }

    fun hash(contract: Contract): String = sha256Hex(canonicalForm(contract).toByteArray(Charsets.UTF_8))

    fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val out = StringBuilder(digest.size * 2)
        digest.forEach { b ->
            val v = b.toInt() and 0xFF
            out.append(HEX[v ushr 4]).append(HEX[v and 0x0F])
        }
        return out.toString()
    }

    /**
     * Binds a contract digest to a point in time. Chaining the previous stamp makes the
     * sequence of stamps tamper evident on its own, before any external timestamp authority.
     */
    fun timeStamp(contractHash: String, atMillis: Long, previousStamp: String? = null): String =
        sha256Hex("${previousStamp ?: "genesis"}|$contractHash|$atMillis".toByteArray(Charsets.UTF_8))

    /** Human-checkable short form: four groups of four hex characters. */
    fun fingerprint(hash: String): String =
        hash.take(16).uppercase().chunked(4).joinToString(" ")

    private val HEX = "0123456789abcdef".toCharArray()
}
