import 'game_role.dart';
import 'game_settings.dart';
import 'mystery_case.dart';
import 'player.dart';

/// Where the round currently is. The whole UI is driven off this.
enum GamePhase {
  /// Nothing started yet — the home screen.
  idle,

  /// Roles are being handed out, one player at a time.
  distributing,

  /// The case file is open and everyone has read the crime.
  briefing,

  /// The three-minute interrogation.
  investigating,

  /// The detective is choosing who to accuse.
  verdict,

  /// The culprit has been revealed.
  result,
}

class GameState {
  const GameState({
    this.phase = GamePhase.idle,
    this.settings = const GameSettings(),
    this.players = const <Player>[],
    this.mysteryCase,
    this.revealIndex = 0,
    this.secondsLeft = 0,
    this.timerRunning = false,
    this.questionsUsed = 0,
    this.accusedId,
    this.aiAlibi,
    this.alibiLoading = false,
    this.caseLoading = false,
    this.errorMessage,
    this.detectiveWins = 0,
    this.culpritWins = 0,
    this.roundNumber = 0,
  });

  final GamePhase phase;
  final GameSettings settings;
  final List<Player> players;
  final MysteryCase? mysteryCase;

  /// Index of the player currently holding the phone during role handout.
  final int revealIndex;

  final int secondsLeft;
  final bool timerRunning;

  /// How many of the detective's three witness questions have been spent.
  final int questionsUsed;

  final int? accusedId;

  /// The last alibi the culprit pulled from the AI defence lawyer.
  final String? aiAlibi;
  final bool alibiLoading;
  final bool caseLoading;
  final String? errorMessage;

  final int detectiveWins;
  final int culpritWins;
  final int roundNumber;

  static const int maxWitnessQuestions = 3;

  Player? get detective => _firstWithRole(GameRole.detective);
  Player? get witness => _firstWithRole(GameRole.witness);
  Player? get culprit => _firstWithRole(GameRole.culprit);

  /// Everyone the detective is allowed to accuse.
  ///
  /// At three players there is one culprit and no innocent suspects, which
  /// would leave the detective with a single name and a guaranteed win. At
  /// that size the Silent Witness joins the line-up, so the accusation is a
  /// real choice again.
  List<Player> get accusableSuspects {
    final pool = players.where((p) => p.role.isAccusable).toList(growable: false);
    if (pool.length > 1) return pool;
    return players
        .where((p) => p.role != GameRole.detective)
        .toList(growable: false);
  }

  /// True when the Silent Witness had to be added to the line-up.
  bool get witnessIsAccusable =>
      players.where((p) => p.role.isAccusable).length < 2;

  Player? get accused =>
      accusedId == null ? null : players.where((p) => p.id == accusedId).firstOrNull;

  bool get detectiveWon => accusedId != null && accusedId == culprit?.id;

  int get questionsLeft =>
      (maxWitnessQuestions - questionsUsed).clamp(0, maxWitnessQuestions);

  /// 1.0 at the start of the round, 0.0 when time is up.
  double get timeFraction {
    final total = settings.roundSeconds;
    if (total <= 0) return 0;
    return (secondsLeft / total).clamp(0.0, 1.0);
  }

  bool get isFinalMinute => secondsLeft <= 60;
  bool get isFinalSeconds => secondsLeft <= 10;

  Player? _firstWithRole(GameRole role) =>
      players.where((p) => p.role == role).firstOrNull;

  GameState copyWith({
    GamePhase? phase,
    GameSettings? settings,
    List<Player>? players,
    MysteryCase? mysteryCase,
    int? revealIndex,
    int? secondsLeft,
    bool? timerRunning,
    int? questionsUsed,
    int? accusedId,
    bool clearAccused = false,
    String? aiAlibi,
    bool clearAlibi = false,
    bool? alibiLoading,
    bool? caseLoading,
    String? errorMessage,
    bool clearError = false,
    int? detectiveWins,
    int? culpritWins,
    int? roundNumber,
  }) =>
      GameState(
        phase: phase ?? this.phase,
        settings: settings ?? this.settings,
        players: players ?? this.players,
        mysteryCase: mysteryCase ?? this.mysteryCase,
        revealIndex: revealIndex ?? this.revealIndex,
        secondsLeft: secondsLeft ?? this.secondsLeft,
        timerRunning: timerRunning ?? this.timerRunning,
        questionsUsed: questionsUsed ?? this.questionsUsed,
        accusedId: clearAccused ? null : (accusedId ?? this.accusedId),
        aiAlibi: clearAlibi ? null : (aiAlibi ?? this.aiAlibi),
        alibiLoading: alibiLoading ?? this.alibiLoading,
        caseLoading: caseLoading ?? this.caseLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        detectiveWins: detectiveWins ?? this.detectiveWins,
        culpritWins: culpritWins ?? this.culpritWins,
        roundNumber: roundNumber ?? this.roundNumber,
      );
}
