package com.almarar.mahami.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Widgets
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.almarar.mahami.ui.components.SoftCard
import com.almarar.mahami.ui.theme.AccentGreen
import com.almarar.mahami.ui.theme.AccentYellow
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
        "سجّل مهامك ومواعيد تسليمها، وقسّمها إلى خطوات، وتابع تقدّمها يوماً بيوم.",
        Icons.Rounded.CalendarMonth,
        Color(0xFF2E9BF0)
    ),
    Slide(
        "تنبيهات قبل الموعد بوقت كافٍ",
        "تذكير قبل التسليم بأيام، وصباح يوم الموعد، وملخص يومي لمهامك والمتأخرات.",
        Icons.Rounded.NotificationsActive,
        AccentYellow
    ),
    Slide(
        "ويدجت على الشاشة الرئيسية",
        "أقرب المهام أمام عينيك دائماً، وتُنجز أي مهمة بضغطة واحدة دون فتح التطبيق.",
        Icons.Rounded.Widgets,
        AccentGreen
    )
)

@Composable
fun OnboardingScreen(onFinish: (String) -> Unit) {
    val colors = MahamiTheme.colors
    var index by remember { mutableIntStateOf(0) }
    var name by remember { mutableStateOf("") }
    val isLast = index == slides.lastIndex
    val slide = slides[index]

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(colors.tileSky, colors.background, colors.background))
            )
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .imePadding()
                .padding(24.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(22.dp))
                        .background(colors.surface)
                        .clickable { onFinish(name) }
                        .padding(horizontal = 20.dp, vertical = 11.dp)
                ) {
                    Text("تخطي", style = MaterialTheme.typography.labelLarge, color = colors.inkSoft)
                }
            }

            Spacer(Modifier.height(28.dp))

            AnimatedContent(
                targetState = index,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "slide"
            ) { current ->
                val item = slides[current]
                Column {
                    Text(item.title, style = MaterialTheme.typography.headlineLarge, color = colors.ink)
                    Spacer(Modifier.height(12.dp))
                    Text(item.body, style = MaterialTheme.typography.bodyLarge, color = colors.inkMuted)
                }
            }

            Spacer(Modifier.height(20.dp))

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

            Spacer(Modifier.height(26.dp))

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
                            .size(104.dp)
                            .clip(CircleShape)
                            .background(slide.tint.copy(alpha = 0.14f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(slide.icon, null, tint = slide.tint, modifier = Modifier.size(50.dp))
                    }
                    Spacer(Modifier.height(22.dp))
                    Text("مهامي", style = MaterialTheme.typography.displayMedium, color = colors.ink)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "منظّم المهام والمواعيد",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.inkMuted
                    )

                    if (isLast) {
                        Spacer(Modifier.height(26.dp))
                        Text(
                            "ما الاسم الذي تحب أن يناديك به التطبيق؟",
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.inkMuted,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(10.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(colors.surfaceMuted)
                                .padding(horizontal = 16.dp, vertical = 14.dp)
                        ) {
                            if (name.isEmpty()) {
                                Text(
                                    "اختياري — اكتب اسمك",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = colors.inkMuted.copy(alpha = 0.6f)
                                )
                            }
                            BasicTextField(
                                value = name,
                                onValueChange = { if (it.length <= 24) name = it },
                                singleLine = true,
                                textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.ink),
                                cursorBrush = SolidColor(colors.accent),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            Box(
                Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .clip(RoundedCornerShape(29.dp))
                    .background(colors.accent)
                    .clickable { if (isLast) onFinish(name) else index++ },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (isLast) "ابدأ الآن" else "التالي",
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White
                )
            }
        }
    }
}
