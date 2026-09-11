package ai.pacto.app.ui.components

import ai.pacto.app.ui.theme.PactoColors
import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import java.io.File

/**
 * The drawn signature. It is not what makes the contract binding on its own; it is the human
 * readable mark that accompanies the hardware-backed cryptographic signature.
 */
class SignatureState {
    val strokes = mutableStateListOf<MutableList<Offset>>()

    fun begin(offset: Offset) {
        strokes.add(mutableListOf(offset))
    }

    fun extend(offset: Offset) {
        strokes.lastOrNull()?.add(offset)
    }

    fun clear() = strokes.clear()

    val isEmpty: Boolean get() = strokes.none { it.size > 2 }

    /** Renders the strokes into a PNG stored next to the contract record. */
    fun writePng(target: File, width: Int, height: Int): File? {
        if (isEmpty || width <= 0 || height <= 0) return null
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = AndroidCanvas(bitmap)
        canvas.drawColor(AndroidColor.WHITE)
        val paint = Paint().apply {
            color = AndroidColor.BLACK
            strokeWidth = 5f
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            isAntiAlias = true
        }
        strokes.forEach { stroke ->
            for (index in 1 until stroke.size) {
                val from = stroke[index - 1]
                val to = stroke[index]
                canvas.drawLine(from.x, from.y, to.x, to.y, paint)
            }
        }
        target.parentFile?.mkdirs()
        target.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        return target
    }
}

@Composable
fun rememberSignatureState(): SignatureState = remember { SignatureState() }

@Composable
fun SignaturePad(
    state: SignatureState,
    hint: String,
    modifier: Modifier = Modifier,
    onSizeChanged: (Int, Int) -> Unit = { _, _ -> }
) {
    val density = LocalDensity.current
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(PactoColors.Surface)
    ) {
        if (state.isEmpty) {
            Text(
                text = hint,
                style = MaterialTheme.typography.bodyMedium,
                color = PactoColors.OnSurfaceMuted,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(16.dp)
            )
        }
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .pointerInput(Unit) {
                    onSizeChanged(size.width, size.height)
                    detectDragGestures(
                        onDragStart = { state.begin(it) },
                        onDrag = { change, _ ->
                            change.consume()
                            state.extend(change.position)
                        }
                    )
                }
        ) {
            state.strokes.forEach { stroke ->
                if (stroke.size > 1) {
                    val path = Path().apply {
                        moveTo(stroke.first().x, stroke.first().y)
                        stroke.drop(1).forEach { lineTo(it.x, it.y) }
                    }
                    drawPath(
                        path = path,
                        color = PactoColors.OnSurface,
                        style = Stroke(width = with(density) { 2.6.dp.toPx() }, cap = StrokeCap.Round)
                    )
                }
            }
        }
    }
}
