package com.almarar.mahami.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/** أولوية المهمة */
enum class Priority(val label: String) {
    HIGH("عالية"), MEDIUM("متوسطة"), LOW("منخفضة")
}

/** حالة المهمة */
enum class TaskStatus(val label: String) {
    PENDING("لم تبدأ"), IN_PROGRESS("قيد التنفيذ"), DONE("مكتملة")
}

/** تكرار المهمة */
enum class Repeat(val label: String) {
    NONE("بدون"), DAILY("يومي"), WEEKLY("أسبوعي"), MONTHLY("شهري")
}

data class SubTask(val title: String, val done: Boolean = false)

@Entity(tableName = "tasks")
data class Task(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val details: String = "",
    val notes: String = "",
    /** الجهة أو التصنيف */
    val category: String = "عام",
    /** الشخص المسؤول عن المتابعة */
    val owner: String = "",
    val dueDate: LocalDate,
    /** وقت التسليم داخل اليوم */
    val dueTime: LocalTime = LocalTime.of(9, 0),
    /** موعد غير محدد بدقة (مثل: خلال الأسبوع القادم) */
    val flexibleDeadline: Boolean = false,
    val priority: Priority = Priority.MEDIUM,
    val status: TaskStatus = TaskStatus.PENDING,
    val subTasks: List<SubTask> = emptyList(),
    val remindersEnabled: Boolean = true,
    /** أيام التنبيه قبل الموعد، مثل [3,1,0] */
    val reminderOffsetsDays: List<Int> = listOf(3, 1, 0),
    val repeat: Repeat = Repeat.NONE,
    val pinned: Boolean = false,
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val completedAt: LocalDateTime? = null,
    /** ملاحظة تحذيرية تظهر داخل التفاصيل */
    val warning: String = ""
) {
    val dueDateTime: LocalDateTime get() = LocalDateTime.of(dueDate, dueTime)

    val progress: Float
        get() = when {
            status == TaskStatus.DONE -> 1f
            subTasks.isEmpty() -> if (status == TaskStatus.IN_PROGRESS) 0.45f else 0f
            else -> subTasks.count { it.done }.toFloat() / subTasks.size
        }

    fun isOverdue(now: LocalDateTime = LocalDateTime.now()): Boolean =
        status != TaskStatus.DONE && dueDateTime.isBefore(now)

    fun daysLeft(today: LocalDate = LocalDate.now()): Long =
        java.time.temporal.ChronoUnit.DAYS.between(today, dueDate)
}

class Converters {
    @TypeConverter fun dateToString(v: LocalDate?): String? = v?.toString()
    @TypeConverter fun stringToDate(v: String?): LocalDate? = v?.let { LocalDate.parse(it) }

    @TypeConverter fun timeToString(v: LocalTime?): String? = v?.toString()
    @TypeConverter fun stringToTime(v: String?): LocalTime? = v?.let { LocalTime.parse(it) }

    @TypeConverter fun dateTimeToString(v: LocalDateTime?): String? = v?.toString()
    @TypeConverter fun stringToDateTime(v: String?): LocalDateTime? = v?.let { LocalDateTime.parse(it) }

    @TypeConverter fun subTasksToString(v: List<SubTask>): String =
        v.joinToString("␟") { "${it.done}␞${it.title}" }

    @TypeConverter fun stringToSubTasks(v: String): List<SubTask> =
        if (v.isBlank()) emptyList() else v.split("␟").mapNotNull { chunk ->
            val parts = chunk.split("␞", limit = 2)
            if (parts.size == 2) SubTask(parts[1], parts[0].toBoolean()) else null
        }

    @TypeConverter fun intsToString(v: List<Int>): String = v.joinToString(",")
    @TypeConverter fun stringToInts(v: String): List<Int> =
        if (v.isBlank()) emptyList() else v.split(",").mapNotNull { it.trim().toIntOrNull() }

    @TypeConverter fun priorityToString(v: Priority): String = v.name
    @TypeConverter fun stringToPriority(v: String): Priority = Priority.valueOf(v)

    @TypeConverter fun statusToString(v: TaskStatus): String = v.name
    @TypeConverter fun stringToStatus(v: String): TaskStatus = TaskStatus.valueOf(v)

    @TypeConverter fun repeatToString(v: Repeat): String = v.name
    @TypeConverter fun stringToRepeat(v: String): Repeat = Repeat.valueOf(v)
}
