import 'game_role.dart';

/// One person around the table.
class Player {
  const Player({
    required this.id,
    required this.name,
    required this.role,
  });

  final int id;
  final String name;
  final GameRole role;

  Player copyWith({String? name, GameRole? role}) => Player(
        id: id,
        name: name ?? this.name,
        role: role ?? this.role,
      );

  @override
  bool operator ==(Object other) => other is Player && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
