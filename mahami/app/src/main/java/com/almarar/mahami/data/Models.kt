package com.almarar.mahami.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit

/** أولوية المهمة */
enum class Priority(val label: String) {
    HIGH("عالية"), MEDIUM("متوسطة"), LOW("منخفضة")
}

/** حالة المهمة */
enum class TaskStatus(val label: String) {
    PENDING("لم تبدأ"), IN_PROGRESS("قيد التنفيذ"), DONE("مكتملة")
}

/** تكرار المهمة بعد إنجازها */
enum class Repeat(val label: String) {
    NONE("بدون"), DAILY("يومي"), WEEKLY("أسبوعي"), MONTHLY("شهري")
}

/** خطوة فرعية داخل المهمة */
data class SubTask(val title: String, val done: Boolean = false)

/** رابط مرفق بالمهمة (ملف سحابي، صفحة، نظام داخلي) */
data class TaskLink(val title: String, val url: String)

/** مشروع أو جهة تُجمَع تحتها المهام */
@Entity(tableName = "projects")
data class Project(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val colorArgb: Long,
    val createdAt: LocalDateTime = LocalDateTime.now()
)

/** نوع الحدث في سجل نشاط المهمة */
enum class ActivityType(val label: String) {
    CREATED("أُنشئت"),
    EDITED("عُدّلت"),
    STATUS("تغيّرت الحالة"),
    POSTPONED("أُجّلت"),
    STEP("خطوة"),
    COMPLETED("اكتملت"),
    REOPENED("أُعيد فتحها")
}

@Entity(tableName = "activity")
data class ActivityEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val taskId: Long,
    val type: ActivityType,
    val text: String,
    val at: LocalDateTime = LocalDateTime.now()
)

@Entity(tableName = "tasks")
data class Task(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val details: String = "",
    val notes: String = "",
    /** المشروع أو الجهة التابعة لها المهمة */
    val projectId: Long? = null,
    /** وسوم حرة للتصفية */
    val tags: List<String> = emptyList(),
    /** الشخص أو الإدارة المسؤولة عن المتابعة */
    val owner: String = "",
    val dueDate: LocalDate,
    val dueTime: LocalTime = LocalTime.of(9, 0),
    /** موعد غير محدد بدقة (مثل: خلال الأسبوع القادم) */
    val flexibleDeadline: Boolean = false,
    val priority: Priority = Priority.MEDIUM,
    val status: TaskStatus = TaskStatus.PENDING,
    val subTasks: List<SubTask> = emptyList(),
    val links: List<TaskLink> = emptyList(),
    val remindersEnabled: Boolean = true,
    /** أيام التنبيه قبل الموعد، مثل [3,1,0] */
    val reminderOffsetsDays: List<Int> = listOf(1, 0),
    val repeat: Repeat = Repeat.NONE,
    val pinned: Boolean = false,
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val completedAt: LocalDateTime? = null,
    /** تنبيه يظهر داخل التفاصيل (تعارض تاريخ، معلومة تحتاج تأكيداً) */
    val alert: String = ""
) {
    val dueDateTime: LocalDateTime get() = LocalDateTime.of(dueDate, dueTime)

    val progress: Float
        get() = when {
            status == TaskStatus.DONE -> 1f
            subTasks.isEmpty() -> if (status == TaskStatus.IN_PROGRESS) 0.45f else 0f
            else -> subTasks.count { it.done }.toFloat() / subTasks.size
        }

    /** هل تجاوزت موعدها بالنسبة إلى لحظة مرجعية */
    fun isOverdue(now: LocalDateTime = LocalDateTime.now()): Boolean =
        status != TaskStatus.DONE && dueDateTime.isBefore(now)

    fun daysLeft(today: LocalDate = LocalDate.now()): Long =
        ChronoUnit.DAYS.between(today, dueDate)

    /** هل سُلّمت في موعدها؟ null إن لم تكتمل بعد */
    fun deliveredOnTime(): Boolean? =
        completedAt?.let { !it.toLocalDate().isAfter(dueDate) }
}

class Converters {
    @TypeConverter fun dateToString(v: LocalDate?): String? = v?.toString()
    @TypeConverter fun stringToDate(v: String?): LocalDate? = v?.let { LocalDate.parse(it) }

    @TypeConverter fun timeToString(v: LocalTime?): String? = v?.toString()
    @TypeConverter fun stringToTime(v: String?): LocalTime? = v?.let { LocalTime.parse(it) }

    @TypeConverter fun dateTimeToString(v: LocalDateTime?): String? = v?.toString()
    @TypeConverter fun stringToDateTime(v: String?): LocalDateTime? = v?.let { LocalDateTime.parse(it) }

    @TypeConverter fun subTasksToString(v: List<SubTask>): String =
        v.joinToString(UNIT) { "${it.done}$FIELD${it.title}" }

    @TypeConverter fun stringToSubTasks(v: String): List<SubTask> =
        if (v.isBlank()) emptyList() else v.split(UNIT).mapNotNull { chunk ->
            val parts = chunk.split(FIELD, limit = 2)
            if (parts.size == 2) SubTask(parts[1], parts[0].toBoolean()) else null
        }

    @TypeConverter fun linksToString(v: List<TaskLink>): String =
        v.joinToString(UNIT) { "${it.title}$FIELD${it.url}" }

    @TypeConverter fun stringToLinks(v: String): List<TaskLink> =
        if (v.isBlank()) emptyList() else v.split(UNIT).mapNotNull { chunk ->
            val parts = chunk.split(FIELD, limit = 2)
            if (parts.size == 2) TaskLink(parts[0], parts[1]) else null
        }

    @TypeConverter fun tagsToString(v: List<String>): String = v.joinToString(UNIT)
    @TypeConverter fun stringToTags(v: String): List<String> =
        if (v.isBlank()) emptyList() else v.split(UNIT).filter { it.isNotBlank() }

    @TypeConverter fun intsToString(v: List<Int>): String = v.joinToString(",")
    @TypeConverter fun stringToInts(v: String): List<Int> =
        if (v.isBlank()) emptyList() else v.split(",").mapNotNull { it.trim().toIntOrNull() }

    @TypeConverter fun priorityToString(v: Priority): String = v.name
    @TypeConverter fun stringToPriority(v: String): Priority = Priority.valueOf(v)

    @TypeConverter fun statusToString(v: TaskStatus): String = v.name
    @TypeConverter fun stringToStatus(v: String): TaskStatus = TaskStatus.valueOf(v)

    @TypeConverter fun repeatToString(v: Repeat): String = v.name
    @TypeConverter fun stringToRepeat(v: String): Repeat = Repeat.valueOf(v)

    @TypeConverter fun activityTypeToString(v: ActivityType): String = v.name
    @TypeConverter fun stringToActivityType(v: String): ActivityType = ActivityType.valueOf(v)

    private companion object {
        /** فواصل غير قابلة للكتابة من المستخدم */
        const val UNIT = "␟"
        const val FIELD = "␞"
    }
}
