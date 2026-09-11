import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/case_repository.dart';
import '../data/gemini_service.dart';
import 'audio_service.dart';

/// Loaded once in `main()` and injected through a `ProviderScope` override,
/// so the rest of the app can read it synchronously.
final caseRepositoryProvider = Provider<CaseRepository>(
  (ref) => throw UnimplementedError('caseRepositoryProvider must be overridden'),
);

final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPreferencesProvider must be overridden'),
);

final audioServiceProvider = Provider<AudioService>((ref) {
  final service = AudioService();
  ref.onDispose(service.dispose);
  return service;
});

final geminiServiceProvider = Provider<GeminiService>((ref) {
  final service = GeminiService();
  final prefs = ref.watch(sharedPreferencesProvider);
  service.runtimeKey = prefs.getString(PrefKeys.geminiKey) ?? '';
  return service;
});

class PrefKeys {
  const PrefKeys._();

  static const String geminiKey = 'gemini_api_key';
  static const String soundEnabled = 'sound_enabled';
  static const String playerCount = 'player_count';
  static const String categoryId = 'category_id';
  static const String roundSeconds = 'round_seconds';
}
