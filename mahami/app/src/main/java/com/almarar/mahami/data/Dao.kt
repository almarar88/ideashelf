package com.almarar.mahami.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY pinned DESC, dueDate ASC, dueTime ASC")
    fun observeAll(): Flow<List<Task>>

    @Query("SELECT * FROM tasks ORDER BY pinned DESC, dueDate ASC, dueTime ASC")
    suspend fun getAll(): List<Task>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getById(id: Long): Task?

    @Query("SELECT COUNT(*) FROM tasks")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(task: Task): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tasks: List<Task>)

    @Update
    suspend fun update(task: Task)

    @Delete
    suspend fun delete(task: Task)

    @Query("DELETE FROM tasks")
    suspend fun deleteAll()
}

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects ORDER BY createdAt ASC")
    fun observeAll(): Flow<List<Project>>

    @Query("SELECT * FROM projects ORDER BY createdAt ASC")
    suspend fun getAll(): List<Project>

    @Query("SELECT COUNT(*) FROM projects")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(project: Project): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(projects: List<Project>)

    @Update
    suspend fun update(project: Project)

    @Delete
    suspend fun delete(project: Project)

    @Query("DELETE FROM projects")
    suspend fun deleteAll()
}

@Dao
interface ActivityDao {
    @Query("SELECT * FROM activity WHERE taskId = :taskId ORDER BY at DESC LIMIT 40")
    fun observeForTask(taskId: Long): Flow<List<ActivityEntry>>

    @Query("SELECT * FROM activity ORDER BY at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 60): Flow<List<ActivityEntry>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: ActivityEntry)

    @Query("DELETE FROM activity WHERE taskId = :taskId")
    suspend fun deleteForTask(taskId: Long)

    @Query("DELETE FROM activity")
    suspend fun deleteAll()
}

@Dao
interface FocusDao {
    @Query("SELECT * FROM focus_sessions ORDER BY at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 120): Flow<List<FocusSession>>

    @Query("SELECT * FROM focus_sessions ORDER BY at DESC")
    suspend fun getAll(): List<FocusSession>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: FocusSession)

    @Query("DELETE FROM focus_sessions WHERE taskId = :taskId")
    suspend fun deleteForTask(taskId: Long)

    @Query("DELETE FROM focus_sessions")
    suspend fun deleteAll()
}

@Dao
interface CustomTemplateDao {
    @Query("SELECT * FROM custom_templates ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<CustomTemplate>>

    @Query("SELECT COUNT(*) FROM custom_templates")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(template: CustomTemplate): Long

    @Delete
    suspend fun delete(template: CustomTemplate)
}
