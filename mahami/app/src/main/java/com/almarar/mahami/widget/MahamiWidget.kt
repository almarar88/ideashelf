package com.almarar.mahami.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.almarar.mahami.MainActivity
import com.almarar.mahami.core.Ar
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.Task
import com.almarar.mahami.data.TaskStatus
import java.time.LocalDate

/** واجهة تحديث الويدجت من بقية أجزاء التطبيق */
object MahamiWidget {
    suspend fun refresh(context: Context) {
        runCatching { MahamiGlanceWidget().updateAll(context.applicationContext) }
    }
}

class MahamiWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MahamiGlanceWidget()
}

class MahamiGlanceWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val all = runCatching { Repository.get(context).allTasks() }.getOrDefault(emptyList())
        val open = all.filter { it.status != TaskStatus.DONE }
            .sortedWith(compareBy({ it.dueDate }, { it.dueTime }))
        val doneToday = all.count { it.completedAt?.toLocalDate() == LocalDate.now() }

        provideContent {
            GlanceTheme { WidgetBody(open.take(4), open.size, doneToday) }
        }
    }

    @Composable
    private fun WidgetBody(tasks: List<Task>, openCount: Int, doneToday: Int) {
        val today = LocalDate.now()
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(Color(0xFFEFF1F5)))
                .cornerRadius(24.dp)
                .padding(14.dp)
                .clickable(actionStartActivity<MainActivity>())
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "مهامي",
                    style = TextStyle(
                        color = ColorProvider(Color(0xFF14161A)),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
                Spacer(GlanceModifier.width(8.dp))
                Text(
                    text = if (doneToday > 0) "أنجزت $doneToday اليوم"
                    else "$openCount ${Ar.taskWord(openCount)} مفتوحة",
                    style = TextStyle(color = ColorProvider(Color(0xFF6B7280)), fontSize = 11.sp)
                )
            }
            Spacer(GlanceModifier.height(8.dp))

            if (tasks.isEmpty()) {
                Text(
                    text = "لا توجد مهام مفتوحة",
                    style = TextStyle(color = ColorProvider(Color(0xFF6B7280)), fontSize = 13.sp)
                )
            } else {
                tasks.forEach { task ->
                    WidgetRow(task, today)
                    Spacer(GlanceModifier.height(6.dp))
                }
                if (openCount > tasks.size) {
                    Text(
                        text = "+${openCount - tasks.size} أخرى",
                        style = TextStyle(color = ColorProvider(Color(0xFF2E9BF0)), fontSize = 11.sp)
                    )
                }
            }
        }
    }

    @Composable
    private fun WidgetRow(task: Task, today: LocalDate) {
        val late = task.dueDate.isBefore(today)
        val accent = when {
            late -> Color(0xFFE5484D)
            task.dueDate == today -> Color(0xFFF5A524)
            else -> Color(0xFF2E9BF0)
        }
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .background(ColorProvider(Color.White))
                .cornerRadius(16.dp)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = GlanceModifier
                    .size(20.dp)
                    .background(ColorProvider(accent))
                    .cornerRadius(10.dp)
                    .clickable(
                        actionRunCallback<CompleteTaskAction>(
                            actionParametersOf(CompleteTaskAction.taskIdKey to task.id)
                        )
                    )
            ) {}
            Spacer(GlanceModifier.width(8.dp))
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(
                    text = task.title,
                    maxLines = 1,
                    style = TextStyle(
                        color = ColorProvider(Color(0xFF14161A)),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
                Text(
                    text = Ar.relative(task.dueDate, today) + " • " + Ar.shortDate(task.dueDate),
                    maxLines = 1,
                    style = TextStyle(color = ColorProvider(Color(0xFF6B7280)), fontSize = 11.sp)
                )
            }
        }
    }
}

/** إنجاز مهمة مباشرة من الويدجت */
class CompleteTaskAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val id = parameters[taskIdKey] ?: return
        Repository.get(context).markDoneById(id)
        MahamiWidget.refresh(context)
    }

    companion object {
        val taskIdKey = ActionParameters.Key<Long>("task_id")
    }
}
