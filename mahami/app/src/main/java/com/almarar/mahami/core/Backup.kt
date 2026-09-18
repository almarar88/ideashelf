package com.almarar.mahami.core

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.almarar.mahami.data.Priority
import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Repeat
import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskLink
import com.almarar.mahami.data.TaskStatus
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/** نتيجة قراءة نسخة احتياطية */
data class BackupContent(val tasks: List<Task>, val projects: List<Project>)

/** تصدير واستيراد البيانات: نسخة JSON كاملة، وملف تقويم ICS */
object Backup {

    const val VERSION = 2

    fun toJson(tasks: List<Task>, projects: List<Project>): String {
        val projectArray = JSONArray()
        projects.forEach { p ->
            projectArray.put(
                JSONObject()
                    .put("id", p.id)
                    .put("name", p.name)
                    .put("colorArgb", p.colorArgb)
            )
        }

        val taskArray = JSONArray()
        tasks.forEach { t ->
            taskArray.put(
                JSONObject()
                    .put("title", t.title)
                    .put("details", t.details)
                    .put("notes", t.notes)
                    .put("alert", t.alert)
                    .put("projectId", t.projectId ?: JSONObject.NULL)
                    .put("tags", JSONArray(t.tags))
                    .put("owner", t.owner)
                    .put("dueDate", t.dueDate.toString())
                    .put("dueTime", t.dueTime.toString())
                    .put("flexibleDeadline", t.flexibleDeadline)
                    .put("priority", t.priority.name)
                    .put("status", t.status.name)
                    .put("repeat", t.repeat.name)
                    .put("pinned", t.pinned)
                    .put("remindersEnabled", t.remindersEnabled)
                    .put("reminderOffsetsDays", JSONArray(t.reminderOffsetsDays))
                    .put("completedAt", t.completedAt?.toString() ?: JSONObject.NULL)
                    .put(
                        "subTasks",
                        JSONArray().apply {
                            t.subTasks.forEach { s ->
                                put(JSONObject().put("title", s.title).put("done", s.done))
                            }
                        }
                    )
                    .put(
                        "links",
                        JSONArray().apply {
                            t.links.forEach { l ->
                                put(JSONObject().put("title", l.title).put("url", l.url))
                            }
                        }
                    )
            )
        }

        return JSONObject()
            .put("app", "mahami")
            .put("version", VERSION)
            .put("exportedAt", LocalDateTime.now().toString())
            .put("projects", projectArray)
            .put("tasks", taskArray)
            .toString(2)
    }

    fun fromJson(raw: String): BackupContent {
        val root = JSONObject(raw)

        val projectsJson = root.optJSONArray("projects") ?: JSONArray()
        val projects = (0 until projectsJson.length()).mapNotNull { i ->
            val o = projectsJson.optJSONObject(i) ?: return@mapNotNull null
            val name = o.optString("name").trim()
            if (name.isBlank()) null
            else Project(
                id = o.optLong("id"),
                name = name,
                colorArgb = o.optLong("colorArgb", 0xFF2E9BF0)
            )
        }

        val tasksJson = root.optJSONArray("tasks") ?: JSONArray()
        val tasks = (0 until tasksJson.length()).mapNotNull { i ->
            val o = tasksJson.optJSONObject(i) ?: return@mapNotNull null
            val title = o.optString("title").trim()
            if (title.isBlank()) return@mapNotNull null

            val subs = o.optJSONArray("subTasks")?.let { arr ->
                (0 until arr.length()).mapNotNull { j ->
                    arr.optJSONObject(j)?.let { SubTask(it.optString("title"), it.optBoolean("done")) }
                }
            }.orEmpty()

            val links = o.optJSONArray("links")?.let { arr ->
                (0 until arr.length()).mapNotNull { j ->
                    arr.optJSONObject(j)?.let { TaskLink(it.optString("title"), it.optString("url")) }
                }
            }.orEmpty().filter { it.url.isNotBlank() }

            val tags = o.optJSONArray("tags")?.let { arr ->
                (0 until arr.length()).mapNotNull { j -> arr.optString(j).takeIf { it.isNotBlank() } }
            }.orEmpty()

            val offsets = o.optJSONArray("reminderOffsetsDays")?.let { arr ->
                (0 until arr.length()).map { arr.optInt(it) }
            }.orEmpty().ifEmpty { listOf(1, 0) }

            Task(
                title = title,
                details = o.optString("details"),
                notes = o.optString("notes"),
                alert = o.optString("alert"),
                projectId = if (o.isNull("projectId")) null else o.optLong("projectId"),
                tags = tags,
                owner = o.optString("owner"),
                dueDate = runCatching { LocalDate.parse(o.optString("dueDate")) }
                    .getOrElse { LocalDate.now() },
                dueTime = runCatching { LocalTime.parse(o.optString("dueTime")) }
                    .getOrElse { LocalTime.of(9, 0) },
                flexibleDeadline = o.optBoolean("flexibleDeadline"),
                priority = runCatching { Priority.valueOf(o.optString("priority")) }
                    .getOrDefault(Priority.MEDIUM),
                status = runCatching { TaskStatus.valueOf(o.optString("status")) }
                    .getOrDefault(TaskStatus.PENDING),
                repeat = runCatching { Repeat.valueOf(o.optString("repeat")) }
                    .getOrDefault(Repeat.NONE),
                pinned = o.optBoolean("pinned"),
                remindersEnabled = o.optBoolean("remindersEnabled", true),
                reminderOffsetsDays = offsets,
                subTasks = subs,
                links = links,
                completedAt = runCatching {
                    o.optString("completedAt").takeIf { it.isNotBlank() && it != "null" }
                        ?.let { LocalDateTime.parse(it) }
                }.getOrNull()
            )
        }

        return BackupContent(tasks, projects)
    }

