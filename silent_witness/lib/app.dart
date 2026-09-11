import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/app_theme.dart';
import 'views/home_screen.dart';

class SilentWitnessApp extends StatelessWidget {
  const SilentWitnessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'الشاهد الصامت',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      // The whole game is Arabic and right-to-left, on every device.
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        // Clamp the OS font scale: the layout is already large-print, and an
        // extreme system setting would push the timer off screen.
        final scale = MediaQuery.textScalerOf(context).clamp(
          minScaleFactor: 0.9,
          maxScaleFactor: 1.25,
        );
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: scale),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: const HomeScreen(),
    );
  }
}
