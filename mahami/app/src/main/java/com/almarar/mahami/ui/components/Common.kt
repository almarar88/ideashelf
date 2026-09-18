package com.almarar.mahami.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import com.almarar.mahami.ui.theme.MahamiTheme

/** بطاقة ناعمة بحواف دائرية وظل خفيف — أساس التصميم */
@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    color: Color = MahamiTheme.colors.surface,
    corner: Dp = 28.dp,
    elevation: Dp = 10.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(corner)
    Box(
        modifier = modifier
            .shadow(
                elevation = elevation,
                shape = shape,
                ambientColor = Color(0x11000000),
                spotColor = Color(0x1A000000)
            )
            .clip(shape)
            .background(color)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
    ) { content() }
}

/** زر دائري أبيض يحمل أيقونة — يستخدم في أشرطة العناوين */
@Composable
fun CircleIconButton(
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    background: Color = MahamiTheme.colors.surface,
    tint: Color = MahamiTheme.colors.ink,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .size(size)
            .shadow(6.dp, CircleShape, ambientColor = Color(0x0F000000), spotColor = Color(0x14000000))
            .clip(CircleShape)
            .background(background)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription, tint = tint, modifier = Modifier.size(size * 0.45f))
    }
}

/** شريط تبويب على شكل حبة: التبويب النشط أسود */
@Composable
fun SegmentedTabs(
    options: List<String>,
    selectedIndex: Int,
    modifier: Modifier = Modifier,
    onSelect: (Int) -> Unit
) {
    val colors = MahamiTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .shadow(8.dp, RoundedCornerShape(30.dp), ambientColor = Color(0x0F000000), spotColor = Color(0x14000000))
            .clip(RoundedCornerShape(30.dp))
            .background(colors.surface)
            .padding(5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        options.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(26.dp))
                    .background(if (selected) colors.ink else Color.Transparent)
                    .clickable { onSelect(index) }
                    .padding(vertical = 11.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (selected) colors.surface else colors.inkMuted,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/** وسم صغير ملون */
@Composable
fun Pill(
    text: String,
    background: Color,
    textColor: Color,
    modifier: Modifier = Modifier,
    bordered: Boolean = false
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(background)
            .then(
                if (bordered) Modifier.border(1.dp, textColor.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                else Modifier
            )
            .padding(horizontal = 12.dp, vertical = 5.dp)
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = textColor)
    }
}

/** شريط تقدم رفيع */
@Composable
fun ThinProgress(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = MahamiTheme.colors.accent,
    track: Color = MahamiTheme.colors.surfaceMuted,
    height: Dp = 8.dp
) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), tween(600), label = "progress")
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(height))
            .background(track)
    ) {
        Box(
            Modifier
                .fillMaxWidth(animated)
                .size(height)
                .clip(RoundedCornerShape(height))
                .background(color)
        )
    }
}
