package ai.pacto.app.ui.state

import ai.pacto.app.PactoApplication
import ai.pacto.app.PactoContainer
import ai.pacto.app.core.crypto.ContractHasher
import ai.pacto.app.data.AppSettings
import ai.pacto.app.data.Plan
import ai.pacto.app.data.SettingsState
import ai.pacto.app.domain.engine.ArbitrationEngine
import ai.pacto.app.domain.engine.EscrowEngine
import ai.pacto.app.domain.engine.EscrowResult
import ai.pacto.app.domain.engine.ExpenseAllocator
import ai.pacto.app.domain.engine.GeoFenceEvaluator
import ai.pacto.app.domain.engine.LoopholeDetector
import ai.pacto.app.domain.engine.Settlement
import ai.pacto.app.domain.engine.SettlementCalculator
import ai.pacto.app.domain.engine.TrustScoreCalculator
import ai.pacto.app.domain.model.Addendum
import ai.pacto.app.domain.model.Contract
import ai.pacto.app.domain.model.ContractStatus
import ai.pacto.app.domain.model.ContractTerm
import ai.pacto.app.domain.model.DisputeCase
import ai.pacto.app.domain.model.DisputeStatus
import ai.pacto.app.domain.model.EvidenceItem
import ai.pacto.app.domain.model.GeoPoint
import ai.pacto.app.domain.model.IdentityProof
import ai.pacto.app.domain.model.Money
import ai.pacto.app.domain.model.Priority
import ai.pacto.app.domain.model.SignatureRecord
import ai.pacto.app.domain.model.TrustScore
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import java.util.Calendar
import java.util.UUID

data class Obligation(
    val contractId: String,
    val title: String,
    val timeLabel: String,
    val caption: String,
    val priority: Priority,
    val amount: Money?,
    val milestoneId: String?
)

data class HomeState(
    val trustScore: TrustScore = TrustScore.EMPTY,
    val activeContracts: Int = 0,
    val heldTotal: Money = Money.ZERO,
    val obligations: List<Obligation> = emptyList(),
    val settings: SettingsState = SettingsState()
)

/**
 * One view model for the contract book. Screens read derived state; every action funnels
 * through the domain engines so the rules live in one testable place.
 */
class PactoViewModel(application: Application) : AndroidViewModel(application) {

    private val container: PactoContainer = (application as PactoApplication).container
    private val repository = container.contractRepository
    private val settings: AppSettings = container.appSettings

    val contracts: StateFlow<List<Contract>> = repository.contracts
    val settingsState: StateFlow<SettingsState> = settings.state

