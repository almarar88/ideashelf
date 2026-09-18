package com.almarar.mahami.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.layout
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.almarar.mahami.ui.theme.MahamiTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * قرص بأسنان متدرجة — العنصر البصري الأساسي في الواجهة.
 * الأسنان المضيئة تمثل النسبة المنجزة، وتتحرك عند تغيّر القيمة.
 */
@Composable
fun TickDial(
    progress: Float,
    modifier: Modifier = Modifier,
    tickCount: Int = 56,
    activeColor: Color = MahamiTheme.colors.accent,
    inactiveColor: Color = MahamiTheme.colors.onFeatureMuted.copy(alpha = 0.35f),
    sweepDegrees: Float = 250f,
    content: @Composable () -> Unit = {}
) {
    val animated by animateFloatAsState(
        targetValue = progress.coerceIn(0f, 1f),
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "dial"
    )

    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val startAngle = 90f + (360f - sweepDegrees) / 2f
            val radius = size.minDimension / 2f
            val center = Offset(size.width / 2f, size.height / 2f)
            val activeTicks = (tickCount * animated).roundToInt()

            repeat(tickCount) { index ->
                val fraction = index / (tickCount - 1f)
                val angle = Math.toRadians((startAngle + fraction * sweepDegrees).toDouble())
                val isActive = index < activeTicks

                // الأسنان النشطة أطول قليلاً فتبدو كأنها تنبض
                val inner = radius * if (isActive) 0.62f else 0.70f
                val outer = radius * 0.96f
                val start = Offset(
                    center.x + cos(angle).toFloat() * inner,
                    center.y + sin(angle).toFloat() * inner
                )
                val end = Offset(
                    center.x + cos(angle).toFloat() * outer,
                    center.y + sin(angle).toFloat() * outer
                )
                drawLine(
                    color = if (isActive) activeColor else inactiveColor,
                    start = start,
                    end = end,
                    strokeWidth = if (isActive) 5.5f.dp.toPx() else 3.5f.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }
        }
        content()
    }
}

/** رقم يعدّ تصاعدياً عند ظهوره */
@Composable
fun AnimatedCounter(
    value: Int,
    modifier: Modifier = Modifier,
    style: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.displayMedium,
    color: Color = MahamiTheme.colors.ink,
    durationMillis: Int = 700
) {
    var target by remember { mutableStateOf(0) }
    LaunchedEffect(value) { target = value }
    val animated by animateFloatAsState(
        targetValue = target.toFloat(),
        animationSpec = tween(durationMillis, easing = FastOutSlowInEasing),
        label = "counter"
    )
    Text(animated.roundToInt().toString(), modifier = modifier, style = style, color = color)
}

/** أعمدة مخططة بخطوط أفقية، والعمود المميز بلون التمييز — مستوحى من لوحات التحليل */
data class StripedBar(val label: String, val value: Float, val highlighted: Boolean = false)

