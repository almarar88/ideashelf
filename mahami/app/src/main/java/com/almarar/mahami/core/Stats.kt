package com.almarar.mahami.core

import com.almarar.mahami.data.Project
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class ProjectStat(
    val project: Project?,
    val total: Int,
    val done: Int,
    val late: Int
) {
    val rate: Float get() = if (total == 0) 0f else done.toFloat() / total
}

data class DayLoad(val date: LocalDate, val count: Int, val isToday: Boolean)

data class Insight(val title: String, val body: String, val severity: Severity)

enum class Severity { HIGH, MEDIUM, INFO }

data class TaskStats(
    val total: Int = 0,
    val done: Int = 0,
    val today: Int = 0,
    val late: Int = 0,
    val upcoming: Int = 0,
    val inProgress: Int = 0,
    val completionRate: Float = 0f,
    val onTimeRate: Float = 0f,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0
)

/**
 * إحصاءات ومؤشرات محسوبة من المهام — أرقام دقيقة لا تقديرات.
 */
object Stats {

    fun summarize(tasks: List<Task>, today: LocalDate = LocalDate.now()): TaskStats {
        val done = tasks.filter { it.status == TaskStatus.DONE }
        val onTime = done.count { it.deliveredOnTime() == true }
        val streaks = streaks(tasks, today)
        return TaskStats(
            total = tasks.size,
            done = done.size,
            today = tasks.count { it.dueDate == today && it.status != TaskStatus.DONE },
            late = tasks.count { it.status != TaskStatus.DONE && it.dueDate.isBefore(today) },
            upcoming = tasks.count { it.dueDate.isAfter(today) && it.status != TaskStatus.DONE },
            inProgress = tasks.count { it.status == TaskStatus.IN_PROGRESS },
            completionRate = if (tasks.isEmpty()) 0f else done.size.toFloat() / tasks.size,
            onTimeRate = if (done.isEmpty()) 0f else onTime.toFloat() / done.size,
            currentStreak = streaks.first,
            longestStreak = streaks.second
        )
    }

    /** سلسلة الأيام المتتالية التي أُنجزت فيها مهمة: (الحالية، الأطول) */
    fun streaks(tasks: List<Task>, today: LocalDate = LocalDate.now()): Pair<Int, Int> {
        val days = tasks.mapNotNull { it.completedAt?.toLocalDate() }.toSortedSet()
        if (days.isEmpty()) return 0 to 0

        var longest = 1
        var run = 1
        var previous: LocalDate? = null
        days.forEach { day ->
            previous?.let {
                run = if (ChronoUnit.DAYS.between(it, day) == 1L) run + 1 else 1
            }
            longest = maxOf(longest, run)
            previous = day
        }

        // السلسلة الحالية تُحتسب إن كان آخر إنجاز اليوم أو أمس
        var current = 0
        var cursor = when {
            days.contains(today) -> today
            days.contains(today.minusDays(1)) -> today.minusDays(1)
            else -> null
        }
        while (cursor != null && days.contains(cursor)) {
            current++
            cursor = cursor.minusDays(1)
        }
        return current to longest
    }

    /** توزيع المهام على الأيام السبعة القادمة */
    fun weekLoad(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<DayLoad> =
        CalendarUtils.nextSevenDays(today).map { date ->
            DayLoad(
                date = date,
                count = tasks.count { it.dueDate == date && it.status != TaskStatus.DONE },
                isToday = date == today
            )
        }

    /** إنجاز كل مشروع */
    fun byProject(tasks: List<Task>, projects: List<Project>): List<ProjectStat> {
        val grouped = tasks.groupBy { it.projectId }
        val stats = projects.map { project ->
            val list = grouped[project.id].orEmpty()
            ProjectStat(
                project = project,
                total = list.size,
                done = list.count { it.status == TaskStatus.DONE },
                late = list.count { it.status != TaskStatus.DONE && it.dueDate.isBefore(LocalDate.now()) }
            )
        }
        val orphans = grouped[null].orEmpty()
        return if (orphans.isEmpty()) stats else stats + ProjectStat(
            project = null,
            total = orphans.size,
            done = orphans.count { it.status == TaskStatus.DONE },
            late = orphans.count { it.status != TaskStatus.DONE && it.dueDate.isBefore(LocalDate.now()) }
        )
    }

    /**
     * ملاحظات محسوبة من الأرقام: ازدحام يوم، تأخّر، مواعيد مرنة،
     * ومهام لم تبدأ رغم قرب موعدها.
     */
    fun insights(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<Insight> {
        val open = tasks.filter { it.status != TaskStatus.DONE }
        if (open.isEmpty()) return emptyList()
        val notes = mutableListOf<Insight>()

        val late = open.filter { it.dueDate.isBefore(today) }
        if (late.isNotEmpty()) {
            notes += Insight(
                "مهام تجاوزت موعدها",
                late.joinToString("، ") { it.title } + ". أعد جدولتها أو أبلغ الجهة المعنية.",
                Severity.HIGH
            )
        }

        open.filter { !it.dueDate.isBefore(today) }
            .groupBy { it.dueDate }
            .filter { it.value.size >= 2 }
            .toSortedMap()
            .forEach { (date, list) ->
                notes += Insight(
                    "ازدحام يوم ${Ar.dayName(date)}",
                    "${Ar.countTasks(list.size)} في ${Ar.fullDate(date)}: " +
                        list.joinToString("، ") { it.title } + ". ابدأ ما يعتمد على غيرك قبله بيومين.",
                    if (list.size >= 3) Severity.HIGH else Severity.MEDIUM
                )
            }

        val untouched = open.filter {
            it.progress == 0f && ChronoUnit.DAYS.between(today, it.dueDate) in 0..2
        }
        if (untouched.isNotEmpty()) {
            notes += Insight(
                "لم تبدأ رغم قرب الموعد",
                untouched.joinToString("، ") { it.title } + ". خصّص لها أول ساعة من اليوم.",
                Severity.HIGH
            )
        }

        open.filter { it.flexibleDeadline }.forEach { task ->
            notes += Insight(
                "موعد غير محدد: ${task.title}",
                "الموعد مرن وخارج سيطرتك جزئياً. ثبّته باتصال مبكر" +
                    (if (task.owner.isNotBlank()) " مع ${task.owner}" else "") + ".",
                Severity.MEDIUM
            )
        }

        open.filter { it.alert.isNotBlank() }.forEach { task ->
            notes += Insight("تحقق من بيانات: ${task.title}", task.alert, Severity.MEDIUM)
        }

        return notes.sortedBy { it.severity.ordinal }
    }

    /**
     * ترتيب مقترح لليوم: الأقرب موعداً أولاً، مع تقديم ما يعتمد على رد الآخرين.
     */
    fun suggestedOrder(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<Task> =
        tasks.filter { it.status != TaskStatus.DONE }
            .sortedByDescending { task ->
                val days = ChronoUnit.DAYS.between(today, task.dueDate)
                var score = when {
                    days < 0 -> 100.0
                    days == 0L -> 90.0
                    days == 1L -> 70.0
                    days <= 3 -> 50.0
                    else -> 30.0 - days.coerceAtMost(20)
                }
                score += (2 - task.priority.ordinal) * 6.0
                if (task.owner.isNotBlank()) score += 8.0
                if (task.flexibleDeadline) score += 6.0
                score += task.progress * 4.0
                score
            }
}
