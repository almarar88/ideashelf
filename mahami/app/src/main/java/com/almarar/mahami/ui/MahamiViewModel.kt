package com.almarar.mahami.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.almarar.mahami.core.Backup
import com.almarar.mahami.core.Stats
import com.almarar.mahami.core.TaskStats
import com.almarar.mahami.data.ActivityEntry
import com.almarar.mahami.data.CalendarView
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.Settings
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.data.TaskTemplate
import com.almarar.mahami.data.ThemeMode
import com.almarar.mahami.notify.DailyDigestWorker
import kotlinx.coroutines.flow.Flow
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
    DUE("حسب الموعد"), PRIORITY("حسب الأولوية"), PROGRESS("حسب الإنجاز"), SUGGESTED("الترتيب المقترح")
}

/** رسالة قصيرة تظهر أسفل الشاشة مع إمكانية التراجع */
data class Toast(val message: String, val undo: (() -> Unit)? = null, val id: Long = System.nanoTime())

class MahamiViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = Repository.get(app)
    private val prefs = Prefs.get(app)

    val settings: StateFlow<Settings> = prefs.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, Settings())

    val tasks: StateFlow<List<Task>> = repo.tasks
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val projects: StateFlow<List<Project>> = repo.projects
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _filter = MutableStateFlow(TaskFilter.ALL)
    val filter = _filter.asStateFlow()

    private val _sort = MutableStateFlow(SortMode.DUE)
    val sort = _sort.asStateFlow()

    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    private val _projectFilter = MutableStateFlow<Long?>(null)
    val projectFilter = _projectFilter.asStateFlow()

    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate = _selectedDate.asStateFlow()

    private val _month = MutableStateFlow(YearMonth.from(LocalDate.now()))
    val month = _month.asStateFlow()

    private val _toast = MutableStateFlow<Toast?>(null)
    val toast = _toast.asStateFlow()

    val visibleTasks: StateFlow<List<Task>> =
        combine(tasks, _filter, _sort, _query, _projectFilter) { list, filter, sort, query, project ->
            val today = LocalDate.now()
            val filtered = list.asSequence()
                .filter { task ->
                    when (filter) {
                        TaskFilter.ALL -> task.status != TaskStatus.DONE
                        TaskFilter.TODAY -> task.dueDate == today && task.status != TaskStatus.DONE
                        TaskFilter.UPCOMING -> task.dueDate.isAfter(today) && task.status != TaskStatus.DONE
                        TaskFilter.LATE -> task.status != TaskStatus.DONE && task.dueDate.isBefore(today)
                        TaskFilter.DONE -> task.status == TaskStatus.DONE
                    }
                }
                .filter { project == null || it.projectId == project }
                .filter { task ->
                    query.isBlank() ||
                        task.title.contains(query, true) ||
                        task.details.contains(query, true) ||
                        task.owner.contains(query, true) ||
                        task.tags.any { it.contains(query, true) }
                }
                .toList()

            when (sort) {
                SortMode.DUE -> filtered.sortedWith(
                    compareByDescending<Task> { it.pinned }.thenBy { it.dueDate }.thenBy { it.dueTime }
                )
                SortMode.PRIORITY -> filtered.sortedWith(
                    compareByDescending<Task> { it.pinned }.thenBy { it.priority.ordinal }.thenBy { it.dueDate }
                )
                SortMode.PROGRESS -> filtered.sortedWith(
                    compareByDescending<Task> { it.pinned }.thenByDescending { it.progress }.thenBy { it.dueDate }
                )
                SortMode.SUGGESTED -> Stats.suggestedOrder(filtered)
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val stats: StateFlow<TaskStats> = tasks
        .combine(_selectedDate) { list, _ -> Stats.summarize(list) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, TaskStats())

    init {
        viewModelScope.launch {
            repo.initializeIfNeeded()
            repo.refresh()
            DailyDigestWorker.schedule(app, prefs.settings.first().digestHour)
        }
    }

    // ---------- استعلامات مساعدة ----------

    fun projectOf(task: Task): Project? = projects.value.firstOrNull { it.id == task.projectId }

    fun tasksOn(date: LocalDate): List<Task> = tasks.value.filter { it.dueDate == date }

    fun activityFor(taskId: Long): Flow<List<ActivityEntry>> = repo.activityFor(taskId)

    // ---------- الفلاتر ----------

    fun setFilter(value: TaskFilter) { _filter.value = value }
    fun setSort(value: SortMode) { _sort.value = value }
    fun setQuery(value: String) { _query.value = value }
    fun setProjectFilter(value: Long?) { _projectFilter.value = value }
    fun selectDate(date: LocalDate) {
        _selectedDate.value = date
        _month.value = YearMonth.from(date)
    }
    fun changeMonth(delta: Long) { _month.value = _month.value.plusMonths(delta) }

    // ---------- المهام ----------

    fun toggleDone(task: Task) = viewModelScope.launch {
        repo.toggleDone(task)
        val wasDone = task.status == TaskStatus.DONE
        showToast(
            if (wasDone) "أُعيد فتح المهمة" else "تم إنجاز المهمة",
            undo = { viewModelScope.launch { repo.taskById(task.id)?.let { repo.toggleDone(it) } } }
        )
    }

    fun togglePinned(task: Task) = viewModelScope.launch { repo.togglePinned(task) }

    fun toggleSubTask(task: Task, index: Int) = viewModelScope.launch { repo.toggleSubTask(task, index) }

    fun setStatus(task: Task, status: TaskStatus) = viewModelScope.launch { repo.setStatus(task, status) }

    fun postpone(task: Task, days: Long) = viewModelScope.launch {
        repo.postpone(task, days)
        showToast(
            "أُجّلت ${com.almarar.mahami.core.Ar.countDays(days)}",
            undo = { viewModelScope.launch { repo.taskById(task.id)?.let { repo.postpone(it, -days) } } }
        )
    }

    fun delete(task: Task) = viewModelScope.launch {
        repo.delete(task)
        showToast(
            "حُذفت المهمة",
            undo = { viewModelScope.launch { repo.upsert(task.copy(id = 0)) } }
        )
    }

    fun save(task: Task, onSaved: (Long) -> Unit = {}) = viewModelScope.launch {
        onSaved(repo.upsert(task))
    }

    fun createFromTemplate(template: TaskTemplate, projectId: Long?, onCreated: (Long) -> Unit = {}) =
        viewModelScope.launch {
            val defaults = prefs.settings.first().defaultReminderOffsets
            val task = template.toTask(LocalDate.now(), projectId).let {
                if (template.reminderOffsets.isEmpty()) it.copy(reminderOffsetsDays = defaults) else it
            }
            onCreated(repo.upsert(task))
            showToast("أُنشئت مهمة من قالب «${template.name}»")
        }

    // ---------- المشاريع ----------

    fun saveProject(project: Project) = viewModelScope.launch { repo.upsertProject(project) }

    fun deleteProject(project: Project) = viewModelScope.launch {
        repo.deleteProject(project)
        if (_projectFilter.value == project.id) _projectFilter.value = null
        showToast("حُذف المشروع، ونُقلت مهامه إلى «بدون مشروع»")
    }

    // ---------- الإعدادات ----------

    fun setOnboarded(value: Boolean) = viewModelScope.launch { prefs.setOnboarded(value) }
    fun setUserName(value: String) = viewModelScope.launch { prefs.setUserName(value) }
    fun setThemeMode(value: ThemeMode) = viewModelScope.launch { prefs.setThemeMode(value) }
    fun setCalendarView(value: CalendarView) = viewModelScope.launch { prefs.setCalendarView(value) }
    fun setAppLock(value: Boolean) = viewModelScope.launch { prefs.setAppLock(value) }
    fun setDefaultReminders(value: List<Int>) = viewModelScope.launch { prefs.setDefaultReminders(value) }

    fun setNotifications(value: Boolean) = viewModelScope.launch {
        prefs.setNotifications(value)
        repo.refresh()
    }

    fun setDailyDigest(value: Boolean) = viewModelScope.launch { prefs.setDailyDigest(value) }

    fun setDigestHour(hour: Int) = viewModelScope.launch {
        prefs.setDigestHour(hour)
        DailyDigestWorker.schedule(getApplication(), hour)
    }

    // ---------- البيانات ----------

    fun loadDemoData() = viewModelScope.launch {
        repo.loadDemoData()
        showToast("أُضيفت مهام تجريبية")
    }

    fun clearAllTasks() = viewModelScope.launch {
        repo.clearAll()
        showToast("حُذفت كل المهام")
    }

    fun exportBackup() = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val json = Backup.toJson(repo.allTasks(), repo.allProjects())
            val uri = Backup.writeShareable(app, "mahami-backup.json", json)
            Backup.shareFile(app, uri, "application/json", "نسخة احتياطية من المهام")
        }.onFailure { showToast("تعذّر التصدير: ${it.message}") }
    }

    fun exportCalendar() = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val uri = Backup.writeShareable(app, "mahami.ics", Backup.toIcs(repo.allTasks()))
            Backup.shareFile(app, uri, "text/calendar", "تصدير المهام إلى التقويم")
        }.onFailure { showToast("تعذّر التصدير: ${it.message}") }
    }

    fun shareReport() = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            Backup.shareText(app, "تقرير المهام", Backup.toText(repo.allTasks()))
        }.onFailure { showToast("تعذّرت المشاركة") }
    }

    fun importBackup(uri: Uri, replace: Boolean) = viewModelScope.launch {
        runCatching {
            val app = getApplication<Application>()
            val content = Backup.fromJson(Backup.readText(app, uri))
            if (content.tasks.isEmpty()) {
                showToast("الملف لا يحتوي مهاماً صالحة")
            } else {
                val count = repo.importBackup(content, replace)
                showToast("استُوردت ${com.almarar.mahami.core.Ar.countTasks(count)}")
            }
        }.onFailure { showToast("تعذّر الاستيراد: ${it.message}") }
    }

    // ---------- الرسائل ----------

    fun showToast(message: String, undo: (() -> Unit)? = null) {
        _toast.value = Toast(message, undo)
    }

    fun consumeToast() { _toast.value = null }
}
