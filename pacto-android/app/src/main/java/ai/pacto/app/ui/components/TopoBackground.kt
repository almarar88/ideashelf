package ai.pacto.app.ui.components

import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

/**
 * The contour-map ground the whole app sits on. The rings are generated, not an image asset,
 * so they stay crisp at any density and cost nothing to ship.
 */
@Composable
fun TopoBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(PactoColors.Olive, PactoColors.OliveDeep)
                )
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val centers = listOf(
                Offset(size.width * 0.18f, size.height * 0.12f) to 0.55f,
                Offset(size.width * 0.82f, size.height * 0.34f) to 0.75f,
                Offset(size.width * 0.35f, size.height * 0.78f) to 0.9f
            )
            centers.forEach { (center, spread) ->
                for (ring in 1..11) {
                    val radius = ring * size.minDimension * 0.062f * spread
                    val path = Path()
                    val steps = 72
                    for (step in 0..steps) {
                        val angle = (step.toFloat() / steps) * (2 * Math.PI).toFloat()
                        // A little per-ring noise keeps the rings reading as terrain, not targets.
                        val wobble = 1f +
                            0.09f * sin(angle * 3f + ring * 0.7f) +
                            0.05f * cos(angle * 5f - ring * 0.4f)
                        val x = center.x + radius * wobble * cos(angle)
                        val y = center.y + radius * wobble * sin(angle) * 0.82f
                        if (step == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    path.close()
                    drawPath(
                        path = path,
                        color = PactoColors.Contour,
                        style = Stroke(width = 1.2.dp.toPx())
                    )
                }
            }
        }
        content()
    }
}
