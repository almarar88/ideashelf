package com.almarar.mahami.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.almarar.mahami.ui.theme.MahamiTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

data class GaugeSegment(val value: Float, val color: Color, val label: String)

/** مؤشر قوسي ملون مع رقم في المنتصف */
@Composable
fun GaugeArc(
    segments: List<GaugeSegment>,
    centerValue: String,
    centerUnit: String,
    centerCaption: String,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 20.dp
) {
    val colors = MahamiTheme.colors
    val total = segments.sumOf { it.value.toDouble() }.toFloat().takeIf { it > 0f } ?: 1f
    val progress by animateFloatAsState(1f, tween(900), label = "gauge")

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = strokeWidth.toPx()
            val inset = stroke / 2 + 6f
            val diameter = minOf(size.width, size.height) - inset * 2
            val topLeft = Offset(
                (size.width - diameter) / 2f,
                (size.height - diameter) / 2f + diameter * 0.06f
            )
            val arcSize = Size(diameter, diameter)
            val startAngle = 158f
            val totalSweep = 224f

            // مسار الخلفية
            drawArc(
                color = colors.surfaceMuted,
                startAngle = startAngle,
                sweepAngle = totalSweep,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )

            var angle = startAngle
            segments.forEach { seg ->
                val sweep = (seg.value / total) * totalSweep * progress
                if (sweep > 0.5f) {
                    drawArc(
                        color = seg.color,
                        startAngle = angle + 1.4f,
                        sweepAngle = (sweep - 2.8f).coerceAtLeast(1f),
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke, cap = StrokeCap.Round)
                    )
                }
                angle += sweep
            }

            // المقبض في نهاية القوس
            val endAngle = (startAngle + totalSweep * progress) * PI / 180f
            val radius = diameter / 2f
            val cx = topLeft.x + radius + cos(endAngle).toFloat() * radius
            val cy = topLeft.y + radius + sin(endAngle).toFloat() * radius
            drawCircle(color = Color.White, radius = stroke * 0.42f, center = Offset(cx, cy))
            val knobColor = segments.lastOrNull { it.value >= 1f }?.color
                ?: segments.lastOrNull()?.color ?: colors.accent
            drawCircle(
                color = knobColor,
                radius = stroke * 0.42f,
                center = Offset(cx, cy),
                style = Stroke(width = stroke * 0.22f)
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(centerValue, style = MaterialTheme.typography.displayLarge, color = colors.ink)
                Spacer(Modifier.width(4.dp))
                Text(
                    centerUnit,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.inkMuted,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            Text(centerCaption, style = MaterialTheme.typography.bodyMedium, color = colors.inkMuted)
        }
    }
}

/** مفتاح ألوان المؤشر */
@Composable
fun GaugeLegend(segments: List<GaugeSegment>, modifier: Modifier = Modifier) {
    val colors = MahamiTheme.colors
    val total = segments.sumOf { it.value.toDouble() }.toFloat().takeIf { it > 0f } ?: 1f
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        segments.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                row.forEach { seg ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Canvas(Modifier.size(9.dp)) { drawCircle(seg.color) }
                        Spacer(Modifier.width(6.dp))
                        val pct = (seg.value / total * 100).toInt()
                        Text(
                            "${seg.label} ($pct%)",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.inkSoft
                        )
                    }
                }
            }
        }
    }
}

data class BarDatum(val label: String, val value: Float, val highlighted: Boolean = false)

/** أعمدة أسبوعية منقّطة مع عمود مميّز */
@Composable
fun DottedBars(
    data: List<BarDatum>,
    modifier: Modifier = Modifier,
    barHeight: Dp = 150.dp
) {
    val colors = MahamiTheme.colors
    val max = (data.maxOfOrNull { it.value } ?: 1f).coerceAtLeast(1f)
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom
    ) {
        data.forEach { d ->
            val fraction by animateFloatAsState(d.value / max, tween(700), label = "bar")
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .width(42.dp)
                        .height(barHeight),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Canvas(
                        Modifier
                            .width(42.dp)
                            .height((barHeight.value * (0.18f + 0.82f * fraction)).dp)
                    ) {
                        val radius = size.width / 2f
                        if (d.highlighted) {
                            drawRoundRect(
                                color = colors.ink,
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius, radius)
                            )
                            drawCircle(
                                color = Color.White,
                                radius = size.width * 0.14f,
                                center = Offset(size.width / 2f, size.width * 0.5f)
                            )
                        } else {
                            drawRoundRect(
                                color = colors.surfaceMuted,
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius, radius)
                            )
                            val step = 7.dp.toPx()
                            var y = step
                            while (y < size.height - step / 2) {
                                var x = step
                                while (x < size.width) {
                                    drawCircle(
                                        color = colors.inkMuted.copy(alpha = 0.35f),
                                        radius = 1.6.dp.toPx() / 2,
                                        center = Offset(x, y)
                                    )
                                    x += step
                                }
                                y += step
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    d.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (d.highlighted) colors.ink else colors.inkMuted
                )
            }
        }
    }
}

