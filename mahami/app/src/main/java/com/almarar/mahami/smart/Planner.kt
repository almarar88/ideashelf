package com.almarar.mahami.smart

import com.almarar.mahami.data.SubTask
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** يوم في خطة التنفيذ مع الخطوات المسندة إليه */
data class PlanDay(val date: LocalDate, val steps: List<String>)

/**
 * مخطّط تنفيذ حتمي: يوزّع خطوات المهمة على الأيام المتبقية حتى الموعد النهائي،
 * فيتحوّل «تسليم بعد أسبوع» إلى جدول يومي واضح بدل ضغط اللحظة الأخيرة.
 *
 * القواعد:
 * - يبدأ من اليوم وينتهي قبل يوم التسليم بيوم واحد كهامش أمان (إن أمكن).
 * - يتجنّب الجمعة والسبت ما لم تكن المدة ضيقة.
 * - يوزّع الخطوات بالتساوي، والزائد يذهب للأيام الأولى لا الأخيرة.
 */
object Planner {

    fun plan(
        task: Task,
        today: LocalDate = LocalDate.now(),
        skipWeekend: Boolean = true
    ): List<PlanDay> {
        val steps = task.subTasks.filter { !it.done }.map { it.title }
        if (steps.isEmpty()) return emptyList()

        val days = workingDays(today, task.dueDate, steps.size, skipWeekend)
        if (days.isEmpty()) return listOf(PlanDay(task.dueDate, steps))

        val perDay = steps.size / days.size
        val remainder = steps.size % days.size
        val result = mutableListOf<PlanDay>()
        var index = 0
        days.forEachIndexed { dayIndex, date ->
            val extra = if (dayIndex < remainder) 1 else 0
            val count = perDay + extra
            if (count > 0 && index < steps.size) {
                val slice = steps.subList(index, minOf(index + count, steps.size))
                result += PlanDay(date, slice.toList())
                index += slice.size
            }
        }
        if (index < steps.size && result.isNotEmpty()) {
            val last = result.removeAt(result.lastIndex)
            result += PlanDay(last.date, last.steps + steps.subList(index, steps.size))
        }
        return result
    }

    /** يطبّق الخطة على المهمة بإسناد يوم مستهدف لكل خطوة */
    fun applyTo(task: Task, today: LocalDate = LocalDate.now()): Task {
        val plan = plan(task, today)
        if (plan.isEmpty()) return task
        val dateByStep = plan.flatMap { day -> day.steps.map { it to day.date } }.toMap()
        return task.copy(
            subTasks = task.subTasks.map { step ->
                if (step.done) step else step.copy(targetDate = dateByStep[step.title] ?: step.targetDate)
            }
        )
    }

    /** خطوات مستحقة اليوم عبر كل المهام */
    fun stepsDueToday(tasks: List<Task>, today: LocalDate = LocalDate.now()): List<Pair<Task, SubTask>> =
        tasks.filter { it.status != TaskStatus.DONE }
            .flatMap { task ->
                task.subTasks
                    .filter { !it.done && it.targetDate != null && !it.targetDate.isAfter(today) }
                    .map { task to it }
            }
            .sortedBy { it.first.dueDate }

    private fun workingDays(
        today: LocalDate,
        due: LocalDate,
        stepCount: Int,
        skipWeekend: Boolean
    ): List<LocalDate> {
        val span = ChronoUnit.DAYS.between(today, due).toInt()
        if (span <= 0) return listOf(due)

        // هامش أمان: ننهي قبل يوم التسليم إن كانت المدة ثلاثة أيام فأكثر
        val lastDay = if (span >= 3) due.minusDays(1) else due
        val all = generateSequence(today) { it.plusDays(1) }
            .takeWhile { !it.isAfter(lastDay) }
            .toList()

        val filtered = if (skipWeekend) {
            all.filter { it.dayOfWeek.value != 5 && it.dayOfWeek.value != 6 }
        } else all

        val usable = filtered.ifEmpty { all }
        return if (usable.size <= stepCount) usable else usable.take(stepCount)
    }
}
