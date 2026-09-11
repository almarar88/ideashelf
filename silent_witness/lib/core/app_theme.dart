import 'package:flutter/material.dart';

/// Noir investigation palette. Every colour in the app comes from here.
class AppColors {
  const AppColors._();

  /// Deep midnight slate — the base of every screen.
  static const Color midnight = Color(0xFF0F172A);

  /// One step up from [midnight], for cards sitting on the background.
  static const Color slate = Color(0xFF1B2436);

  /// Muted graphite, for dividers, borders and disabled surfaces.
  static const Color graphite = Color(0xFF334155);

  /// Manila folder beige — the "paper" of the case file.
  static const Color manila = Color(0xFFE2D9C8);

  /// A slightly darker paper tone for folder tabs and shadows.
  static const Color manilaDark = Color(0xFFC9BDA6);

  /// Classic brass gold — headings, frames, primary actions.
  static const Color brass = Color(0xFFD4AF37);

  /// A dimmer brass for hairlines and inactive gold.
  static const Color brassDim = Color(0xFF8C7325);

  /// Crimson — the culprit, danger, the last seconds of the timer.
  static const Color crimson = Color(0xFFB91C1C);

  /// A brighter crimson for text on dark backgrounds.
  static const Color crimsonLight = Color(0xFFEF4444);

  /// Verdant green, used only for a correct verdict.
  static const Color verdict = Color(0xFF15803D);

  /// Ink, for text written on manila paper.
  static const Color ink = Color(0xFF1A1611);

  /// Faded ink for secondary text on paper.
  static const Color inkFaded = Color(0xFF6B6152);
}

/// Shared sizing so screens stay visually consistent.
class AppSizes {
  const AppSizes._();

  static const double gutter = 20;
  static const double radius = 18;
  static const double radiusSmall = 12;
  static const double buttonHeight = 62;
}

class AppTheme {
  const AppTheme._();

  static const String fontFamily = 'Cairo';

  static ThemeData build() {
    const scheme = ColorScheme.dark(
      primary: AppColors.brass,
      onPrimary: AppColors.midnight,
      secondary: AppColors.manila,
      onSecondary: AppColors.ink,
      error: AppColors.crimsonLight,
      onError: Colors.white,
      surface: AppColors.slate,
      onSurface: AppColors.manila,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.midnight,
      canvasColor: AppColors.midnight,
      splashFactory: InkRipple.splashFactory,
    );

    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: AppColors.brass),
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 22,
          fontWeight: FontWeight.w900,
          color: AppColors.brass,
          height: 1.6,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.graphite,
        thickness: 1,
        space: 24,
      ),
      textTheme: _textTheme(base.textTheme),
      // Arabic needs generous line height at every size — the family plays on
      // phones held at arm's length by grandparents and by kids.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brass,
          foregroundColor: AppColors.midnight,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 20,
            fontWeight: FontWeight.w900,
            height: 1.5,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.brass,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          side: const BorderSide(color: AppColors.brassDim, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 19,
            fontWeight: FontWeight.w700,
            height: 1.5,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.manila,
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 18,
            fontWeight: FontWeight.w700,
            height: 1.5,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.slate,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        hintStyle: const TextStyle(color: AppColors.graphite),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          borderSide: const BorderSide(color: AppColors.graphite),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          borderSide: const BorderSide(color: AppColors.graphite),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          borderSide: const BorderSide(color: AppColors.brass, width: 1.8),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.slate,
        contentTextStyle: TextStyle(
          fontFamily: fontFamily,
          color: AppColors.manila,
          fontSize: 17,
          height: 1.6,
        ),
        behavior: SnackBarBehavior.floating,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.slate,
        surfaceTintColor: Colors.transparent,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.slate,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }

  static TextTheme _textTheme(TextTheme base) {
    TextStyle s(double size, FontWeight weight, Color color,
            {double height = 1.7}) =>
        TextStyle(
          fontFamily: fontFamily,
          fontSize: size,
          fontWeight: weight,
          color: color,
          height: height,
        );

    return base.copyWith(
      displayLarge: s(40, FontWeight.w900, AppColors.brass, height: 1.4),
      displayMedium: s(32, FontWeight.w900, AppColors.brass, height: 1.4),
      headlineMedium: s(26, FontWeight.w900, AppColors.manila, height: 1.5),
      titleLarge: s(22, FontWeight.w700, AppColors.manila, height: 1.6),
      titleMedium: s(19, FontWeight.w700, AppColors.manila),
      bodyLarge: s(18, FontWeight.w400, AppColors.manila),
      bodyMedium: s(17, FontWeight.w400, AppColors.manila),
      bodySmall: s(15, FontWeight.w400, AppColors.graphite),
      labelLarge: s(18, FontWeight.w700, AppColors.midnight, height: 1.5),
    );
  }
}