/** منحنى ناعم مع تدرّج سفلي */
@Composable
fun SparkLine(
    values: List<Float>,
    modifier: Modifier = Modifier,
    lineColor: Color = Color(0xFF8B7FB8)
) {
    if (values.size < 2) {
        Box(modifier)
        return
    }
    Canvas(modifier) {
        val max = values.max().coerceAtLeast(0.001f)
        val min = values.min()
        val range = (max - min).coerceAtLeast(0.001f)
        val stepX = size.width / (values.size - 1)
        val pts = values.mapIndexed { i, v ->
            Offset(i * stepX, size.height - ((v - min) / range) * size.height * 0.8f - size.height * 0.1f)
        }
        val path = Path().apply {
            moveTo(pts.first().x, pts.first().y)
            for (i in 0 until pts.size - 1) {
                val c = (pts[i].x + pts[i + 1].x) / 2
                cubicTo(c, pts[i].y, c, pts[i + 1].y, pts[i + 1].x, pts[i + 1].y)
            }
        }
        val fill = Path().apply {
            addPath(path)
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        drawPath(
            fill,
            brush = Brush.verticalGradient(
                listOf(lineColor.copy(alpha = 0.28f), Color.Transparent)
            )
        )
        drawPath(path, color = lineColor, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** أعمدة رفيعة متفاوتة — مؤشر ضغط العمل */
@Composable
fun LoadBars(
    values: List<Float>,
    accent: Color,
    base: Color,
    modifier: Modifier = Modifier
) {
    Canvas(modifier) {
        if (values.isEmpty()) return@Canvas
        val maxBarWidth = 7.dp.toPx()
        val gap = 5.dp.toPx()
        val barWidth = (((size.width - gap * (values.size - 1)) / values.size)
            .coerceIn(2f, maxBarWidth))
        val span = barWidth * values.size + gap * (values.size - 1)
        val startX = (size.width - span).coerceAtLeast(0f) / 2f
        val max = values.max().coerceAtLeast(0.001f)
        values.forEachIndexed { i, v ->
            val h = (v / max).coerceIn(0.12f, 1f) * size.height
            val x = startX + i * (barWidth + gap)
            drawRoundRect(
                color = if (i % 3 == 0) accent else base,
                topLeft = Offset(x, (size.height - h) / 2f),
                size = Size(barWidth, h),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2, barWidth / 2)
            )
        }
    }
}

/** حلقة تقدّم دائرية */
@Composable
fun ProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = MahamiTheme.colors.accent,
    track: Color = MahamiTheme.colors.surfaceMuted,
    stroke: Dp = 8.dp,
    label: String? = null
) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), tween(700), label = "ring")
    val colors = MahamiTheme.colors
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val w = stroke.toPx()
            drawArc(
                color = track, startAngle = -90f, sweepAngle = 360f, useCenter = false,
                topLeft = Offset(w / 2, w / 2),
                size = Size(size.width - w, size.height - w),
                style = Stroke(width = w, cap = StrokeCap.Round)
            )
            drawArc(
                color = color, startAngle = -90f, sweepAngle = 360f * animated, useCenter = false,
                topLeft = Offset(w / 2, w / 2),
                size = Size(size.width - w, size.height - w),
                style = Stroke(width = w, cap = StrokeCap.Round)
            )
        }
        Text(
            label ?: "${(animated * 100).toInt()}%",
            style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp),
            color = colors.ink
        )
    }
}
