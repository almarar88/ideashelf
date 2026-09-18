package com.almarar.mahami.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.almarar.mahami.data.AccentColor
import com.almarar.mahami.data.ThemeMode

val LocalMahamiPalette = staticCompositionLocalOf { LightPalette }

object MahamiTheme {
    val colors: MahamiPalette
        @Composable get() = LocalMahamiPalette.current
}

@Composable
fun MahamiAppTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    accent: AccentColor = AccentColor.BLUE,
    content: @Composable () -> Unit
) {
    val darkTheme = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val accentColor = Color(accent.argb)
    val palette = (if (darkTheme) DarkPalette else LightPalette).copy(accent = accentColor)

    val scheme = if (darkTheme) {
        darkColorScheme(
            primary = palette.accent,
            onPrimary = Color.White,
            background = palette.background,
            onBackground = palette.ink,
            surface = palette.surface,
            onSurface = palette.ink,
            surfaceVariant = palette.surfaceMuted,
            onSurfaceVariant = palette.inkMuted,
            error = AccentRed
        )
    } else {
        lightColorScheme(
            primary = palette.accent,
            onPrimary = Color.White,
            background = palette.background,
            onBackground = palette.ink,
            surface = palette.surface,
            onSurface = palette.ink,
            surfaceVariant = palette.surfaceMuted,
            onSurfaceVariant = palette.inkMuted,
            error = AccentRed
        )
    }

    CompositionLocalProvider(LocalMahamiPalette provides palette) {
        MaterialTheme(colorScheme = scheme, typography = MahamiTypography, content = content)
    }
}
