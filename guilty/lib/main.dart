import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/providers.dart';
import 'data/case_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Phones get passed around the table; landscape would only cause trouble.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0F172A),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Both are loaded up front so every provider downstream stays synchronous.
  final prefs = await SharedPreferences.getInstance();
  final repository = await CaseRepository.load();

  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        caseRepositoryProvider.overrideWithValue(repository),
      ],
      child: const SilentWitnessApp(),
    ),
  );
}
