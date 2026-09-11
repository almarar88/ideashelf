package ai.pacto.app.data

import ai.pacto.app.domain.model.Contract
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.builtins.ListSerializer

/**
 * The single in-memory source of truth for contracts, backed by an on-device file. Nothing
 * here talks to a network: the whole contract book stays on the phone unless the owner
 * exports it deliberately.
 */
class ContractRepository(private val store: JsonStore) {

    private val _contracts = MutableStateFlow<List<Contract>>(emptyList())
    val contracts: StateFlow<List<Contract>> = _contracts.asStateFlow()

    private val writeLock = Mutex()

    suspend fun load(seedIfEmpty: () -> List<Contract>) {
        val text = store.readText()
        val loaded = text?.let {
            runCatching {
                store.encoder().decodeFromString(ListSerializer(Contract.serializer()), it)
            }.getOrNull()
        }
        if (loaded != null) {
            _contracts.value = loaded
        } else {
            _contracts.value = seedIfEmpty()
            persist()
        }
    }

    fun byId(id: String): Contract? = _contracts.value.firstOrNull { it.id == id }

    suspend fun upsert(contract: Contract) = writeLock.withLock {
        val current = _contracts.value
        val index = current.indexOfFirst { it.id == contract.id }
        _contracts.value = if (index >= 0) {
            current.toMutableList().apply { set(index, contract) }
        } else {
            current + contract
        }
        persist()
    }

    /** Read-modify-write under the same lock that guards persistence. */
    suspend fun mutate(id: String, transform: (Contract) -> Contract): Contract? = writeLock.withLock {
        val current = _contracts.value
        val index = current.indexOfFirst { it.id == id }
        if (index < 0) return@withLock null
        val updated = transform(current[index])
        _contracts.value = current.toMutableList().apply { set(index, updated) }
        persist()
        updated
    }

    suspend fun delete(id: String) = writeLock.withLock {
        _contracts.value = _contracts.value.filterNot { it.id == id }
        persist()
    }

    private suspend fun persist() {
        val encoded = store.encoder()
            .encodeToString(ListSerializer(Contract.serializer()), _contracts.value)
        store.writeText(encoded)
    }
}
