/// Everything the host picks on the setup screen.
class GameSettings {
  const GameSettings({
    this.playerCount = 5,
    this.categoryId = 'kitchen',
    this.roundSeconds = 180,
    this.soundEnabled = true,
    this.useAi = false,
    this.playerNames = const <String>[],
  });

  final int playerCount;
  final String categoryId;
  final int roundSeconds;
  final bool soundEnabled;

  /// Ask Gemini for a fresh case instead of drawing one from the offline pack.
  final bool useAi;

  /// Custom names; blanks fall back to «لاعب ١», «لاعب ٢» …
  final List<String> playerNames;

  static const int minPlayers = 3;
  static const int maxPlayers = 10;

  GameSettings copyWith({
    int? playerCount,
    String? categoryId,
    int? roundSeconds,
    bool? soundEnabled,
    bool? useAi,
    List<String>? playerNames,
  }) =>
      GameSettings(
        playerCount: playerCount ?? this.playerCount,
        categoryId: categoryId ?? this.categoryId,
        roundSeconds: roundSeconds ?? this.roundSeconds,
        soundEnabled: soundEnabled ?? this.soundEnabled,
        useAi: useAi ?? this.useAi,
        playerNames: playerNames ?? this.playerNames,
      );

  /// The display name for seat [index], padded with a default when empty.
  String nameFor(int index) {
    if (index < playerNames.length) {
      final name = playerNames[index].trim();
      if (name.isNotEmpty) return name;
    }
    return 'لاعب ${_arabicIndex(index + 1)}';
  }

  static String _arabicIndex(int n) {
    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return n.toString().split('').map((d) => digits[int.parse(d)]).join();
  }
}
