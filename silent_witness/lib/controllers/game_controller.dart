import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../models/game_role.dart';
import '../models/game_settings.dart';
import '../models/game_state.dart';
import '../models/mystery_case.dart';
import '../models/player.dart';

final gameControllerProvider =
    NotifierProvider<GameController, GameState>(GameController.new);

class GameController extends Notifier<GameState> {
  Timer? _ticker;
  final Random _random = Random();

  @override
  GameState build() {
    ref.onDispose(_cancelTicker);
    final prefs = ref.read(sharedPreferencesProvider);
    final audio = ref.read(audioServiceProvider);

    final settings = GameSettings(
      playerCount: prefs.getInt(PrefKeys.playerCount) ?? 5,
      categoryId: prefs.getString(PrefKeys.categoryId) ?? 'kitchen',
      roundSeconds: prefs.getInt(PrefKeys.roundSeconds) ?? 180,
      soundEnabled: prefs.getBool(PrefKeys.soundEnabled) ?? true,
    );
    audio.setEnabled(settings.soundEnabled);

    return GameState(settings: settings, secondsLeft: settings.roundSeconds);
  }

  // ------------------------------------------------------------------ setup

  void setPlayerCount(int count) {
    final clamped =
        count.clamp(GameSettings.minPlayers, GameSettings.maxPlayers);
    _persist(playerCount: clamped);
    state = state.copyWith(
      settings: state.settings.copyWith(playerCount: clamped),
    );
  }

  void setCategory(String categoryId) {
    _persist(categoryId: categoryId);
    state = state.copyWith(
      settings: state.settings.copyWith(categoryId: categoryId),
    );
  }

  void setRoundSeconds(int seconds) {
    _persist(roundSeconds: seconds);
    state = state.copyWith(
      settings: state.settings.copyWith(roundSeconds: seconds),
      secondsLeft: seconds,
    );
  }

  void setPlayerName(int index, String name) {
    final names = List<String>.from(state.settings.playerNames);
    while (names.length <= index) {
      names.add('');
    }
    names[index] = name;
    state = state.copyWith(
      settings: state.settings.copyWith(playerNames: names),
    );
  }

  Future<void> setSoundEnabled(bool enabled) async {
    _persist(soundEnabled: enabled);
    await ref.read(audioServiceProvider).setEnabled(enabled);
    state = state.copyWith(
      settings: state.settings.copyWith(soundEnabled: enabled),
    );
  }

  void setUseAi(bool value) {
    state = state.copyWith(settings: state.settings.copyWith(useAi: value));
  }

