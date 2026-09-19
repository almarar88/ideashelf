package com.almarar.mahami.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.almarar.mahami.billing.BillingManager
import com.almarar.mahami.billing.Entitlement
import com.almarar.mahami.billing.EntitlementStore
import com.almarar.mahami.billing.FreeLimits
import com.almarar.mahami.billing.PlanOffer
import com.almarar.mahami.billing.ProFeature
import com.almarar.mahami.core.Backup
import com.almarar.mahami.core.Export
import com.almarar.mahami.core.FocusSummary
import com.almarar.mahami.core.Stats
import com.almarar.mahami.core.TaskStats
import com.almarar.mahami.data.AccentColor
import com.almarar.mahami.data.ActivityEntry
import com.almarar.mahami.data.CalendarView
import com.almarar.mahami.data.Comment
import com.almarar.mahami.data.CustomTemplate
import com.almarar.mahami.data.FocusSession
import com.almarar.mahami.data.ProjectKit
import com.almarar.mahami.data.ProjectTemplates
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Prefs
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.Settings
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import com.almarar.mahami.data.TaskTemplate
import com.almarar.mahami.data.Templates
import com.almarar.mahami.data.ThemeMode
import com.almarar.mahami.notify.DailyDigestWorker
import com.almarar.mahami.smart.ParsedChip
import com.almarar.mahami.smart.ParsedTask
import com.almarar.mahami.smart.Planner
import com.almarar.mahami.smart.SmartParser
import com.almarar.mahami.sync.AuthClient
import com.almarar.mahami.sync.AuthResult
import com.almarar.mahami.sync.Session
import com.almarar.mahami.sync.SyncConfig
import com.almarar.mahami.sync.SyncManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
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
    private val billing = BillingManager.get(app)
    private val entitlementStore = EntitlementStore.get(app)
    private val auth = AuthClient.get(app)
    private val syncManager = SyncManager.get(app)
    private val syncConfig = SyncConfig.get(app)

    val settings: StateFlow<Settings> = prefs.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, Settings())

    val tasks: StateFlow<List<Task>> = repo.tasks
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val projects: StateFlow<List<Project>> = repo.projects
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val customTemplates: StateFlow<List<CustomTemplate>> = repo.customTemplates
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val focusSessions: StateFlow<List<FocusSession>> = repo.focusSessions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val focusSummary: StateFlow<FocusSummary> = focusSessions
        .map { Stats.focusSummary(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), FocusSummary())

    // ---------- الاشتراك ----------

    val entitlement: StateFlow<Entitlement> = entitlementStore.entitlement
        .stateIn(viewModelScope, SharingStarted.Eagerly, Entitlement())

    val billingState = billing.state

    val isPro: Boolean get() = entitlement.value.isPro

    /** آخر ميزة مدفوعة حاول المستخدم استخدامها — تُبرز في شاشة الاشتراك */
    private val _lockedFeature = MutableStateFlow<ProFeature?>(null)
    val lockedFeature = _lockedFeature.asStateFlow()

    fun requestPro(feature: ProFeature) { _lockedFeature.value = feature }
    fun clearLockedFeature() { _lockedFeature.value = null }

    fun startBilling() = billing.start()

    fun purchase(activity: android.app.Activity, offer: PlanOffer) {
        billing.purchase(activity, offer)
        viewModelScope.launch { prefs.markPaywallSeen() }
    }

    fun restorePurchases() = billing.restore()

    fun clearBillingMessage() = billing.clearMessage()

    /** حد المشاريع في النسخة المجانية */
    fun canAddProject(): Boolean = isPro || projects.value.size < FreeLimits.PROJECTS

    /** حد التنبيهات لكل مهمة */
    fun maxRemindersPerTask(): Int = if (isPro) 5 else FreeLimits.REMINDERS_PER_TASK

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
        // عمل التهيئة خارج الخيط الرئيسي: لا يحجب الواجهة،
        // ولا يترك قفل التهيئة معلّقاً إن كان الخيط الرئيسي مشغولاً.
        viewModelScope.launch(Dispatchers.Default) {
            repo.initializeIfNeeded()
            repo.refresh()
            _syncConfigured.value = syncConfig.isConfigured()
            if (syncConfig.currentSession().signedIn) syncManager.syncNow()
            DailyDigestWorker.schedule(app, prefs.settings.first().digestHour)
        }
    }

    // ---------- الحساب والمزامنة ----------

    val session: StateFlow<Session> = syncConfig.session
        .stateIn(viewModelScope, SharingStarted.Eagerly, Session())

    val syncState = syncManager.state

    private val _authBusy = MutableStateFlow(false)
    val authBusy = _authBusy.asStateFlow()

    private val _authMessage = MutableStateFlow("")
    val authMessage = _authMessage.asStateFlow()

    private val _syncConfigured = MutableStateFlow(false)
    val syncConfigured = _syncConfigured.asStateFlow()

    fun signUp(email: String, password: String) = runAuth {
        when (val result = auth.signUp(email, password)) {
            is AuthResult.Success -> {
                _authMessage.value = "تم إنشاء الحساب"
                syncManager.syncNow()
            }
            is AuthResult.NeedsEmailConfirmation ->
                _authMessage.value = "أرسلنا رسالة تأكيد إلى ${result.email} — افتحها ثم سجّل الدخول."
            is AuthResult.Failure -> _authMessage.value = result.message
        }
    }

    fun signIn(email: String, password: String) = runAuth {
        when (val result = auth.signIn(email, password)) {
            is AuthResult.Success -> {
                _authMessage.value = "تم تسجيل الدخول"
                syncManager.syncNow()
            }
            is AuthResult.NeedsEmailConfirmation ->
                _authMessage.value = "فعّل بريدك أولاً من رسالة التأكيد."
            is AuthResult.Failure -> _authMessage.value = result.message
        }
    }

    fun resetPassword(email: String) = runAuth {
        when (val result = auth.sendPasswordReset(email)) {
            is AuthResult.Success -> _authMessage.value = "أرسلنا رابط إعادة التعيين إلى بريدك."
            is AuthResult.Failure -> _authMessage.value = result.message
            else -> Unit
        }
    }

    fun signOut() = runAuth {
        auth.signOut()
        _authMessage.value = "تم تسجيل الخروج — بياناتك تبقى على هذا الجهاز."
    }

    /** حذف الحساب من الخادم — متطلب إلزامي في متجر جوجل */
    fun deleteAccount(onDone: () -> Unit = {}) = runAuth {
        when (val result = auth.deleteAccount()) {
            is AuthResult.Success -> {
                _authMessage.value = "حُذف الحساب نهائياً من الخادم."
                onDone()
            }
            is AuthResult.Failure -> _authMessage.value = result.message
            else -> Unit
        }
    }

    fun syncNow() = viewModelScope.launch {
        if (!session.value.signedIn) {
            showToast("سجّل الدخول لتفعيل المزامنة")
            return@launch
        }
        syncManager.syncNow()
    }

    fun setSyncServer(url: String, key: String) = viewModelScope.launch {
        syncConfig.setServer(url, key)
        _syncConfigured.value = syncConfig.isConfigured()
        _authMessage.value = if (_syncConfigured.value) "حُفظت إعدادات الخادم" else "الإعدادات غير مكتملة"
    }

    fun clearAuthMessage() { _authMessage.value = "" }

    private fun runAuth(block: suspend () -> Unit) = viewModelScope.launch {
        _authBusy.value = true
        _authMessage.value = ""
        runCatching { block() }.onFailure { _authMessage.value = it.message ?: "حدث خطأ" }
        _authBusy.value = false
    }

    // ---------- الإدخال الذكي ----------

    private val _quickInput = MutableStateFlow(QuickInputState())
    val quickInput = _quickInput.asStateFlow()

    fun onQuickInputChange(text: String) {
        val parsed = if (text.isBlank()) null else SmartParser.parse(text)
        _quickInput.value = QuickInputState(
            text = text,
            title = parsed?.title.orEmpty(),
            chips = parsed?.matches.orEmpty(),
            parsed = parsed
        )
    }

    /** يحفظ ما فهمه المحلّل كمهمة كاملة */
    fun commitQuickAdd() {
        val state = _quickInput.value
        val parsed = state.parsed ?: SmartParser.parse(state.text) ?: return
        viewModelScope.launch {
            val id = saveParsed(parsed)
            _quickInput.value = QuickInputState()
            showToast(
                "أُضيفت: ${parsed.title}",
                undo = { viewModelScope.launch { repo.taskById(id)?.let { repo.delete(it) } } }
            )
        }
    }

    /** يحوّل نتيجة الإدخال الصوتي إلى مهمة */
    fun addFromVoice(spoken: String) {
        val parsed = SmartParser.parse(spoken) ?: return
        viewModelScope.launch {
            saveParsed(parsed)
            showToast("أُضيفت بالصوت: ${parsed.title}")
        }
    }

    private suspend fun saveParsed(parsed: ParsedTask): Long {
        val defaults = prefs.settings.first().defaultReminderOffsets
        val projectId = parsed.projectName?.let { name ->
            projects.value.firstOrNull { it.name.contains(name, true) }?.id
                ?: repo.upsertProject(
                    Project(
                        name = name,
                        colorArgb = com.almarar.mahami.ui.theme.ProjectColors.random()
                    )
                )
        } ?: _projectFilter.value

        return repo.upsert(
            Task(
                title = parsed.title,
                dueDate = parsed.dueDate,
                dueTime = parsed.dueTime ?: java.time.LocalTime.of(9, 0),
                priority = parsed.priority,
                important = parsed.important,
                tags = parsed.tags,
                owner = parsed.owner,
                estimateMinutes = parsed.estimateMinutes,
                projectId = projectId,
                reminderOffsetsDays = if (isPro) defaults else defaults.take(1)
            )
        )
    }

    // ---------- الاستيراد من نص أو مشاركة ----------

    private val _importCandidates = MutableStateFlow<List<ParsedTask>>(emptyList())
    val importCandidates = _importCandidates.asStateFlow()

    fun prepareImport(text: String) {
        _importCandidates.value = SmartParser.parseMany(text)
    }

    fun clearImport() { _importCandidates.value = emptyList() }

    fun confirmImport(selected: List<ParsedTask>, onDone: () -> Unit = {}) = viewModelScope.launch {
        selected.forEach { saveParsed(it) }
        _importCandidates.value = emptyList()
        showToast("أُضيفت ${com.almarar.mahami.core.Ar.countTasks(selected.size)}")
        onDone()
    }

    // ---------- أهم ثلاث مهام ----------

    fun toggleMit(task: Task) = viewModelScope.launch {
        val today = LocalDate.now()
        val current = tasks.value.count { it.isMitFor(today) && it.status != TaskStatus.DONE }
        if (!task.isMitFor(today) && current >= 3) {
            showToast("اخترت ثلاث مهام بالفعل — ألغِ إحداها أولاً")
            return@launch
        }
        repo.upsert(task.copy(mitDate = if (task.isMitFor(today)) null else today))
    }

    // ---------- التبعيات ----------

    /** هل المهمة محجوبة بانتظار مهمة أخرى؟ */
    fun isBlocked(task: Task): Boolean {
        val blocker = task.dependsOn ?: return false
        return tasks.value.firstOrNull { it.id == blocker }?.status != TaskStatus.DONE &&
            tasks.value.any { it.id == blocker }
    }

    fun blockerOf(task: Task): Task? = task.dependsOn?.let { id -> tasks.value.firstOrNull { it.id == id } }

    fun setDependency(task: Task, blockerId: Long?) = viewModelScope.launch {
        repo.upsert(task.copy(dependsOn = blockerId))
    }

    fun toggleImportant(task: Task) = viewModelScope.launch {
        repo.upsert(task.copy(important = !task.important))
    }

    // ---------- خطة التنفيذ ----------

    fun buildExecutionPlan(task: Task) {
        if (!isPro) {
            requestPro(ProFeature.ADVANCED_REPORTS)
            return
        }
        viewModelScope.launch {
            val planned = Planner.applyTo(task)
            repo.upsert(planned)
            val days = Planner.plan(task).size
            showToast("وُزّعت الخطوات على $days أيام")
        }
    }

    fun clearExecutionPlan(task: Task) = viewModelScope.launch {
        repo.upsert(task.copy(subTasks = task.subTasks.map { it.copy(targetDate = null) }))
    }

    fun stepsDueToday(): List<Pair<Task, SubTask>> = Planner.stepsDueToday(tasks.value)

    // ---------- أطقم المشاريع ----------

    fun createProjectKit(kit: ProjectKit, onDone: (Long) -> Unit = {}) {
        if (!isPro && projects.value.size >= FreeLimits.PROJECTS) {
            requestPro(ProFeature.UNLIMITED_PROJECTS)
            return
        }
        viewModelScope.launch {
            val projectId = repo.upsertProject(
                Project(name = kit.name, colorArgb = kit.colorArgb)
            )
            val defaults = prefs.settings.first().defaultReminderOffsets
            ProjectTemplates.buildTasks(kit, projectId, LocalDate.now(), defaults).forEach {
                repo.upsert(it)
            }
            showToast("أُنشئ مشروع «${kit.name}» بـ ${com.almarar.mahami.core.Ar.countTasks(kit.tasks.size)}")
            onDone(projectId)
        }
    }

    // ---------- التعليقات ----------

    fun commentsFor(taskId: Long): Flow<List<Comment>> = repo.commentsFor(taskId)

    fun addComment(taskId: Long, text: String) = viewModelScope.launch {
        repo.addComment(taskId, text)
    }

    fun deleteComment(comment: Comment) = viewModelScope.launch { repo.deleteComment(comment) }

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

    /**
     * يحفظ المهمة بعد تطبيق حدود النسخة المجانية:
     * التكرار مدفوع، وعدد التنبيهات محدود.
     */
    fun save(task: Task, onSaved: (Long) -> Unit = {}) {
        if (!isPro && task.repeat != com.almarar.mahami.data.Repeat.NONE) {
            requestPro(ProFeature.REPEATING_TASKS)
            return
        }
        val limited = if (isPro) task else task.copy(
            reminderOffsetsDays = task.reminderOffsetsDays
                .sortedBy { it }
                .take(FreeLimits.REMINDERS_PER_TASK)
                .ifEmpty { listOf(0) }
        )
        viewModelScope.launch { onSaved(repo.upsert(limited)) }
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

    fun saveProject(project: Project) {
        if (project.id == 0L && !canAddProject()) {
            requestPro(ProFeature.UNLIMITED_PROJECTS)
            return
        }
        viewModelScope.launch { repo.upsertProject(project) }
    }

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
    fun setAppLock(value: Boolean) {
        if (value && !isPro) {
            requestPro(ProFeature.APP_LOCK)
            return
        }
        viewModelScope.launch { prefs.setAppLock(value) }
    }
    fun setDefaultReminders(value: List<Int>) {
        if (!isPro && value.size > FreeLimits.REMINDERS_PER_TASK) {
            requestPro(ProFeature.MULTI_REMINDERS)
            return
        }
        viewModelScope.launch { prefs.setDefaultReminders(value) }
    }

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

    fun exportCalendar() {
        if (!isPro) {
            requestPro(ProFeature.EXPORT)
            return
        }
        exportCalendarInternal()
    }

    private fun exportCalendarInternal() = viewModelScope.launch {
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

    // ---------- مؤقت التركيز ----------

    private val _focus = MutableStateFlow(FocusState())
    val focus = _focus.asStateFlow()

    private var focusJob: Job? = null

    fun startFocus(task: Task) {
        focusJob?.cancel()
        val minutes = settings.value.focusMinutes.coerceIn(5, 120)
        _focus.value = FocusState(
            taskId = task.id,
            taskTitle = task.title,
            totalSeconds = minutes * 60,
            remainingSeconds = minutes * 60,
            running = true
        )
        tick()
    }

    fun pauseFocus() {
        focusJob?.cancel()
        _focus.value = _focus.value.copy(running = false)
    }

    fun resumeFocus() {
        if (_focus.value.taskId == 0L || _focus.value.remainingSeconds <= 0) return
        _focus.value = _focus.value.copy(running = true)
        tick()
    }

    /** ينهي الجلسة ويسجّل الدقائق المكتملة */
    fun stopFocus(save: Boolean = true) {
        focusJob?.cancel()
        val current = _focus.value
        val elapsed = (current.totalSeconds - current.remainingSeconds) / 60
        if (save && current.taskId > 0 && elapsed > 0) {
            viewModelScope.launch {
                repo.logFocusSession(current.taskId, elapsed)
                showToast("سُجّلت $elapsed دقيقة تركيز")
            }
        }
        _focus.value = FocusState()
    }

    private fun tick() {
        focusJob = viewModelScope.launch {
            while (_focus.value.running && _focus.value.remainingSeconds > 0) {
                delay(1_000)
                val current = _focus.value
                if (!current.running) break
                _focus.value = current.copy(remainingSeconds = current.remainingSeconds - 1)
            }
            if (_focus.value.remainingSeconds <= 0 && _focus.value.taskId > 0) {
                val finished = _focus.value
                repo.logFocusSession(finished.taskId, finished.totalSeconds / 60)
                _focus.value = FocusState(completedJustNow = true)
                showToast("انتهت جلسة التركيز — خذ استراحة")
            }
        }
    }

    fun setFocusMinutes(value: Int) = viewModelScope.launch { prefs.setFocusMinutes(value) }
    fun setBreakMinutes(value: Int) = viewModelScope.launch { prefs.setBreakMinutes(value) }

    // ---------- القوالب المخصصة ----------

    fun saveTaskAsTemplate(task: Task) {
        if (!isPro) {
            requestPro(ProFeature.CUSTOM_TEMPLATES)
            return
        }
        viewModelScope.launch {
            repo.templateFromTask(task)
            showToast("حُفظت المهمة كقالب")
        }
    }

    fun createFromCustomTemplate(template: CustomTemplate, projectId: Long?, onCreated: (Long) -> Unit = {}) =
        viewModelScope.launch {
            val task = Task(
                title = template.name,
                details = template.hint,
                projectId = projectId,
                dueDate = LocalDate.now().plusDays(template.offsetDays),
                priority = template.priority,
                subTasks = template.steps.map { com.almarar.mahami.data.SubTask(it) },
                reminderOffsetsDays = prefs.settings.first().defaultReminderOffsets
            )
            onCreated(repo.upsert(task))
            showToast("أُنشئت مهمة من قالبك")
        }

    fun deleteCustomTemplate(template: CustomTemplate) = viewModelScope.launch {
        repo.deleteCustomTemplate(template)
    }

    // ---------- إضافة سريعة ----------

    /** ينشئ مهمة من سطر واحد مع موعد مختصر */
    fun quickAdd(title: String, daysFromToday: Long) {
        val clean = title.trim()
        if (clean.isBlank()) return
        viewModelScope.launch {
            val defaults = prefs.settings.first().defaultReminderOffsets
            val id = repo.upsert(
                Task(
                    title = clean,
                    dueDate = LocalDate.now().plusDays(daysFromToday),
                    projectId = _projectFilter.value,
                    reminderOffsetsDays = if (isPro) defaults else defaults.take(1)
                )
            )
            showToast(
                "أُضيفت المهمة",
                undo = { viewModelScope.launch { repo.taskById(id)?.let { repo.delete(it) } } }
            )
        }
    }

    // ---------- المظهر ----------

    fun setAccentColor(color: AccentColor) {
        if (!isPro && color != AccentColor.BLUE) {
            requestPro(ProFeature.THEMES)
            return
        }
        viewModelScope.launch { prefs.setAccentColor(color) }
    }

    // ---------- تصدير متقدم ----------

    fun exportCsv() {
        if (!isPro) {
            requestPro(ProFeature.EXPORT)
            return
        }
        viewModelScope.launch {
            runCatching {
                val app = getApplication<Application>()
                val csv = Export.toCsv(repo.allTasks(), repo.allProjects())
                val uri = Backup.writeShareable(app, "mahami-tasks.csv", csv)
                Backup.shareFile(app, uri, "text/csv", "تصدير المهام إلى CSV")
            }.onFailure { showToast("تعذّر التصدير: ${it.message}") }
        }
    }

    fun exportPdf() {
        if (!isPro) {
            requestPro(ProFeature.EXPORT)
            return
        }
        viewModelScope.launch {
            val app = getApplication<Application>()
            val tasks = repo.allTasks()
            val uri = Export.writeReportPdf(app, tasks, repo.allProjects(), Stats.summarize(tasks))
            if (uri == null) showToast("تعذّر إنشاء ملف PDF على هذا الجهاز")
            else Backup.shareFile(app, uri, "application/pdf", "تقرير المهام PDF")
        }
    }

    // ---------- الرسائل ----------

    fun showToast(message: String, undo: (() -> Unit)? = null) {
        _toast.value = Toast(message, undo)
    }

    fun consumeToast() { _toast.value = null }
}
