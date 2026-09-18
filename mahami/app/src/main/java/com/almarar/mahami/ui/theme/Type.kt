package com.almarar.mahami.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp
import com.almarar.mahami.R

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
    Font(R.font.tajawal_extrabold, FontWeight.ExtraBold)
)

/**
 * النص العربي يحتاج الحشوة العمودية الكاملة: Compose يعطّل includeFontPadding
 * افتراضياً منذ 1.7، ما يجعل أسطر العربية تتداخل مع بعضها.
 */
private val arabicPlatform = PlatformTextStyle(includeFontPadding = true)
private val arabicLineHeight = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None
)

private fun style(weight: FontWeight, size: Int, lineHeight: Int): TextStyle = TextStyle(
    fontFamily = Tajawal,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    platformStyle = arabicPlatform,
    lineHeightStyle = arabicLineHeight
)

val MahamiTypography = Typography(
    displayLarge = style(FontWeight.ExtraBold, 44, 54),
    displayMedium = style(FontWeight.ExtraBold, 34, 44),
    headlineLarge = style(FontWeight.Bold, 28, 40),
    headlineMedium = style(FontWeight.Bold, 24, 36),
    headlineSmall = style(FontWeight.Bold, 20, 32),
    titleLarge = style(FontWeight.Bold, 18, 30),
    titleMedium = style(FontWeight.Medium, 16, 28),
    titleSmall = style(FontWeight.Medium, 14, 24),
    bodyLarge = style(FontWeight.Normal, 15, 28),
    bodyMedium = style(FontWeight.Normal, 14, 25),
    bodySmall = style(FontWeight.Normal, 12, 21),
    labelLarge = style(FontWeight.Bold, 14, 22),
    labelMedium = style(FontWeight.Medium, 12, 20),
    labelSmall = style(FontWeight.Medium, 11, 18)
)
