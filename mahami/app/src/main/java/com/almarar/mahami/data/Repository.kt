package com.almarar.mahami.data

import android.content.Context
import com.almarar.mahami.core.BackupContent
import com.almarar.mahami.notify.ReminderScheduler
import com.almarar.mahami.widget.MahamiWidget
import com.almarar.mahami.widget.TodayWidget
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.LocalDate
import java.time.LocalDateTime

/** مصدر الحقيقة الوحيد للمهام والمشاريع وسجل النشاط */
class Repository(
    private val context: Context,
    private val taskDao: TaskDao,
    private val projectDao: ProjectDao,
    private val activityDao: ActivityDao,
    private val focusDao: FocusDao,
    private val customTemplateDao: CustomTemplateDao,
    private val commentDao: CommentDao,
    private val tombstoneDao: TombstoneDao
) {

    val tasks: Flow<List<Task>> = taskDao.observeAll()
    val projects: Flow<List<Project>> = projectDao.observeAll()
    val customTemplates: Flow<List<CustomTemplate>> = customTemplateDao.observeAll()
    val focusSessions: Flow<List<FocusSession>> = focusDao.observeRecent()

    fun activityFor(taskId: Long): Flow<List<ActivityEntry>> = activityDao.observeForTask(taskId)

    fun commentsFor(taskId: Long): Flow<List<Comment>> = commentDao.observeForTask(taskId)

    suspend fun addComment(taskId: Long, text: String) {
        val clean = text.trim()
        if (clean.isBlank()) return
        commentDao.insert(Comment(taskId = taskId, text = clean))
    }

    suspend fun deleteComment(comment: Comment) = commentDao.delete(comment)

    suspend fun allTasks(): List<Task> = taskDao.getAll()
    suspend fun allProjects(): List<Project> = projectDao.getAll()
    suspend fun taskById(id: Long): Task? = taskDao.getById(id)

    private val initLock = Mutex()

    /** ينشئ المشاريع الافتراضية عند أول تشغيل دون إضافة أي مهام */
    suspend fun initializeIfNeeded() = initLock.withLock {
        if (projectDao.count() == 0) projectDao.insertAll(SampleData.defaultProjects)
    }

    // ---------- المهام ----------

    suspend fun upsert(task: Task, touch: Boolean = true): Long {
        val isNew = task.id == 0L
        val prepared = if (touch) task.copy(updatedAt = LocalDateTime.now()) else task
        val id = taskDao.insert(prepared)
        log(
            if (isNew) ActivityEntry(taskId = id, type = ActivityType.CREATED, text = task.title)
            else ActivityEntry(taskId = id, type = ActivityType.EDITED, text = "تحديث بيانات المهمة")
        )
        refresh()
        return id
    }

    suspend fun delete(task: Task, recordTombstone: Boolean = true) {
        if (recordTombstone) {
            runCatching { tombstoneDao.insert(Tombstone(task.syncId, "task")) }
        }
        commentDao.deleteForTask(task.id)
        taskDao.delete(task)
        activityDao.deleteForTask(task.id)
        focusDao.deleteForTask(task.id)
        ReminderScheduler.cancel(context, task.id)
        refresh()
    }

    suspend fun toggleDone(task: Task) {
        val markDone = task.status != TaskStatus.DONE
        val updated = task.copy(
            status = if (markDone) TaskStatus.DONE else TaskStatus.PENDING,
            completedAt = if (markDone) LocalDateTime.now() else null,
            subTasks = if (markDone) task.subTasks.map { it.copy(done = true) } else task.subTasks
        )
        taskDao.update(updated)
        log(
            ActivityEntry(
                taskId = task.id,
                type = if (markDone) ActivityType.COMPLETED else ActivityType.REOPENED,
                text = if (markDone) "اكتملت المهمة" else "أُعيد فتح المهمة"
            )
        )
        if (markDone) {
            ReminderScheduler.cancel(context, task.id)
            spawnNextOccurrence(task)
        }
        refresh()
    }

    suspend fun setStatus(task: Task, status: TaskStatus) {
        if (status == task.status) return
        taskDao.update(
            task.copy(
                status = status,
                completedAt = if (status == TaskStatus.DONE) LocalDateTime.now() else null
            )
        )
        log(ActivityEntry(taskId = task.id, type = ActivityType.STATUS, text = status.label))
        refresh()
    }

    suspend fun togglePinned(task: Task) {
        taskDao.update(task.copy(pinned = !task.pinned))
        refresh()
    }

    suspend fun toggleSubTask(task: Task, index: Int) {
        val list = task.subTasks.toMutableList()
        if (index !in list.indices) return
        list[index] = list[index].copy(done = !list[index].done)
        val allDone = list.isNotEmpty() && list.all { it.done }
        taskDao.update(
            task.copy(
                subTasks = list,
                status = when {
                    allDone -> TaskStatus.DONE
                    list.any { it.done } && task.status == TaskStatus.PENDING -> TaskStatus.IN_PROGRESS
                    else -> task.status
                },
                completedAt = if (allDone) LocalDateTime.now() else null
            )
        )
        log(
            ActivityEntry(
                taskId = task.id,
                type = if (allDone) ActivityType.COMPLETED else ActivityType.STEP,
                text = if (allDone) "اكتملت كل الخطوات" else list[index].title
            )
        )
        refresh()
    }

    suspend fun postpone(task: Task, days: Long) {
        val newDate = task.dueDate.plusDays(days)
        taskDao.update(task.copy(dueDate = newDate))
        log(
            ActivityEntry(
                taskId = task.id,
                type = ActivityType.POSTPONED,
                text = "أُجّلت إلى ${com.almarar.mahami.core.Ar.fullDate(newDate)}"
            )
        )
        refresh()
    }

    suspend fun markDoneById(taskId: Long) {
        val task = taskDao.getById(taskId) ?: return
        if (task.status != TaskStatus.DONE) toggleDone(task)
    }

    suspend fun snooze(taskId: Long, minutes: Long) {
        val task = taskDao.getById(taskId) ?: return
        ReminderScheduler.scheduleSnooze(context, task, minutes)
    }

    private suspend fun spawnNextOccurrence(task: Task) {
        val nextDate = nextOccurrence(task.dueDate, task.repeat, task.repeatInterval, task.repeatDays)
            ?: return
        taskDao.insert(
            task.copy(
                id = 0,
                dueDate = nextDate,
                status = TaskStatus.PENDING,
                completedAt = null,
                createdAt = LocalDateTime.now(),
                subTasks = task.subTasks.map { it.copy(done = false) }
            )
        )
    }

    // ---------- التركيز ----------

    /** يسجّل جلسة تركيز على مهمة ويضيف دقائقها إلى إجماليها */
    suspend fun logFocusSession(taskId: Long, minutes: Int) {
        if (minutes <= 0) return
        val task = taskDao.getById(taskId) ?: return
        focusDao.insert(FocusSession(taskId = taskId, minutes = minutes))
        taskDao.update(task.copy(focusMinutes = task.focusMinutes + minutes))
        log(
            ActivityEntry(
                taskId = taskId,
                type = ActivityType.STEP,
                text = "جلسة تركيز $minutes دقيقة"
            )
        )
    }

    suspend fun allFocusSessions(): List<FocusSession> = focusDao.getAll()

    // ---------- القوالب المخصصة ----------

    suspend fun saveCustomTemplate(template: CustomTemplate): Long = customTemplateDao.insert(template)

    suspend fun deleteCustomTemplate(template: CustomTemplate) = customTemplateDao.delete(template)

    suspend fun customTemplateCount(): Int = customTemplateDao.count()

    /** يحوّل مهمة قائمة إلى قالب قابل لإعادة الاستخدام */
    suspend fun templateFromTask(task: Task, emoji: String = "⭐"): Long {
        val offset = java.time.temporal.ChronoUnit.DAYS
            .between(LocalDate.now(), task.dueDate)
            .coerceIn(0, 365)
        return customTemplateDao.insert(
            CustomTemplate(
                name = task.title,
                emoji = emoji,
                hint = task.details.take(120),
                offsetDays = offset,
                priority = task.priority,
                steps = task.subTasks.map { it.title }
            )
        )
    }

    // ---------- المشاريع ----------

    suspend fun upsertProject(project: Project): Long = projectDao.insert(project)

    suspend fun deleteProject(project: Project, recordTombstone: Boolean = true) {
        if (recordTombstone) {
            runCatching { tombstoneDao.insert(Tombstone(project.syncId, "project")) }
        }
        taskDao.getAll().filter { it.projectId == project.id }.forEach {
            taskDao.update(it.copy(projectId = null))
        }
        projectDao.delete(project)
        refresh()
    }

    // ---------- بيانات تجريبية ونسخ احتياطية ----------

    suspend fun loadDemoData() {
        initializeIfNeeded()
        val ids = projectDao.getAll().map { it.id }
        taskDao.insertAll(SampleData.demoTasks(LocalDate.now(), ids))
        refresh()
    }

    suspend fun clearAll() {
        taskDao.getAll().forEach { ReminderScheduler.cancel(context, it.id) }
        taskDao.deleteAll()
        activityDao.deleteAll()
        focusDao.deleteAll()
        commentDao.deleteAll()
        refresh()
    }

    /** يستورد نسخة احتياطية مع إعادة ربط المشاريع بمعرفاتها الجديدة */
    suspend fun importBackup(content: BackupContent, replaceExisting: Boolean): Int {
        if (replaceExisting) {
            clearAll()
            projectDao.deleteAll()
        }

        val existing = projectDao.getAll().associateBy { it.name }
        val idMap = mutableMapOf<Long, Long>()
        content.projects.forEach { imported ->
            val current = existing[imported.name]
            val newId = current?.id ?: projectDao.insert(imported.copy(id = 0))
            idMap[imported.id] = newId
        }

        val prepared = content.tasks.map { task ->
            task.copy(id = 0, projectId = task.projectId?.let { idMap[it] })
        }
        taskDao.insertAll(prepared)
        refresh()
        return prepared.size
    }

    /** يعيد جدولة كل التنبيهات ويحدّث الويدجت */
    suspend fun refresh() {
        val all = taskDao.getAll()
        ReminderScheduler.rescheduleAll(context, all)
        MahamiWidget.refresh(context)
        TodayWidget.refresh(context)
    }

    private suspend fun log(entry: ActivityEntry) = runCatching { activityDao.insert(entry) }

    companion object {
        /**
         * التاريخ التالي لمهمة متكررة، أو null إن كانت غير متكررة.
         * يدعم التكرار كل عدة أيام، والتكرار في أيام محددة من الأسبوع.
         */
        fun nextOccurrence(
            from: LocalDate,
            repeat: Repeat,
            interval: Int = 2,
            days: List<Int> = emptyList()
        ): LocalDate? = when (repeat) {
            Repeat.NONE -> null
            Repeat.DAILY -> from.plusDays(1)
            Repeat.WEEKLY -> from.plusWeeks(1)
            Repeat.MONTHLY -> from.plusMonths(1)
            Repeat.EVERY_N_DAYS -> from.plusDays(interval.coerceIn(1, 365).toLong())
            Repeat.WEEKDAYS -> {
                val wanted = days.filter { it in 1..7 }.toSortedSet()
                if (wanted.isEmpty()) from.plusWeeks(1)
                else {
                    var candidate = from.plusDays(1)
                    var guard = 0
                    while (candidate.dayOfWeek.value !in wanted && guard < 14) {
                        candidate = candidate.plusDays(1)
                        guard++
                    }
                    candidate
                }
            }
        }

        @Volatile private var INSTANCE: Repository? = null

        fun get(context: Context): Repository = INSTANCE ?: synchronized(this) {
            INSTANCE ?: run {
                val db = AppDatabase.get(context)
                Repository(
                    context.applicationContext,
                    db.taskDao(),
                    db.projectDao(),
                    db.activityDao(),
                    db.focusDao(),
                    db.customTemplateDao(),
                    db.commentDao(),
                    db.tombstoneDao()
                ).also { INSTANCE = it }
            }
        }
    }
}
