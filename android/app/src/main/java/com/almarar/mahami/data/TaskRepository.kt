package com.almarar.mahami.data

import android.content.Context
import com.almarar.mahami.notify.ReminderScheduler
import com.almarar.mahami.widget.MahamiWidget
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.LocalDateTime

class TaskRepository(private val context: Context, private val dao: TaskDao) {

    val tasks: Flow<List<Task>> = dao.observeAll()

    fun task(id: Long): Flow<Task?> = dao.observeById(id)

    private val seedLock = Mutex()

    suspend fun seedIfEmpty() {
        seedLock.withLock {
            if (dao.count() == 0) {
                dao.insertAll(SeedData.tasks())
                refreshSideEffects()
            }
        }
    }

    suspend fun resetToSeed() {
        dao.getAll().forEach { dao.delete(it) }
        dao.insertAll(SeedData.tasks())
        refreshSideEffects()
    }

    suspend fun upsert(task: Task): Long {
        val id = dao.insert(task)
        refreshSideEffects()
        return id
    }

    suspend fun delete(task: Task) {
        dao.delete(task)
        ReminderScheduler.cancel(context, task.id)
        refreshSideEffects()
    }

    suspend fun toggleDone(task: Task) {
        val done = task.status != TaskStatus.DONE
        val updated = task.copy(
            status = if (done) TaskStatus.DONE else TaskStatus.PENDING,
            completedAt = if (done) LocalDateTime.now() else null,
            subTasks = if (done) task.subTasks.map { it.copy(done = true) } else task.subTasks
        )
        dao.update(updated)
        if (done) ReminderScheduler.cancel(context, task.id)
        refreshSideEffects()
    }

    suspend fun setStatus(task: Task, status: TaskStatus) {
        dao.update(
            task.copy(
                status = status,
                completedAt = if (status == TaskStatus.DONE) LocalDateTime.now() else null
            )
        )
        refreshSideEffects()
    }

    suspend fun togglePinned(task: Task) {
        dao.update(task.copy(pinned = !task.pinned))
        refreshSideEffects()
    }

    suspend fun toggleSubTask(task: Task, index: Int) {
        val list = task.subTasks.toMutableList()
        if (index !in list.indices) return
        list[index] = list[index].copy(done = !list[index].done)
        val allDone = list.isNotEmpty() && list.all { it.done }
        dao.update(
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
        refreshSideEffects()
    }

    suspend fun snooze(taskId: Long, minutes: Long) {
        val task = dao.getById(taskId) ?: return
        ReminderScheduler.scheduleSnooze(context, task, minutes)
    }

    suspend fun markDoneById(taskId: Long) {
        val task = dao.getById(taskId) ?: return
        if (task.status != TaskStatus.DONE) toggleDone(task)
    }

    suspend fun refreshSideEffects() {
        val all = dao.getAll()
        ReminderScheduler.rescheduleAll(context, all)
        MahamiWidget.refresh(context)
    }

    suspend fun all(): List<Task> = dao.getAll()

    companion object {
        @Volatile private var INSTANCE: TaskRepository? = null
        fun get(context: Context): TaskRepository = INSTANCE ?: synchronized(this) {
            INSTANCE ?: TaskRepository(
                context.applicationContext,
                AppDatabase.get(context).taskDao()
            ).also { INSTANCE = it }
        }
    }
}
