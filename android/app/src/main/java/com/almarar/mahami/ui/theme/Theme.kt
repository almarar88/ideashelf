package com.almarar.mahami.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

val LocalMahamiPalette = staticCompositionLocalOf { LightPalette }

object MahamiTheme {
    val colors: MahamiPalette
        @Composable get() = LocalMahamiPalette.current
}

@Composable
fun MahamiAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val palette = if (darkTheme) DarkPalette else LightPalette

    val scheme = if (darkTheme) darkColorScheme(
        primary = palette.accent,
        onPrimary = Color.White,
        background = palette.background,
        onBackground = palette.ink,
        surface = palette.surface,
        onSurface = palette.ink,
        surfaceVariant = palette.surfaceMuted,
        onSurfaceVariant = palette.inkMuted,
        error = AccentRed
    ) else lightColorScheme(
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

    CompositionLocalProvider(LocalMahamiPalette provides palette) {
        MaterialTheme(
            colorScheme = scheme,
            typography = MahamiTypography,
            content = content
        )
    }
}
