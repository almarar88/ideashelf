package com.almarar.mahami.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
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
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.almarar.mahami.MainActivity
import com.almarar.mahami.data.Repository
import com.almarar.mahami.data.TaskStatus
import java.time.LocalDate

/** ويدجت صغير يعرض عدد مهام اليوم وأقربها */
object TodayWidget {
    suspend fun refresh(context: Context) {
        runCatching { TodayGlanceWidget().updateAll(context.applicationContext) }
    }
}

class TodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayGlanceWidget()
}

class TodayGlanceWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val all = runCatching { Repository.get(context).allTasks() }.getOrDefault(emptyList())
        val today = LocalDate.now()
        val open = all.filter { it.status != TaskStatus.DONE }
        val dueToday = open.filter { it.dueDate == today }
        val late = open.filter { it.dueDate.isBefore(today) }
        val next = open.minByOrNull { it.dueDate }

        provideContent {
            GlanceTheme {
                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(ColorProvider(Color(0xFF14161A)))
                        .cornerRadius(24.dp)
                        .padding(14.dp)
                        .clickable(actionStartActivity<MainActivity>())
                ) {
                    Text(
                        text = "اليوم",
                        style = TextStyle(
                            color = ColorProvider(Color(0xFF9AA3AF)),
                            fontSize = 12.sp
                        )
                    )
                    Spacer(GlanceModifier.height(2.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            text = "${dueToday.size}",
                            style = TextStyle(
                                color = ColorProvider(Color.White),
                                fontSize = 34.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Spacer(GlanceModifier.width(6.dp))
                        Text(
                            text = "مهمة",
                            style = TextStyle(
                                color = ColorProvider(Color(0xFF9AA3AF)),
                                fontSize = 12.sp
                            )
                        )
                    }
                    if (late.isNotEmpty()) {
                        Spacer(GlanceModifier.height(4.dp))
                        Text(
                            text = "${late.size} متأخرة",
                            style = TextStyle(
                                color = ColorProvider(Color(0xFFE5484D)),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }
                    Spacer(GlanceModifier.height(8.dp))
                    Text(
                        text = next?.title ?: "لا مهام مفتوحة",
                        maxLines = 2,
                        style = TextStyle(
                            color = ColorProvider(Color(0xFFE6E9EE)),
                            fontSize = 12.sp
                        )
                    )
                }
            }
        }
    }
}
