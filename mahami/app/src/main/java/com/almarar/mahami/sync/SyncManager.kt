package com.almarar.mahami.sync

import android.content.Context
import com.almarar.mahami.data.AppDatabase
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.Tombstone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class SyncState(
    val running: Boolean = false,
    val lastSync: Long = 0L,
    val message: String = "",
    val error: String = "",
    val pushed: Int = 0,
    val pulled: Int = 0
)

/**
 * مزامنة ثنائية الاتجاه مع خادم Supabase.
 *
 * المبدأ: الجهاز هو مصدر الحقيقة أثناء العمل، والمزامنة تُضيف وتوحّد.
 * التعارض يُحل بالأحدث زمنياً (last write wins) اعتماداً على updatedAt،
 * والحذف يُنقل عبر سجلات حذف (tombstones) حتى يختفي من بقية الأجهزة.
 */
class SyncManager private constructor(private val context: Context) {

    private val config = SyncConfig.get(context)
    private val auth = AuthClient.get(context)
    private val repo = Repository.get(context)
    private val db = AppDatabase.get(context)
    private val lock = Mutex()

    private val _state = MutableStateFlow(SyncState())
    val state = _state.asStateFlow()

    /** يزامن الآن: يرفع التغييرات المحلية ثم يسحب تغييرات الأجهزة الأخرى */
    suspend fun syncNow(): Boolean = lock.withLock {
        val session = config.currentSession()
        if (!session.signedIn) {
            _state.value = _state.value.copy(error = "سجّل الدخول لتفعيل المزامنة.")
            return false
        }
        if (!config.isConfigured()) {
            _state.value = _state.value.copy(error = AuthClient.NOT_CONFIGURED)
            return false
        }

        _state.value = _state.value.copy(running = true, error = "", message = "جارٍ المزامنة...")

        return try {
            val token = auth.validAccessToken()
                ?: throw SyncException("انتهت الجلسة — سجّل الدخول من جديد.")

            val pushed = push(token, session.userId)
            val pulled = pull(token, session.lastSync)

            val now = System.currentTimeMillis()
            config.markSynced(now)
            repo.refresh()

            _state.value = SyncState(
                running = false,
                lastSync = now,
                message = "اكتملت المزامنة",
                pushed = pushed,
                pulled = pulled
            )
            true
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                running = false,
                error = e.message ?: "تعذّرت المزامنة"
            )
            false
        }
    }

    // ---------- الرفع ----------

    private suspend fun push(token: String, userId: String): Int {
        val rows = JSONArray()

        repo.allProjects().forEach { project ->
            rows.put(row(userId, project.syncId, SyncSerializer.KIND_PROJECT,
                SyncSerializer.projectToJson(project), project.updatedAt, false))
        }

        val projectSyncById = repo.allProjects().associate { it.id to it.syncId }
        repo.allTasks().forEach { task ->
            val payload = SyncSerializer.taskToJson(task)
            payload.put("projectSyncId", task.projectId?.let { projectSyncById[it] } ?: JSONObject.NULL)
            rows.put(row(userId, task.syncId, SyncSerializer.KIND_TASK, payload, task.updatedAt, false))
        }

        val tombstones = db.tombstoneDao().getAll()
        tombstones.forEach { stone ->
            rows.put(row(userId, stone.syncId, stone.kind, JSONObject(), stone.at, true))
        }

        if (rows.length() == 0) return 0

        val response = Http.request(
            url = "${config.baseUrl()}/rest/v1/records?on_conflict=user_id,sync_id",
            method = "POST",
            headers = mapOf(
                "apikey" to config.anonKey(),
                "Authorization" to "Bearer $token",
                "Prefer" to "resolution=merge-duplicates,return=minimal"
            ),
            body = rows.toString()
        )
        if (!response.success) throw SyncException(Http.describe(response))

        db.tombstoneDao().deleteAll()
        return rows.length()
    }

    private fun row(
        userId: String,
        syncId: String,
        kind: String,
        payload: JSONObject,
        updatedAt: LocalDateTime,
        deleted: Boolean
    ): JSONObject = JSONObject()
        .put("user_id", userId)
        .put("sync_id", syncId)
        .put("kind", kind)
        .put("payload", payload)
        .put("updated_at", updatedAt.atZone(ZoneId.systemDefault())
            .withZoneSameInstant(ZoneOffset.UTC)
            .format(DateTimeFormatter.ISO_INSTANT))
        .put("deleted", deleted)

    // ---------- السحب ----------

    private suspend fun pull(token: String, since: Long): Int {
        val response = Http.request(
            url = "${config.baseUrl()}/rest/v1/records?select=sync_id,kind,payload,updated_at,deleted",
            method = "GET",
            headers = mapOf(
                "apikey" to config.anonKey(),
                "Authorization" to "Bearer $token"
            )
        )
        if (!response.success) throw SyncException(Http.describe(response))

        val array = response.asArray()
        if (array.length() == 0) return 0

        val localProjects = repo.allProjects().associateBy { it.syncId }
        val localTasks = repo.allTasks().associateBy { it.syncId }
        var applied = 0

        // المشاريع أولاً حتى ترتبط المهام بها
        val projectIdBySyncId = localProjects.mapValues { it.value.id }.toMutableMap()

        for (index in 0 until array.length()) {
            val record = array.optJSONObject(index) ?: continue
            if (record.optString("kind") != SyncSerializer.KIND_PROJECT) continue
            val syncId = record.optString("sync_id")
            val updatedAt = parseTimestamp(record.optString("updated_at"))
            val existing = localProjects[syncId]

            if (record.optBoolean("deleted")) {
                existing?.let { repo.deleteProject(it); projectIdBySyncId.remove(syncId); applied++ }
                continue
            }

            val remote = SyncSerializer.jsonToProject(syncId, record.optJSONObject("payload") ?: JSONObject(), updatedAt)
                ?: continue

            when {
                existing == null -> {
                    val newId = repo.upsertProject(remote)
                    projectIdBySyncId[syncId] = newId
                    applied++
                }
                updatedAt.isAfter(existing.updatedAt) -> {
                    repo.upsertProject(remote.copy(id = existing.id))
                    applied++
                }
            }
        }

        for (index in 0 until array.length()) {
            val record = array.optJSONObject(index) ?: continue
            if (record.optString("kind") != SyncSerializer.KIND_TASK) continue
            val syncId = record.optString("sync_id")
            val updatedAt = parseTimestamp(record.optString("updated_at"))
            val existing = localTasks[syncId]

            if (record.optBoolean("deleted")) {
                existing?.let { repo.delete(it, recordTombstone = false); applied++ }
                continue
            }

            val payload = record.optJSONObject("payload") ?: JSONObject()
            val remote = SyncSerializer.jsonToTask(syncId, payload, updatedAt) ?: continue
            val projectSyncId = payload.optString("projectSyncId").takeIf { it.isNotBlank() && it != "null" }
            val linked = remote.copy(projectId = projectSyncId?.let { projectIdBySyncId[it] })

            when {
                existing == null -> {
                    repo.upsert(linked, touch = false)
                    applied++
                }
                updatedAt.isAfter(existing.updatedAt) -> {
                    repo.upsert(linked.copy(id = existing.id), touch = false)
                    applied++
                }
            }
        }
        return applied
    }

    private fun parseTimestamp(raw: String): LocalDateTime = runCatching {
        LocalDateTime.ofInstant(Instant.parse(raw), ZoneId.systemDefault())
    }.getOrElse {
        runCatching {
            LocalDateTime.ofInstant(
                Instant.parse(raw.replace(" ", "T").let { if (it.endsWith("Z")) it else "${it}Z" }),
                ZoneId.systemDefault()
            )
        }.getOrElse { LocalDateTime.now() }
    }

    /** يُستدعى بعد حذف محلي ليُنقل الحذف إلى بقية الأجهزة */
    suspend fun recordDeletion(syncId: String, kind: String) {
        runCatching { db.tombstoneDao().insert(Tombstone(syncId, kind)) }
    }

    fun clearMessage() {
        _state.value = _state.value.copy(message = "", error = "")
    }

    companion object {
        @Volatile private var INSTANCE: SyncManager? = null
        fun get(context: Context): SyncManager = INSTANCE ?: synchronized(this) {
            INSTANCE ?: SyncManager(context.applicationContext).also { INSTANCE = it }
        }
    }
}
