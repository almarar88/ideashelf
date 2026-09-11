package com.almarar.mahami.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.almarar.mahami.R

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
    Font(R.font.tajawal_extrabold, FontWeight.ExtraBold)
)

/**
 * الخط العربي يحتاج حشوة عمودية كاملة: منذ Compose 1.7 صار includeFontPadding
 * معطّلاً افتراضياً، ما يجعل أسطر النص العربي تتداخل مع بعضها.
 */
private val arabicPlatform = PlatformTextStyle(includeFontPadding = true)
private val arabicLineHeight = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None
)

private fun TextStyle.arabic(): TextStyle =
    copy(platformStyle = arabicPlatform, lineHeightStyle = arabicLineHeight)

val MahamiTypography = Typography(
    displayLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.ExtraBold, fontSize = 44.sp, lineHeight = 52.sp).arabic(),
    displayMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp, lineHeight = 42.sp).arabic(),
    headlineLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 38.sp).arabic(),
    headlineMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 34.sp).arabic(),
    headlineSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 30.sp).arabic(),
    titleLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 28.sp).arabic(),
    titleMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 26.sp).arabic(),
    titleSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 22.sp).arabic(),
    bodyLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 26.sp).arabic(),
    bodyMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 13.5.sp, lineHeight = 23.sp).arabic(),
    bodySmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 19.sp).arabic(),
    labelLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 14.sp).arabic(),
    labelMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 12.sp).arabic(),
    labelSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 11.sp)
)
