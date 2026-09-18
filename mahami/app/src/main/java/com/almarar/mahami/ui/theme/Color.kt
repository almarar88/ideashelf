package com.almarar.mahami.ui.theme

import androidx.compose.ui.graphics.Color

// ---------- اللوحة الدافئة: كريمي وفحمي وبرتقالي ----------

val Cream = Color(0xFFF2EDE7)
val CreamSurface = Color(0xFFFBF8F5)
val CreamMuted = Color(0xFFE8E1D9)

val Charcoal = Color(0xFF2A2724)
val CharcoalSoft = Color(0xFF39342F)
val CharcoalDeep = Color(0xFF1A1816)

val InkBlack = Color(0xFF221F1C)
val InkSoft = Color(0xFF4A443E)
val InkMuted = Color(0xFF8A8078)
val Hairline = Color(0x14000000)

val Ember = Color(0xFFE8743B)
val EmberSoft = Color(0xFFF2A07A)
val EmberDeep = Color(0xFFC85A26)

val AccentBlue = Color(0xFF2E9BF0)
val AccentYellow = Color(0xFFE2A33C)
val AccentRed = Color(0xFFD6533F)
val AccentGreen = Color(0xFF5B8C5A)
val AccentViolet = Color(0xFF8B7FB8)

// بطاقات ناعمة
val TileSand = Color(0xFFEFE7DC)
val TileClay = Color(0xFFF3DED1)
val TileSage = Color(0xFFE3E9DF)
val TileSky = Color(0xFFDFE7EC)

// الوضع الليلي
val NightBackground = Color(0xFF17150F)
val NightSurface = Color(0xFF221F1A)
val NightSurfaceAlt = Color(0xFF2C2822)
val NightInk = Color(0xFFF5F1EA)
val NightInkMuted = Color(0xFFA49C91)

/** ألوان المشاريع */
val ProjectColors = listOf(
    0xFFE8743B, 0xFF5B8C5A, 0xFF2E9BF0, 0xFFD6533F,
    0xFF8B7FB8, 0xFF00A3A3, 0xFFD4548E, 0xFF8A8078
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
    /** البطاقة الداكنة المميزة في الواجهة */
    val feature: Color,
    val featureSoft: Color,
    val onFeature: Color,
    val onFeatureMuted: Color,
    val tileSand: Color,
    val tileClay: Color,
    val tileSage: Color,
    val tileSky: Color,
    val navBar: Color,
    val isDark: Boolean
)

val LightPalette = MahamiPalette(
    background = Cream,
    surface = CreamSurface,
    surfaceMuted = CreamMuted,
    ink = InkBlack,
    inkSoft = InkSoft,
    inkMuted = InkMuted,
    hairline = Hairline,
    accent = Ember,
    feature = Charcoal,
    featureSoft = CharcoalSoft,
    onFeature = Color(0xFFF7F3EE),
    onFeatureMuted = Color(0xFFA9A199),
    tileSand = TileSand,
    tileClay = TileClay,
    tileSage = TileSage,
    tileSky = TileSky,
    navBar = Charcoal,
    isDark = false
)

val DarkPalette = MahamiPalette(
    background = NightBackground,
    surface = NightSurface,
    surfaceMuted = NightSurfaceAlt,
    ink = NightInk,
    inkSoft = Color(0xFFD5CDC2),
    inkMuted = NightInkMuted,
    hairline = Color(0x1FFFFFFF),
    accent = Ember,
    feature = Color(0xFF2C2822),
    featureSoft = Color(0xFF383229),
    onFeature = Color(0xFFF5F1EA),
    onFeatureMuted = Color(0xFFA49C91),
    tileSand = Color(0xFF2C2620),
    tileClay = Color(0xFF33271F),
    tileSage = Color(0xFF232A22),
    tileSky = Color(0xFF1F272C),
    navBar = Color(0xFF221F1A),
    isDark = true
)