  Future<void> setGeminiKey(String key) async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setString(PrefKeys.geminiKey, key.trim());
    ref.invalidate(geminiServiceProvider);
    if (key.trim().isEmpty) setUseAi(false);
  }

  bool get aiAvailable => ref.read(geminiServiceProvider).isConfigured;

  // ------------------------------------------------------------- round flow

  /// Deals the roles and loads a case. Awaited by the setup screen so the
  /// "AI is writing the case" spinner has something to wait on.
  Future<void> startRound() async {
    _cancelTicker();
    final settings = state.settings;

    state = state.copyWith(
      phase: GamePhase.distributing,
      players: _dealRoles(settings),
      revealIndex: 0,
      questionsUsed: 0,
      secondsLeft: settings.roundSeconds,
      timerRunning: false,
      clearAccused: true,
      clearAlibi: true,
      clearError: true,
      caseLoading: true,
      roundNumber: state.roundNumber + 1,
    );

    final mystery = await _pickCase(settings);
    state = state.copyWith(mysteryCase: mystery, caseLoading: false);
  }

  /// Same roster and settings, brand new roles and a brand new case.
  Future<void> startNextRound() => startRound();

  List<Player> _dealRoles(GameSettings settings) {
    final roles = <GameRole>[
      GameRole.detective,
      GameRole.witness,
      GameRole.culprit,
      for (var i = 3; i < settings.playerCount; i++) GameRole.suspect,
    ]..shuffle(_random);

    return List<Player>.generate(
      settings.playerCount,
      (i) => Player(id: i, name: settings.nameFor(i), role: roles[i]),
      growable: false,
    );
  }

  Future<MysteryCase> _pickCase(GameSettings settings) async {
    final repository = ref.read(caseRepositoryProvider);
    final category = repository.categoryById(settings.categoryId);

    if (settings.useAi) {
      final generated = await ref.read(geminiServiceProvider).generateCase(
            categoryId: settings.categoryId,
            categoryName: category.name,
            playerCount: settings.playerCount,
          );
      if (generated != null) return generated;
      state = state.copyWith(
        errorMessage: 'تعذّر توليد قضية جديدة، تم اختيار قضية من الملف المحلي.',
      );
    }

    return repository.randomCase(settings.categoryId);
  }

  /// Advances the pass-and-play hand-out; moves to the briefing when done.
  void nextReveal() {
    final next = state.revealIndex + 1;
    if (next >= state.players.length) {
      state = state.copyWith(phase: GamePhase.briefing);
    } else {
      state = state.copyWith(revealIndex: next);
    }
  }

  void openInvestigation() {
    state = state.copyWith(
      phase: GamePhase.investigating,
      secondsLeft: state.settings.roundSeconds,
    );
    startTimer();
  }

  // ----------------------------------------------------------------- timer

  void startTimer() {
    if (state.timerRunning) return;
    state = state.copyWith(timerRunning: true);
    ref.read(audioServiceProvider).startAmbient();
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void pauseTimer() {
    if (!state.timerRunning) return;
    _ticker?.cancel();
    _ticker = null;
    ref.read(audioServiceProvider).pauseAmbient();
    state = state.copyWith(timerRunning: false);
  }

  void resumeTimer() {
    if (state.timerRunning || state.secondsLeft <= 0) return;
    ref.read(audioServiceProvider).resumeAmbient();
    state = state.copyWith(timerRunning: true);
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void toggleTimer() => state.timerRunning ? pauseTimer() : resumeTimer();

  void addSeconds(int seconds) {
    state = state.copyWith(
      secondsLeft: (state.secondsLeft + seconds).clamp(0, 60 * 60),
    );
  }

  void _tick() {
    final remaining = state.secondsLeft - 1;
    if (remaining <= 0) {
      _cancelTicker();
      ref.read(audioServiceProvider).stopAmbient();
      state = state.copyWith(secondsLeft: 0, timerRunning: false);
      openVerdict();
      return;
    }
    state = state.copyWith(secondsLeft: remaining);
  }

  void _cancelTicker() {
    _ticker?.cancel();
    _ticker = null;
  }

  // ------------------------------------------------------------ questioning

  /// Spends one of the detective's three questions to the Silent Witness.
  void useWitnessQuestion() {
    if (state.questionsLeft == 0) return;
    ref.read(audioServiceProvider).click();
    state = state.copyWith(questionsUsed: state.questionsUsed + 1);
  }

  void resetWitnessQuestions() => state = state.copyWith(questionsUsed: 0);

  /// The "consult the lawyer" button: an AI alibi, or an offline one.
  Future<void> requestAlibi() async {
    if (state.alibiLoading) return;
    state = state.copyWith(alibiLoading: true, clearAlibi: true);

    final gemini = ref.read(geminiServiceProvider);
    String? alibi;
    if (gemini.isConfigured) {
      alibi = await gemini.generateAlibi(
        caseTitle: state.mysteryCase?.title ?? '',
        caseDescription: state.mysteryCase?.description ?? '',
      );
    }
    alibi ??= ref.read(caseRepositoryProvider).randomAlibi();

    state = state.copyWith(aiAlibi: alibi, alibiLoading: false);
  }

  void clearAlibi() => state = state.copyWith(clearAlibi: true);

  // ----------------------------------------------------------------- verdict

  void openVerdict() {
    _cancelTicker();
    ref.read(audioServiceProvider).stopAmbient();
    ref.read(audioServiceProvider).suspense();
    state = state.copyWith(
      phase: GamePhase.verdict,
      timerRunning: false,
      clearAccused: true,
    );
  }

  void selectAccused(int playerId) {
    ref.read(audioServiceProvider).click();
    state = state.copyWith(accusedId: playerId);
  }

  /// Bangs the gavel and reveals the culprit.
  Future<void> confirmVerdict() async {
    if (state.accusedId == null) return;
    final audio = ref.read(audioServiceProvider);
    await audio.gavel();

    final won = state.detectiveWon;
    state = state.copyWith(
      phase: GamePhase.result,
      detectiveWins: state.detectiveWins + (won ? 1 : 0),
      culpritWins: state.culpritWins + (won ? 0 : 1),
    );

    await Future<void>.delayed(const Duration(milliseconds: 550));
    await audio.reveal(detectiveWon: won);
  }

  /// Time ran out with nobody accused — the culprit walks.
  Future<void> surrenderRound() async {
    final audio = ref.read(audioServiceProvider);
    await audio.gavel();
    state = state.copyWith(
      phase: GamePhase.result,
      clearAccused: true,
      culpritWins: state.culpritWins + 1,
    );
    await Future<void>.delayed(const Duration(milliseconds: 550));
    await audio.reveal(detectiveWon: false);
  }

  void resetScores() =>
      state = state.copyWith(detectiveWins: 0, culpritWins: 0, roundNumber: 0);

  /// Back to the home screen, keeping the score board.
  void backToHome() {
    _cancelTicker();
    ref.read(audioServiceProvider).stopAmbient();
    state = state.copyWith(
      phase: GamePhase.idle,
      timerRunning: false,
      secondsLeft: state.settings.roundSeconds,
      clearAccused: true,
      clearAlibi: true,
      clearError: true,
    );
  }

  void clearError() => state = state.copyWith(clearError: true);

  void _persist({
    int? playerCount,
    String? categoryId,
    int? roundSeconds,
    bool? soundEnabled,
  }) {
    final prefs = ref.read(sharedPreferencesProvider);
    if (playerCount != null) prefs.setInt(PrefKeys.playerCount, playerCount);
    if (categoryId != null) prefs.setString(PrefKeys.categoryId, categoryId);
    if (roundSeconds != null) prefs.setInt(PrefKeys.roundSeconds, roundSeconds);
    if (soundEnabled != null) {
      prefs.setBool(PrefKeys.soundEnabled, soundEnabled);
    }
  }
}
