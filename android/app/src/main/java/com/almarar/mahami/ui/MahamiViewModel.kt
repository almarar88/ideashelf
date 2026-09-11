package com.almarar.mahami.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Settings
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskRepository
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.notify.DailyDigestWorker
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
}
