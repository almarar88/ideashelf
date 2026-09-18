package com.almarar.mahami.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.almarar.mahami.ui.theme.MahamiTheme

data class NavItem(val route: String, val icon: ImageVector, val label: String)

/** شريط تنقل داكن على شكل حبة + زر إضافة أزرق منفصل */
@Composable
fun BottomNavPill(
    items: List<NavItem>,
    currentRoute: String,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit,
    onAdd: () -> Unit
) {
    val colors = MahamiTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .height(64.dp)
                .shadow(16.dp, RoundedCornerShape(34.dp), spotColor = Color(0x40000000))
                .clip(RoundedCornerShape(34.dp))
                .background(colors.navBar)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            items.forEach { item ->
                val selected = item.route == currentRoute
                val circleSize by animateDpAsState(if (selected) 48.dp else 40.dp, tween(220), label = "nav")
                Box(
                    modifier = Modifier
                        .size(circleSize)
                        .clip(CircleShape)
                        .background(if (selected) Color.White else Color.Transparent)
                        .clickable { onSelect(item.route) },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        item.icon,
                        item.label,
                        tint = if (selected) colors.ink else Color.White.copy(alpha = 0.72f),
                        modifier = Modifier.size(21.dp)
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .size(64.dp)
                .shadow(16.dp, CircleShape, spotColor = Color(0x552E9BF0))
                .clip(CircleShape)
                .background(colors.accent)
                .clickable { onAdd() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Rounded.Add, "إضافة مهمة", tint = Color.White, modifier = Modifier.size(30.dp))
        }
    }
    Spacer(Modifier.height(4.dp))
}
