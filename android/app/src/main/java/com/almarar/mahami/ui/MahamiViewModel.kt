package com.almarar.mahami.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Settings
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.ai.AiModel
import com.almarar.mahami.ai.AiService
import com.almarar.mahami.ai.AiSource
import com.almarar.mahami.ai.ChatMessage
import com.almarar.mahami.ai.ExtractedTask
import com.almarar.mahami.ai.SecureKeyStore
import com.almarar.mahami.notify.DailyDigestWorker
import com.almarar.mahami.util.Backup
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

enum class TaskFilter(val label: String) {
    ALL("الكل"), TODAY("اليوم"), UPCOMING("قادمة"), LATE("متأخرة"), DONE("مكتملة")
}

enum class SortMode(val label: String) {
    DUE("حسب الموعد"), PRIORITY("حسب الأولوية"), PROGRESS("حسب الإنجاز")
}

data class TaskStats(
    val total: Int = 0,
    val done: Int = 0,
    val today: Int = 0,
    val late: Int = 0,
    val upcoming: Int = 0,
    val completionRate: Float = 0f
)

class MahamiViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = TaskRepository.get(app)
    private val prefs = Prefs.get(app)
    private val keyStore = SecureKeyStore.get(app)
    private val ai = AiService.get(app) { AiModel.fromId(settings.value.aiModelId) }

    val settings: StateFlow<Settings> = prefs.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, Settings())

    val tasks: StateFlow<List<Task>> = repo.tasks
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _filter = MutableStateFlow(TaskFilter.ALL)
    val filter = _filter.asStateFlow()

    private val _sort = MutableStateFlow(SortMode.DUE)
    val sort = _sort.asStateFlow()

    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate = _selectedDate.asStateFlow()

    private val _month = MutableStateFlow(YearMonth.from(LocalDate.now()))
    val month = _month.asStateFlow()

    val visibleTasks: StateFlow<List<Task>> =
        combine(tasks, _filter, _sort, _query) { list, filter, sort, query ->
            val today = LocalDate.now()
            list.asSequence()
                .filter { t ->
                    when (filter) {
                        TaskFilter.ALL -> true
                        TaskFilter.TODAY -> t.dueDate == today && t.status != TaskStatus.DONE
                        TaskFilter.UPCOMING -> t.dueDate.isAfter(today) && t.status != TaskStatus.DONE
                        TaskFilter.LATE -> t.isOverdue()
                        TaskFilter.DONE -> t.status == TaskStatus.DONE
                    }
                }
                .filter { t ->
                    query.isBlank() || t.title.contains(query, true) ||
                        t.details.contains(query, true) || t.category.contains(query, true) ||
                        t.owner.contains(query, true)
                }
                .sortedWith(
                    when (sort) {
                        SortMode.DUE -> compareByDescending<Task> { it.pinned }
                            .thenBy { it.dueDate }.thenBy { it.dueTime }
                        SortMode.PRIORITY -> compareByDescending<Task> { it.pinned }
                            .thenBy { it.priority.ordinal }.thenBy { it.dueDate }
                        SortMode.PROGRESS -> compareByDescending<Task> { it.pinned }
                            .thenByDescending { it.progress }.thenBy { it.dueDate }
                    }
                )
                .toList()
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val stats: StateFlow<TaskStats> = tasks.combine(_selectedDate) { list, _ ->
        val today = LocalDate.now()
        val done = list.count { it.status == TaskStatus.DONE }
        TaskStats(
            total = list.size,
            done = done,
            today = list.count { it.dueDate == today && it.status != TaskStatus.DONE },
            late = list.count { it.isOverdue() },
            upcoming = list.count { it.dueDate.isAfter(today) && it.status != TaskStatus.DONE },
            completionRate = if (list.isEmpty()) 0f else done.toFloat() / list.size
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), TaskStats())

    init {
        viewModelScope.launch {
            repo.seedIfEmpty()
            repo.refreshSideEffects()
            refreshCloudState()
            DailyDigestWorker.schedule(app, prefsHour())
        }
    }

    private suspend fun prefsHour(): Int = prefs.settings.first().digestHour

    fun tasksOn(date: LocalDate): List<Task> = tasks.value.filter { it.dueDate == date }

    fun setFilter(f: TaskFilter) { _filter.value = f }
    fun setSort(s: SortMode) { _sort.value = s }
    fun setQuery(q: String) { _query.value = q }
    fun selectDate(d: LocalDate) { _selectedDate.value = d; _month.value = YearMonth.from(d) }
    fun changeMonth(delta: Long) { _month.value = _month.value.plusMonths(delta) }

    fun toggleDone(task: Task) = viewModelScope.launch { repo.toggleDone(task) }
    fun togglePinned(task: Task) = viewModelScope.launch { repo.togglePinned(task) }
    fun toggleSubTask(task: Task, index: Int) = viewModelScope.launch { repo.toggleSubTask(task, index) }
    fun setStatus(task: Task, status: TaskStatus) = viewModelScope.launch { repo.setStatus(task, status) }
    fun delete(task: Task) = viewModelScope.launch { repo.delete(task) }
    fun save(task: Task, onSaved: (Long) -> Unit = {}) = viewModelScope.launch {
        onSaved(repo.upsert(task))
    }
    fun restoreSeed() = viewModelScope.launch { repo.resetToSeed() }

    fun setOnboarded(v: Boolean) = viewModelScope.launch { prefs.setOnboarded(v) }
    fun setUserName(v: String) = viewModelScope.launch { prefs.setUserName(v) }
    fun setDarkMode(v: Boolean) = viewModelScope.launch { prefs.setDarkMode(v) }
    fun setNotifications(v: Boolean) = viewModelScope.launch {
        prefs.setNotifications(v)
        repo.refreshSideEffects()
    }
    fun setDailyDigest(v: Boolean) = viewModelScope.launch { prefs.setDailyDigest(v) }
    fun setDigestHour(hour: Int) = viewModelScope.launch {
        prefs.setDigestHour(hour)
        DailyDigestWorker.schedule(getApplication(), hour)
    }

    // ---------- إجراءات سريعة على المهام ----------

    fun postpone(task: Task, days: Long) = viewModelScope.launch { repo.postpone(task, days) }

    // ---------- المساعد الذكي ----------

    private val _assistant = MutableStateFlow(AssistantState())
    val assistant = _assistant.asStateFlow()

    private val _extraction = MutableStateFlow(ExtractionState())
    val extraction = _extraction.asStateFlow()

    private val _taskAi = MutableStateFlow(TaskAiState())
    val taskAi = _taskAi.asStateFlow()

    fun refreshCloudState() {
        _assistant.value = _assistant.value.copy(cloudReady = ai.isCloudReady())
    }

    fun ask(question: String) {
        val text = question.trim()
        if (text.isBlank() || _assistant.value.busy) return
        val history = _assistant.value.messages
        _assistant.value = _assistant.value.copy(
            messages = history + ChatMessage(true, text) + ChatMessage(false, "", pending = true),
            busy = true,
            notice = ""
        )
        viewModelScope.launch {
            val result = ai.chat(text, history, repo.all())
            val withoutPending = _assistant.value.messages.dropLast(1)
            _assistant.value = _assistant.value.copy(
                messages = withoutPending + ChatMessage(false, result.value),
                busy = false,
                lastSource = result.source,
                notice = result.note,
                cloudReady = ai.isCloudReady()
            )
        }
    }

    fun clearChat() {
        _assistant.value = _assistant.value.copy(messages = emptyList(), notice = "")
    }

    fun buildDailyPlan() {
        if (_assistant.value.busy) return
        _assistant.value = _assistant.value.copy(busy = true, notice = "")
        viewModelScope.launch {
            val result = ai.dailyPlan(repo.all())
            _assistant.value = _assistant.value.copy(
                plan = result.value,
                busy = false,
                lastSource = result.source,
                notice = result.note,
                cloudReady = ai.isCloudReady()
            )
        }
    }

    fun reviewRisks() {
        if (_assistant.value.busy) return
        _assistant.value = _assistant.value.copy(busy = true, notice = "")
        viewModelScope.launch {
            val result = ai.risks(repo.all())
            _assistant.value = _assistant.value.copy(
                risks = result.value,
                busy = false,
                lastSource = result.source,
                notice = result.note,
                cloudReady = ai.isCloudReady()
            )
        }
    }

    fun buildWeeklySummary() {
        if (_assistant.value.busy) return
        _assistant.value = _assistant.value.copy(busy = true, notice = "")
        viewModelScope.launch {
            val result = ai.weeklySummary(repo.all())
            _assistant.value = _assistant.value.copy(
                summary = result.value,
                busy = false,
                lastSource = result.source,
                notice = result.note,
                cloudReady = ai.isCloudReady()
            )
        }
    }

    // ---------- استخراج المهام من نص ----------

    fun setExtractionInput(text: String) {
        _extraction.value = _extraction.value.copy(input = text, done = false)
    }

    fun extractTasks() {
        val text = _extraction.value.input.trim()
        if (text.isBlank() || _extraction.value.busy) return
        _extraction.value = _extraction.value.copy(busy = true, notice = "", done = false)
        viewModelScope.launch {
            val result = ai.extractTasks(text)
            _extraction.value = _extraction.value.copy(
                results = result.value,
                busy = false,
                source = result.source,
                notice = result.note
            )
        }
    }

    fun toggleExtracted(index: Int) {
        val list = _extraction.value.results.toMutableList()
        if (index !in list.indices) return
        list[index] = list[index].copy(selected = !list[index].selected)
        _extraction.value = _extraction.value.copy(results = list)
    }

    fun saveExtracted(onDone: () -> Unit = {}) {
        val chosen = _extraction.value.results.filter { it.selected }
        if (chosen.isEmpty()) return
        viewModelScope.launch {
            repo.addAll(chosen.map { it.toTask() })
            _extraction.value = ExtractionState(done = true)
            onDone()
        }
    }

    fun resetExtraction() { _extraction.value = ExtractionState() }

    private fun ExtractedTask.toTask(): Task = Task(
        title = title,
        details = details,
        category = category,
        owner = owner,
        dueDate = dueDate,
        dueTime = dueTime,
        priority = priority,
        flexibleDeadline = !dateWasExplicit,
        warning = if (dateWasExplicit) "" else "التاريخ مستنتج تلقائياً — يُستحسن تأكيده.",
        subTasks = steps.map { com.almarar.mahami.data.SubTask(it) },
        reminderOffsetsDays = listOf(1, 0)
    )

    // ---------- ذكاء على مستوى المهمة ----------

    fun suggestSteps(task: Task) {
        if (_taskAi.value.busy) return
        _taskAi.value = TaskAiState(taskId = task.id, busy = true)
        viewModelScope.launch {
            val result = ai.suggestSteps(task)
            _taskAi.value = TaskAiState(
                taskId = task.id,
                steps = result.value,
                source = result.source,
                notice = result.note
            )
        }
    }

    fun applySuggestedSteps(task: Task) {
        val steps = _taskAi.value.steps
        if (steps.isEmpty()) return
        val existing = task.subTasks.map { it.title }
        val merged = task.subTasks + steps
            .filter { it !in existing }
            .map { com.almarar.mahami.data.SubTask(it) }
        viewModelScope.launch {
            repo.upsert(task.copy(subTasks = merged))
            _taskAi.value = TaskAiState()
        }
    }

    fun draftMessage(task: Task, formal: Boolean) {
        if (_taskAi.value.busy) return
        _taskAi.value = TaskAiState(taskId = task.id, busy = true)
        viewModelScope.launch {
            val result = ai.draftMessage(task, formal)
            _taskAi.value = TaskAiState(
                taskId = task.id,
                message = result.value,
                source = result.source,
                notice = result.note
            )
        }
    }

    fun clearTaskAi() { _taskAi.value = TaskAiState() }

    // ---------- مفتاح Claude ----------

    fun maskedApiKey(): String? = keyStore.maskedKey()

    fun setApiKey(key: String) {
        keyStore.apiKey = key
        refreshCloudState()
    }

    fun clearApiKey() {
        keyStore.apiKey = null
        refreshCloudState()
    }

    fun setAiModel(model: AiModel) = viewModelScope.launch { prefs.setAiModel(model.id) }
    fun setAiAutoReview(v: Boolean) = viewModelScope.launch { prefs.setAiAutoReview(v) }

    private val _connectionTest = MutableStateFlow("")
    val connectionTest = _connectionTest.asStateFlow()

    fun testConnection() {
        _connectionTest.value = "جارٍ الاختبار..."
        viewModelScope.launch {
            _connectionTest.value = try {
                val reply = ai.testConnection()
                "تم الاتصال بنجاح ✓ (${reply.trim()})"
            } catch (e: Exception) {
                e.message ?: "فشل الاتصال"
            }
            refreshCloudState()
        }
    }

    fun clearConnectionTest() { _connectionTest.value = "" }

    // ---------- النسخ الاحتياطي والتقويم ----------

    private val _backupNotice = MutableStateFlow("")
    val backupNotice = _backupNotice.asStateFlow()

    fun exportBackup() = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val uri = Backup.writeShareable(app, "mahami-backup.json", Backup.toJson(repo.all()))
            Backup.share(app, uri, "application/json", "نسخة احتياطية من المهام")
        }.onFailure { _backupNotice.value = "تعذّر التصدير: ${it.message}" }
    }

    fun exportCalendar() = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val uri = Backup.writeShareable(app, "mahami.ics", Backup.toIcs(repo.all()))
            Backup.share(app, uri, "text/calendar", "تصدير المهام إلى التقويم")
        }.onFailure { _backupNotice.value = "تعذّر التصدير: ${it.message}" }
    }

    fun importBackup(uri: Uri, replace: Boolean) = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val imported = Backup.fromJson(Backup.readText(app, uri))
            if (imported.isEmpty()) {
                _backupNotice.value = "الملف لا يحتوي مهاماً صالحة."
            } else {
                if (replace) repo.replaceAll(imported) else repo.addAll(imported)
                _backupNotice.value = "تم استيراد ${imported.size} مهمة."
            }
        }.onFailure { _backupNotice.value = "تعذّر الاستيراد: ${it.message}" }
    }

    fun clearBackupNotice() { _backupNotice.value = "" }
}
