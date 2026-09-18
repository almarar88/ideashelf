package com.almarar.mahami.ui.theme

import androidx.compose.ui.graphics.Color

// لوحة فاتحة ناعمة
val SoftBackground = Color(0xFFEFF1F5)
val SurfaceWhite = Color(0xFFFFFFFF)
val SurfaceMuted = Color(0xFFF4F6F8)
val InkBlack = Color(0xFF14161A)
val InkSoft = Color(0xFF3C424D)
val InkMuted = Color(0xFF7A828F)
val Hairline = Color(0x14000000)

// ألوان الدلالة
val AccentBlue = Color(0xFF2E9BF0)
val AccentYellow = Color(0xFFF5A524)
val AccentRed = Color(0xFFE5484D)
val AccentGreen = Color(0xFF3BA55D)
val AccentViolet = Color(0xFF8B7FB8)

// بطاقات باستيل
val TileLavender = Color(0xFFE9E2F6)
val TileMint = Color(0xFFE2F0E6)
val TilePeach = Color(0xFFF9E5DC)
val TileSky = Color(0xFFDCE7F7)

// لوحة داكنة
val NightBackground = Color(0xFF0E0F12)
val NightSurface = Color(0xFF171A1F)
val NightSurfaceAlt = Color(0xFF1F232A)
val NightInk = Color(0xFFF2F4F7)
val NightInkMuted = Color(0xFF98A1B0)

/** ألوان المشاريع المتاحة للاختيار */
val ProjectColors = listOf(
    0xFF2E9BF0, 0xFF3BA55D, 0xFFF5A524, 0xFFE5484D,
    0xFF8B7FB8, 0xFF00A3A3, 0xFFD4548E, 0xFF6B7280
)

data class MahamiPalette(
    val background: Color,
    val surface: Color,
    val surfaceMuted: Color,
    val ink: Color,
    val inkSoft: Color,
    val inkMuted: Color,
    val hairline: Color,
    val accent: Color,
    val tileLavender: Color,
    val tileMint: Color,
    val tilePeach: Color,
    val tileSky: Color,
    val navBar: Color,
    val isDark: Boolean
)

val LightPalette = MahamiPalette(
    background = SoftBackground,
    surface = SurfaceWhite,
    surfaceMuted = SurfaceMuted,
    ink = InkBlack,
    inkSoft = InkSoft,
    inkMuted = InkMuted,
    hairline = Hairline,
    accent = AccentBlue,
    tileLavender = TileLavender,
    tileMint = TileMint,
    tilePeach = TilePeach,
    tileSky = TileSky,
    navBar = InkBlack,
    isDark = false
)

val DarkPalette = MahamiPalette(
    background = NightBackground,
    surface = NightSurface,
    surfaceMuted = NightSurfaceAlt,
    ink = NightInk,
    inkSoft = Color(0xFFC9D0DA),
    inkMuted = NightInkMuted,
    hairline = Color(0x1FFFFFFF),
    accent = AccentBlue,
    tileLavender = Color(0xFF2A2637),
    tileMint = Color(0xFF1E2A23),
    tilePeach = Color(0xFF2E241F),
    tileSky = Color(0xFF1B2634),
    navBar = Color(0xFF1B1E24),
    isDark = true
)
