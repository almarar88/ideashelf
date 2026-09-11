package ai.pacto.app.ui.components

import ai.pacto.app.domain.model.Priority
import ai.pacto.app.ui.theme.PactoColors
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** Trust score where the design puts the weather: the number the whole app is judged by. */
@Composable
fun PactoTopBar(
    trustScore: Int,
    statusLine: String,
    onProfileClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                Icons.Filled.VerifiedUser,
                contentDescription = null,
                tint = PactoColors.OnOlive,
                modifier = Modifier.size(30.dp)
            )
            Text(
                text = "$trustScore",
                style = MaterialTheme.typography.displaySmall,
                color = PactoColors.OnOlive
            )
            Text(
                text = statusLine,
                style = MaterialTheme.typography.bodyLarge,
                color = PactoColors.OnOliveMuted
            )
        }
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(PactoColors.Ink)
                .clickable(onClick = onProfileClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Filled.Person, contentDescription = null, tint = PactoColors.OnOlive, modifier = Modifier.size(22.dp))
        }
    }
}

data class DayCell(
    val dayNumber: Int,
    val weekdayLabel: String,
    val badgeCount: Int,
    val isSelected: Boolean,
    val dateMillis: Long
)

@Composable
fun DayPill(cell: DayCell, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier = modifier) {
        Column(
            modifier = Modifier
                .width(62.dp)
                .height(78.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (cell.isSelected) PactoColors.Surface else PactoColors.Ink)
                .clickable(onClick = onClick)
                .padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "${cell.dayNumber}",
                style = MaterialTheme.typography.headlineSmall,
                color = if (cell.isSelected) PactoColors.OnSurface else PactoColors.OnOlive
            )
            Text(
                text = cell.weekdayLabel,
                style = MaterialTheme.typography.labelMedium,
                color = if (cell.isSelected) PactoColors.OnSurfaceMuted else PactoColors.OnOliveMuted
            )
        }
        if (cell.badgeCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(PactoColors.Urgent),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${cell.badgeCount}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White
                )
            }
        }
    }
}

/** The white obligation card: time, what is due, and how hard it presses. */
@Composable
fun ObligationCard(
    timeLabel: String,
    title: String,
    priority: Priority,
    priorityLabel: String,
    priorityCaption: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    footnote: String? = null
) {
    Column(
        modifier = modifier
            .width(196.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(PactoColors.Surface)
            .clickable(onClick = onClick)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = timeLabel,
            style = MaterialTheme.typography.bodyMedium,
            color = PactoColors.OnSurfaceMuted
        )
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = PactoColors.OnSurface,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.height(78.dp)
        )
        Text(
            text = priorityCaption,
            style = MaterialTheme.typography.bodySmall,
            color = PactoColors.OnSurfaceMuted
        )
        PriorityBadge(priority = priority, label = priorityLabel)
        footnote?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = PactoColors.OnSurfaceMuted)
        }
    }
}

@Composable
fun HashChip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(PactoColors.Ink)
            .border(1.dp, PactoColors.InkBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = PactoColors.OnOliveMuted
        )
    }
}