@Composable
fun StripedBars(
    data: List<StripedBar>,
    modifier: Modifier = Modifier,
    barHeight: Dp = 150.dp,
    baseColor: Color = MahamiTheme.colors.surfaceMuted,
    highlightColor: Color = MahamiTheme.colors.accent
) {
    val max = (data.maxOfOrNull { it.value } ?: 1f).coerceAtLeast(1f)
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom
    ) {
        data.forEach { bar ->
            val fraction by animateFloatAsState(
                targetValue = bar.value / max,
                animationSpec = tween(750, easing = FastOutSlowInEasing),
                label = "bar"
            )
            val colors = MahamiTheme.colors
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .width(44.dp)
                        .height(barHeight),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Canvas(
                        Modifier
                            .width(44.dp)
                            .height((barHeight.value * (0.16f + 0.84f * fraction)).dp)
                    ) {
                        val radius = androidx.compose.ui.geometry.CornerRadius(
                            size.width / 2.6f,
                            size.width / 2.6f
                        )
                        drawRoundRect(
                            color = if (bar.highlighted) highlightColor else baseColor,
                            cornerRadius = radius
                        )
                        // خطوط أفقية فاتحة تعطي الملمس المخطط
                        val gap = 9.dp.toPx()
                        var y = gap
                        while (y < size.height) {
                            drawLine(
                                color = if (bar.highlighted) {
                                    Color.White.copy(alpha = 0.34f)
                                } else {
                                    colors.background.copy(alpha = 0.85f)
                                },
                                start = Offset(0f, y),
                                end = Offset(size.width, y),
                                strokeWidth = 2.6f.dp.toPx()
                            )
                            y += gap
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    bar.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (bar.highlighted) MahamiTheme.colors.ink else MahamiTheme.colors.inkMuted,
                    fontWeight = if (bar.highlighted) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

/** مبدّل على شكل حبة بمؤشر ينزلق بين الخيارات */
@Composable
fun SlidingTabs(
    options: List<String>,
    selectedIndex: Int,
    modifier: Modifier = Modifier,
    containerColor: Color = MahamiTheme.colors.surface,
    indicatorColor: Color = MahamiTheme.colors.feature,
    onSelect: (Int) -> Unit
) {
    val colors = MahamiTheme.colors
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(30.dp))
            .background(containerColor)
            .padding(5.dp)
    ) {
        val weight = 1f / options.size
        val offset by animateFloatAsState(
            targetValue = selectedIndex * weight,
            animationSpec = tween(320, easing = FastOutSlowInEasing),
            label = "tab"
        )
        // المؤشر المنزلق
        Box(
            Modifier
                .fillMaxWidth(weight)
                .height(44.dp)
                .padding(horizontal = 2.dp)
                .slideFraction(offset)
                .clip(RoundedCornerShape(26.dp))
                .background(indicatorColor)
        )
        Row(Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, label ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(44.dp)
                        .clip(RoundedCornerShape(26.dp))
                        .clickable { onSelect(index) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (index == selectedIndex) colors.onFeature else colors.inkMuted
                    )
                }
            }
        }
    }
}

/** نبضة خفيفة تلفت الانتباه إلى عنصر مهم */
@Composable
fun PulsingDot(color: Color, modifier: Modifier = Modifier, size: Dp = 10.dp) {
    val transition = rememberInfiniteTransition(label = "pulse")
    val scale by transition.animateFloat(
        initialValue = 0.75f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    Canvas(modifier.size(size)) {
        drawCircle(color = color.copy(alpha = 0.25f), radius = this.size.minDimension / 2f * scale)
        drawCircle(color = color, radius = this.size.minDimension / 3.2f)
    }
}

/** حلقة تقدّم رفيعة مع عدّاد نسبة متحرك */
@Composable
fun RingMeter(
    progress: Float,
    modifier: Modifier = Modifier,
    stroke: Dp = 10.dp,
    color: Color = MahamiTheme.colors.accent,
    track: Color = MahamiTheme.colors.surfaceMuted,
    label: String? = null
) {
    val animated by animateFloatAsState(
        targetValue = progress.coerceIn(0f, 1f),
        animationSpec = tween(850, easing = FastOutSlowInEasing),
        label = "ring"
    )
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val width = stroke.toPx()
            drawArc(
                color = track,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(width / 2, width / 2),
                size = androidx.compose.ui.geometry.Size(size.width - width, size.height - width),
                style = Stroke(width = width, cap = StrokeCap.Round)
            )
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = 360f * animated,
                useCenter = false,
                topLeft = Offset(width / 2, width / 2),
                size = androidx.compose.ui.geometry.Size(size.width - width, size.height - width),
                style = Stroke(width = width, cap = StrokeCap.Round)
            )
        }
        Text(
            label ?: "${(animated * 100).roundToInt()}%",
            style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp),
            color = MahamiTheme.colors.ink
        )
    }
}

private fun Modifier.slideFraction(fraction: Float): Modifier = this.then(
    Modifier.layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        layout(placeable.width, placeable.height) {
            placeable.placeRelative((constraints.maxWidth * fraction).roundToInt(), 0)
        }
    }
)