    /** ملف تقويم قياسي يفتح في تقويم جوجل وأبل وأوتلوك */
    fun toIcs(tasks: List<Task>): String = buildString {
        appendLine("BEGIN:VCALENDAR")
        appendLine("VERSION:2.0")
        appendLine("PRODID:-//Mahami//Tasks//AR")
        appendLine("CALSCALE:GREGORIAN")
        tasks.forEach { t ->
            val start = LocalDateTime.of(t.dueDate, t.dueTime)
            val end = start.plusHours(1)
            appendLine("BEGIN:VEVENT")
            appendLine("UID:mahami-${t.id}-${t.dueDate}@mahami.app")
            appendLine("DTSTAMP:${stamp(LocalDateTime.now())}")
            appendLine("DTSTART:${stamp(start)}")
            appendLine("DTEND:${stamp(end)}")
            appendLine("SUMMARY:${escape(t.title)}")
            val description = listOfNotNull(
                t.details.takeIf { it.isNotBlank() },
                t.owner.takeIf { it.isNotBlank() }?.let { "جهة المتابعة: $it" },
                t.subTasks.takeIf { it.isNotEmpty() }?.joinToString(" • ") { it.title }
            ).joinToString(" | ")
            if (description.isNotBlank()) appendLine("DESCRIPTION:${escape(description)}")
            appendLine("STATUS:${if (t.status == TaskStatus.DONE) "CONFIRMED" else "TENTATIVE"}")
            appendLine("BEGIN:VALARM")
            appendLine("TRIGGER:-P1D")
            appendLine("ACTION:DISPLAY")
            appendLine("DESCRIPTION:${escape("تذكير: ${t.title}")}")
            appendLine("END:VALARM")
            appendLine("END:VEVENT")
        }
        append("END:VCALENDAR")
    }

    /** تقرير نصي جاهز للمشاركة */
    fun toText(tasks: List<Task>, today: LocalDate = LocalDate.now()): String = buildString {
        appendLine("تقرير المهام — ${Ar.fullDate(today)}")
        appendLine()
        val done = tasks.count { it.status == TaskStatus.DONE }
        appendLine("المنجز: $done من ${tasks.size}")
        appendLine()
        tasks.sortedWith(compareBy({ it.status == TaskStatus.DONE }, { it.dueDate })).forEach { t ->
            val mark = when {
                t.status == TaskStatus.DONE -> "[مكتملة]"
                t.dueDate.isBefore(today) -> "[متأخرة]"
                else -> "[${Ar.relative(t.dueDate, today)}]"
            }
            appendLine("$mark ${t.title} — ${Ar.fullDate(t.dueDate)}")
        }
    }.trim()

    private fun stamp(dt: LocalDateTime): String = "%04d%02d%02dT%02d%02d00".format(
        dt.year, dt.monthValue, dt.dayOfMonth, dt.hour, dt.minute
    )

    private fun escape(text: String): String = text
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")

    /** يكتب الملف في الذاكرة المؤقتة ويعيد Uri قابلاً للمشاركة */
    fun writeShareable(context: Context, fileName: String, content: String): Uri {
        val dir = File(context.cacheDir, "shared").apply { mkdirs() }
        val file = File(dir, fileName)
        file.writeText(content, Charsets.UTF_8)
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun shareFile(context: Context, uri: Uri, mime: String, title: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, title)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, title))
    }

    fun shareText(context: Context, subject: String, body: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, body)
        }
        context.startActivity(Intent.createChooser(intent, subject))
    }

    fun readText(context: Context, uri: Uri): String =
        context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }.orEmpty()
}