    private val _selectedDate = MutableStateFlow(startOfToday())
    val selectedDate: StateFlow<Long> = _selectedDate.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    val homeState: StateFlow<HomeState> =
        combine(contracts, settingsState, selectedDate) { list, config, day ->
            HomeState(
                trustScore = TrustScoreCalculator.calculate(config.currentPartyId, list),
                activeContracts = list.count { it.status == ContractStatus.ACTIVE },
                heldTotal = list.fold(Money.zero(config.currency)) { acc, contract ->
                    if (contract.escrow.currency == config.currency) acc + contract.escrow.held else acc
                },
                obligations = obligationsFor(list, day),
                settings = config
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeState())

    fun contract(id: String): Contract? = repository.byId(id)

    fun selectDate(millis: Long) {
        _selectedDate.value = millis
    }

    fun consumeMessage() {
        _message.value = null
    }

    fun loopholes(contract: Contract) = LoopholeDetector.detect(contract)

    fun settlementPreview(contract: Contract): Settlement = SettlementCalculator.calculate(contract)

    fun trustScoreOf(partyId: String): TrustScore =
        TrustScoreCalculator.calculate(partyId, contracts.value)

    // ---- contract lifecycle ------------------------------------------------

    fun saveDraft(contract: Contract, onSaved: (Contract) -> Unit = {}) {
        viewModelScope.launch {
            repository.upsert(contract)
            settings.recordContractCreated()
            onSaved(contract)
        }
    }

    fun addTerm(contractId: String, term: ContractTerm) = mutate(contractId) { contract ->
        contract.copy(terms = contract.terms + term)
    }

    /** Records a signature and, once both sides have signed, seals and time-stamps the contract. */
    fun recordSignature(contractId: String, record: SignatureRecord) = mutate(contractId) { contract ->
        val withSignature = contract.copy(
            signatures = contract.signatures.filterNot { it.partyId == record.partyId } + record
        )
        if (withSignature.isFullySigned) {
            val hash = ContractHasher.hash(withSignature)
            val now = System.currentTimeMillis()
            withSignature.copy(
                status = ContractStatus.ACTIVE,
                sealedHash = ContractHasher.timeStamp(hash, now),
                sealedAt = now
            )
        } else {
            withSignature.copy(status = ContractStatus.AWAITING_SIGNATURE)
        }
    }

    fun fundEscrow(contractId: String, amount: Money) = withEngine(contractId) { contract ->
        EscrowEngine.fund(contract, amount, System.currentTimeMillis(), ::newId)
    }

    fun markDelivered(contractId: String, milestoneId: String) = withEngine(contractId) { contract ->
        EscrowEngine.markDelivered(contract, milestoneId, System.currentTimeMillis())
    }

    fun releaseMilestone(contractId: String, milestoneId: String) = withEngine(contractId) { contract ->
        EscrowEngine.release(contract, milestoneId, System.currentTimeMillis(), ::newId)
    }

    fun refund(contractId: String, amount: Money, note: String) = withEngine(contractId) { contract ->
        EscrowEngine.refund(contract, amount, System.currentTimeMillis(), note, ::newId)
    }

    // ---- evidence, expenses, addenda ---------------------------------------

    fun addEvidence(contractId: String, item: EvidenceItem) = mutate(contractId) { contract ->
        val linked = if (item.milestoneId != null) {
            contract.copy(
                milestones = contract.milestones.map { milestone ->
                    if (milestone.id == item.milestoneId) {
                        milestone.copy(evidenceIds = milestone.evidenceIds + item.id)
                    } else {
                        milestone
                    }
                }
            )
        } else {
            contract
        }
        linked.copy(evidence = linked.evidence + item)
    }

    fun addExpense(contractId: String, description: String, amount: Money, receiptEvidenceId: String?) =
        mutate(contractId) { contract ->
            val expense = ExpenseAllocator.build(
                contract = contract,
                id = newId(),
                description = description,
                amount = amount,
                incurredAt = System.currentTimeMillis(),
                receiptEvidenceId = receiptEvidenceId
            )
            _message.value = expense.allocationReason
            contract.copy(expenses = contract.expenses + expense)
        }

    fun approveExpense(contractId: String, expenseId: String) = mutate(contractId) { contract ->
        contract.copy(
            expenses = contract.expenses.map {
                if (it.id == expenseId) it.copy(approved = true) else it
            }
        )
    }

    fun addAddendum(contractId: String, transcript: String, changes: List<ContractTerm>, amountDelta: Money?) =
        mutate(contractId) { contract ->
            val addendum = Addendum(
                id = newId(),
                createdAt = System.currentTimeMillis(),
                transcript = transcript,
                changes = changes,
                amountDelta = amountDelta,
                acceptedByPartyIds = listOf(settingsState.value.currentPartyId)
            )
            contract.copy(
                addenda = contract.addenda + addendum,
                terms = contract.terms + changes,
                total = amountDelta?.let { contract.total + it } ?: contract.total
            )
        }

    fun acceptAddendum(contractId: String, addendumId: String, partyId: String) = mutate(contractId) { contract ->
        contract.copy(
            addenda = contract.addenda.map {
                if (it.id == addendumId && partyId !in it.acceptedByPartyIds) {
                    it.copy(acceptedByPartyIds = it.acceptedByPartyIds + partyId)
                } else {
                    it
                }
            }
        )
    }

    // ---- identity, location -------------------------------------------------

    fun setIdentity(contractId: String, partyId: String, proof: IdentityProof) = mutate(contractId) { contract ->
        contract.copy(
            parties = contract.parties.map {
                if (it.id == partyId) it.copy(identity = proof) else it
            }
        )
    }

    /** Confirms arrival at the milestone's fence and records the fix as delivery proof. */
    fun checkInAt(contractId: String, milestoneId: String, position: GeoPoint, onResult: (Boolean, String) -> Unit) {
        val contract = repository.byId(contractId) ?: return
        val milestone = contract.milestones.firstOrNull { it.id == milestoneId }
        val fence = milestone?.geoFence
        if (fence == null) {
            onResult(false, "لا يوجد موقع محدد لهذه المرحلة")
            return
        }
        val distance = GeoFenceEvaluator.distanceMeters(fence, position)
        val inside = GeoFenceEvaluator.isInside(fence, position)
        if (inside) {
            addEvidence(
                contractId,
                EvidenceItem(
                    id = newId(),
                    kind = ai.pacto.app.domain.model.EvidenceKind.DELIVERY_PROOF,
                    capturedAt = System.currentTimeMillis(),
                    note = "تسجيل وصول إلى ${fence.label ?: "موقع التنفيذ"}",
                    geo = position,
                    capturedByPartyId = settingsState.value.currentPartyId,
                    milestoneId = milestoneId
                )
            )
            onResult(true, "تم إثبات الوصول للموقع")
        } else {
            onResult(false, "أنت على بعد ${distance.toInt()} متر من الموقع المحدد")
        }
    }

    // ---- disputes ------------------------------------------------------------

    fun openDispute(contractId: String, claim: String) = mutate(contractId) { contract ->
        contract.copy(
            status = ContractStatus.IN_DISPUTE,
            dispute = DisputeCase(
                id = newId(),
                openedByPartyId = settingsState.value.currentPartyId,
                openedAt = System.currentTimeMillis(),
                claim = claim
            )
        )
    }

    fun runArbitrator(contractId: String) = mutate(contractId) { contract ->
        val dispute = contract.dispute ?: return@mutate contract
        val report = ArbitrationEngine.arbitrate(contract, System.currentTimeMillis())
        contract.copy(dispute = dispute.copy(report = report, status = DisputeStatus.REPORT_READY))
    }

    /** Both sides accepting turns the proposal into real ledger movements. */
    fun acceptSettlement(contractId: String) {
        viewModelScope.launch {
            val contract = repository.byId(contractId) ?: return@launch
            val report = contract.dispute?.report ?: return@launch
            val partyId = settingsState.value.currentPartyId
            val accepted = (contract.dispute.acceptedByPartyIds + partyId).distinct()
            var updated = contract.copy(dispute = contract.dispute.copy(acceptedByPartyIds = accepted))

            if (contract.parties.all { it.id in accepted }) {
                val now = System.currentTimeMillis()
                if (!report.providerAmount.isZero) {
                    val fee = report.providerAmount.basisPoints(contract.escrow.feeBasisPoints)
                    updated = updated.copy(
                        escrow = updated.escrow.copy(
                            ledger = updated.escrow.ledger + listOf(
                                ai.pacto.app.domain.model.LedgerEntry(
                                    newId(), now,
                                    ai.pacto.app.domain.model.LedgerEntryType.RELEASE,
                                    report.providerAmount - fee,
                                    "تسوية نزاع: حصة المنفذ"
                                ),
                                ai.pacto.app.domain.model.LedgerEntry(
                                    newId(), now,
                                    ai.pacto.app.domain.model.LedgerEntryType.FEE,
                                    fee,
                                    "عمولة المنصة على التسوية"
                                )
                            )
                        )
                    )
                }
                if (!report.clientAmount.isZero) {
                    updated = updated.copy(
                        escrow = updated.escrow.copy(
                            ledger = updated.escrow.ledger + ai.pacto.app.domain.model.LedgerEntry(
                                newId(), now,
                                ai.pacto.app.domain.model.LedgerEntryType.REFUND,
                                report.clientAmount,
                                "تسوية نزاع: استرجاع للطرف الطالب"
                            )
                        )
                    )
                }
                updated = updated.copy(
                    status = ContractStatus.SETTLED,
                    dispute = updated.dispute?.copy(status = DisputeStatus.SETTLED)
                )
                _message.value = "تم تنفيذ التسوية وتوزيع المبلغ المجمّد"
            } else {
                _message.value = "تم تسجيل موافقتك، بانتظار الطرف الآخر"
            }
            repository.upsert(updated)
        }
    }

    fun escalateDispute(contractId: String) = mutate(contractId) { contract ->
        contract.copy(dispute = contract.dispute?.copy(status = DisputeStatus.ESCALATED))
    }

    /** Mutual, no-fault exit: pay for what was delivered, refund the rest. */
    fun settleMutually(contractId: String) {
        viewModelScope.launch {
            val contract = repository.byId(contractId) ?: return@launch
            val settlement = SettlementCalculator.calculate(contract)
            val now = System.currentTimeMillis()
            val entries = buildList {
                if (!settlement.providerNet.isZero) {
                    add(
                        ai.pacto.app.domain.model.LedgerEntry(
                            newId(), now,
                            ai.pacto.app.domain.model.LedgerEntryType.RELEASE,
                            settlement.providerNet,
                            "إلغاء ودّي: مستحق المنفذ عن ${settlement.completionPercent}% منجزة"
                        )
                    )
                    add(
                        ai.pacto.app.domain.model.LedgerEntry(
                            newId(), now,
                            ai.pacto.app.domain.model.LedgerEntryType.FEE,
                            settlement.platformFee,
                            "عمولة المنصة على التسوية الودية"
                        )
                    )
                }
                if (!settlement.clientRefund.isZero) {
                    add(
                        ai.pacto.app.domain.model.LedgerEntry(
                            newId(), now,
                            ai.pacto.app.domain.model.LedgerEntryType.REFUND,
                            settlement.clientRefund,
                            "إلغاء ودّي: استرجاع للطرف الطالب"
                        )
                    )
                }
            }
            repository.upsert(
                contract.copy(
                    status = ContractStatus.CANCELLED,
                    escrow = contract.escrow.copy(ledger = contract.escrow.ledger + entries)
                )
            )
            _message.value = settlement.explanation.joinToString(" ")
        }
    }

    // ---- export, settings ----------------------------------------------------

    fun exportCourtFile(contractId: String, onReady: (File) -> Unit) {
        viewModelScope.launch {
            val contract = repository.byId(contractId) ?: return@launch
            val file = container.courtFileExporter.export(contract)
            repository.mutate(contractId) { current ->
                current.copy(dispute = current.dispute?.copy(courtFilePath = file.absolutePath))
            }
            onReady(file)
        }
    }

    fun setPlan(plan: Plan) = settings.setPlan(plan)
    fun setOverlayEnabled(enabled: Boolean) = settings.setOverlayEnabled(enabled)
    fun setFee(bps: Int) = settings.setFeeBasisPoints(bps)

    // ---- helpers -------------------------------------------------------------

    private fun mutate(contractId: String, transform: (Contract) -> Contract) {
        viewModelScope.launch { repository.mutate(contractId, transform) }
    }

    private fun withEngine(contractId: String, action: (Contract) -> EscrowResult) {
        viewModelScope.launch {
            val contract = repository.byId(contractId) ?: return@launch
            when (val result = action(contract)) {
                is EscrowResult.Success -> {
                    repository.upsert(result.contract)
                    result.entries.firstOrNull()?.let { _message.value = it.note }
                }

                is EscrowResult.Rejected -> _message.value = result.reason
            }
        }
    }

    private fun obligationsFor(list: List<Contract>, dayStart: Long): List<Obligation> {
        val dayEnd = dayStart + DAY_MS
        val items = mutableListOf<Obligation>()
        list.forEach { contract ->
            contract.milestones
                .filter { !it.isClosed && it.dueAt in dayStart until dayEnd }
                .forEach { milestone ->
                    items += Obligation(
                        contractId = contract.id,
                        title = milestone.title,
                        timeLabel = TimeFormats.timeRange(milestone.dueAt),
                        caption = contract.title,
                        priority = contract.priority,
                        amount = milestone.amount,
                        milestoneId = milestone.id
                    )
                }
            contract.deadlines
                .filter { it.acknowledgedAt == null && it.dueAt in dayStart until dayEnd }
                .forEach { deadline ->
                    items += Obligation(
                        contractId = contract.id,
                        title = deadline.label,
                        timeLabel = TimeFormats.timeRange(deadline.dueAt),
                        caption = contract.title,
                        priority = contract.priority,
                        amount = null,
                        milestoneId = deadline.milestoneId
                    )
                }
        }
        return items.sortedBy { it.timeLabel }
    }

    fun obligationCount(dayStart: Long): Int = obligationsFor(contracts.value, dayStart).size

    private fun newId(): String = UUID.randomUUID().toString()

    companion object {
        const val DAY_MS = 24 * 60 * 60 * 1000L

        fun startOfToday(): Long = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
}
