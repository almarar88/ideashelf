package com.almarar.mahami.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Widgets
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.MahamiTheme

private data class Slide(
    val title: String,
    val body: String,
    val icon: ImageVector,
    val tint: Color
)

private val slides = listOf(
    Slide(
        "كل مهامك في مكان واحد",
        "سجّل مهامك، تابع تقدّمها، واتخذ قراراتك اليومية بثقة ودون فوضى.",
        Icons.Rounded.CalendarMonth,
        Color(0xFF2E9BF0)
    ),
    Slide(
        "تنبيهات قبل الموعد بوقت كافٍ",
        "تذكير قبل التسليم بأيام، وفي الصباح، وعند حلول الموعد — مع ملخص يومي.",
        Icons.Rounded.NotificationsActive,
        Color(0xFFF5A524)
    ),
    Slide(
        "ويدجت على الشاشة الرئيسية",
        "أقرب المهام أمام عينيك دائماً، مع إمكانية إنجاز المهمة بضغطة واحدة.",
        Icons.Rounded.Widgets,
        Color(0xFF3BA55D)
    )
)

@Composable
fun OnboardingScreen(onFinish: () -> Unit) {
    val colors = MahamiTheme.colors
    var index by remember { mutableIntStateOf(0) }
    val slide = slides[index]

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(colors.tileSky, colors.background, colors.background)
                )
            )
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(colors.surface)
                        .clickable { if (index > 0) index-- },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.ArrowForward, "رجوع",
                        tint = colors.ink, modifier = Modifier.size(20.dp)
                    )
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(22.dp))
                        .background(colors.surface)
                        .clickable { onFinish() }
                        .padding(horizontal = 20.dp, vertical = 11.dp)
                ) {
                    Text("تخطي", style = MaterialTheme.typography.labelLarge, color = colors.inkSoft)
                }
            }

            Spacer(Modifier.height(34.dp))

            AnimatedVisibility(
                visible = true,
                enter = fadeIn() + slideInVertically()
            ) {
                Column {
                    Text(
                        slide.title,
                        style = MaterialTheme.typography.headlineLarge,
                        color = colors.ink
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        slide.body,
                        style = MaterialTheme.typography.bodyLarge,
                        color = colors.inkMuted
                    )
                }
            }

            Spacer(Modifier.height(22.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                slides.indices.forEach { i ->
                    Box(
                        Modifier
                            .height(5.dp)
                            .width(if (i == index) 26.dp else 12.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (i == index) colors.accent else colors.inkMuted.copy(alpha = 0.3f))
                    )
                }
            }

            Spacer(Modifier.height(30.dp))

            SoftCard(
                Modifier
                    .fillMaxWidth()
                    .weight(1f),
                corner = 36.dp
            ) {
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(26.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        Modifier
                            .size(108.dp)
                            .clip(CircleShape)
                            .background(slide.tint.copy(alpha = 0.14f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(slide.icon, null, tint = slide.tint, modifier = Modifier.size(52.dp))
                    }
                    Spacer(Modifier.height(24.dp))
                    Text(
                        "مهامي",
                        style = MaterialTheme.typography.displayMedium,
                        color = colors.ink
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "مساعدك على تنظيم التسليمات والمواعيد",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkMuted
                    )
                }
            }

            Spacer(Modifier.height(22.dp))

            Row(
                Modifier
                    .fillMaxWidth()
                    .height(60.dp)
                    .clip(RoundedCornerShape(30.dp))
                    .background(colors.accent)
                    .clickable {
                        if (index < slides.lastIndex) index++ else onFinish()
                    }
                    .padding(horizontal = 26.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    if (index < slides.lastIndex) "التالي" else "ابدأ الآن",
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White
                )
                Text("〉〉〉", style = MaterialTheme.typography.titleLarge, color = Color.White.copy(alpha = 0.75f))
            }
        }
    }
}
