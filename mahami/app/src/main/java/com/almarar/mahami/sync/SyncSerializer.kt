package com.almarar.mahami.sync

import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskLink
import com.almarar.mahami.data.TaskStatus
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/** تحويل السجلات إلى JSON والعكس لأغراض المزامنة */
object SyncSerializer {

    const val KIND_TASK = "task"
    const val KIND_PROJECT = "project"

    fun taskToJson(task: Task): JSONObject = JSONObject()
        .put("title", task.title)
        .put("details", task.details)
        .put("notes", task.notes)
        .put("alert", task.alert)
        .put("projectSyncId", JSONObject.NULL)
        .put("tags", JSONArray(task.tags))
        .put("owner", task.owner)
        .put("dueDate", task.dueDate.toString())
        .put("dueTime", task.dueTime.toString())
        .put("flexibleDeadline", task.flexibleDeadline)
        .put("priority", task.priority.name)
        .put("status", task.status.name)
        .put("repeat", task.repeat.name)
        .put("repeatInterval", task.repeatInterval)
        .put("repeatDays", JSONArray(task.repeatDays))
        .put("pinned", task.pinned)
        .put("important", task.important)
        .put("estimateMinutes", task.estimateMinutes)
        .put("focusMinutes", task.focusMinutes)
        .put("remindersEnabled", task.remindersEnabled)
        .put("reminderOffsetsDays", JSONArray(task.reminderOffsetsDays))
        .put("mitDate", task.mitDate?.toString() ?: JSONObject.NULL)
        .put("completedAt", task.completedAt?.toString() ?: JSONObject.NULL)
        .put("createdAt", task.createdAt.toString())
        .put(
            "subTasks",
            JSONArray().apply {
                task.subTasks.forEach { step ->
                    put(
                        JSONObject()
                            .put("title", step.title)
                            .put("done", step.done)
                            .put("targetDate", step.targetDate?.toString() ?: JSONObject.NULL)
                    )
                }
            }
        )
        .put(
            "links",
            JSONArray().apply {
                task.links.forEach { link ->
                    put(JSONObject().put("title", link.title).put("url", link.url))
                }
            }
        )

    fun jsonToTask(syncId: String, json: JSONObject, updatedAt: LocalDateTime): Task? {
        val title = json.optString("title").trim()
        if (title.isBlank()) return null

        val subTasks = json.optJSONArray("subTasks")?.let { array ->
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { item ->
                    SubTask(
                        title = item.optString("title"),
                        done = item.optBoolean("done"),
                        targetDate = item.optString("targetDate").takeIf { it.isNotBlank() && it != "null" }
                            ?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                    )
                }
            }
        }.orEmpty()

        val links = json.optJSONArray("links")?.let { array ->
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { TaskLink(it.optString("title"), it.optString("url")) }
            }
        }.orEmpty()

        return Task(
            title = title,
            details = json.optString("details"),
            notes = json.optString("notes"),
            alert = json.optString("alert"),
            tags = json.optJSONArray("tags").toStringList(),
            owner = json.optString("owner"),
            dueDate = json.optString("dueDate").toLocalDateOr(LocalDate.now()),
            dueTime = runCatching { LocalTime.parse(json.optString("dueTime")) }
                .getOrElse { LocalTime.of(9, 0) },
            flexibleDeadline = json.optBoolean("flexibleDeadline"),
            priority = runCatching { Priority.valueOf(json.optString("priority")) }
                .getOrDefault(Priority.MEDIUM),
            status = runCatching { TaskStatus.valueOf(json.optString("status")) }
                .getOrDefault(TaskStatus.PENDING),
            repeat = runCatching { Repeat.valueOf(json.optString("repeat")) }
                .getOrDefault(Repeat.NONE),
            repeatInterval = json.optInt("repeatInterval", 2),
            repeatDays = json.optJSONArray("repeatDays").toIntList(),
            pinned = json.optBoolean("pinned"),
            important = json.optBoolean("important"),
            estimateMinutes = json.optInt("estimateMinutes"),
            focusMinutes = json.optInt("focusMinutes"),
            remindersEnabled = json.optBoolean("remindersEnabled", true),
            reminderOffsetsDays = json.optJSONArray("reminderOffsetsDays").toIntList()
                .ifEmpty { listOf(1, 0) },
            subTasks = subTasks,
            links = links,
            mitDate = json.optString("mitDate").takeIf { it.isNotBlank() && it != "null" }
                ?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
            completedAt = json.optString("completedAt").takeIf { it.isNotBlank() && it != "null" }
                ?.let { runCatching { LocalDateTime.parse(it) }.getOrNull() },
            createdAt = runCatching { LocalDateTime.parse(json.optString("createdAt")) }
                .getOrElse { updatedAt },
            syncId = syncId,
            updatedAt = updatedAt
        )
    }

    fun projectToJson(project: Project): JSONObject = JSONObject()
        .put("name", project.name)
        .put("colorArgb", project.colorArgb)
        .put("createdAt", project.createdAt.toString())

    fun jsonToProject(syncId: String, json: JSONObject, updatedAt: LocalDateTime): Project? {
        val name = json.optString("name").trim()
        if (name.isBlank()) return null
        return Project(
            name = name,
            colorArgb = json.optLong("colorArgb", 0xFF2E9BF0),
            createdAt = runCatching { LocalDateTime.parse(json.optString("createdAt")) }
                .getOrElse { updatedAt },
            syncId = syncId,
            updatedAt = updatedAt
        )
    }

    private fun JSONArray?.toStringList(): List<String> =
        if (this == null) emptyList()
        else (0 until length()).mapNotNull { optString(it).takeIf { value -> value.isNotBlank() } }

    private fun JSONArray?.toIntList(): List<Int> =
        if (this == null) emptyList() else (0 until length()).map { optInt(it) }

    private fun String.toLocalDateOr(fallback: LocalDate): LocalDate =
        runCatching { LocalDate.parse(this) }.getOrElse { fallback }
}
