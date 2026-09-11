import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:silent_witness/app.dart';
import 'package:silent_witness/controllers/game_controller.dart';
import 'package:silent_witness/core/providers.dart';
import 'package:silent_witness/data/case_repository.dart';
import 'package:silent_witness/models/game_role.dart';
import 'package:silent_witness/models/game_settings.dart';
import 'package:silent_witness/models/game_state.dart';
import 'package:silent_witness/widgets/countdown_ring.dart';

Future<ProviderContainer> _container(CaseRepository repository) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final prefs = await SharedPreferences.getInstance();
  return ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      caseRepositoryProvider.overrideWithValue(repository),
    ],
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late CaseRepository repository;

  setUpAll(() async {
    repository = await CaseRepository.load();
  });

  group('offline case pack', () {
    test('ships at least 50 playable cases', () {
      expect(repository.cases.length, greaterThanOrEqualTo(50));
    });

    test('every case has a title, three clues and three questions', () {
      for (final mystery in repository.cases) {
        expect(mystery.title.trim(), isNotEmpty, reason: mystery.id);
        expect(mystery.description.trim(), isNotEmpty, reason: mystery.id);
        expect(mystery.clues.length, 3, reason: mystery.id);
        expect(mystery.questions.length, 3, reason: mystery.id);
      }
    });

    test('every case belongs to a declared category', () {
      final ids = repository.categories.map((c) => c.id).toSet();
      expect(ids, isNotEmpty);
      for (final mystery in repository.cases) {
        expect(ids, contains(mystery.category), reason: mystery.id);
      }
    });

    test('each category can fill a whole session without repeating', () {
      for (final category in repository.categories) {
        final size = repository.cases.where((c) => c.category == category.id).length;
        final drawn = <String>{};
        for (var i = 0; i < size; i++) {
          drawn.add(repository.randomCase(category.id).id);
        }
        expect(drawn.length, size, reason: category.id);
      }
    });

    test('the alibi pool is populated', () {
      expect(repository.alibis.length, greaterThanOrEqualTo(20));
      expect(repository.silentCards, contains('نعم'));
      expect(repository.silentCards, contains('لا'));
      expect(repository.silentCards, contains('لا أعلم'));
    });
  });

  group('role dealing', () {
    test('every roster size gets exactly one of each key role', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);

      for (var count = GameSettings.minPlayers;
          count <= GameSettings.maxPlayers;
          count++) {
        controller.setPlayerCount(count);
        await controller.startRound();
        final players = container.read(gameControllerProvider).players;

        expect(players.length, count);
        for (final role in [GameRole.detective, GameRole.witness, GameRole.culprit]) {
          expect(players.where((p) => p.role == role).length, 1,
              reason: '$count players / $role');
        }
        expect(
          players.where((p) => p.role == GameRole.suspect).length,
          count - 3,
        );
        expect(players.map((p) => p.id).toSet().length, count);
      }
    });

    test('only the culprit and the innocent suspects can be accused', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);

      controller.setPlayerCount(6);
      await controller.startRound();
      final state = container.read(gameControllerProvider);

      expect(state.accusableSuspects.length, 4);
      expect(state.witnessIsAccusable, isFalse);
      expect(state.accusableSuspects, isNot(contains(state.detective)));
      expect(state.accusableSuspects, isNot(contains(state.witness)));
      expect(state.accusableSuspects, contains(state.culprit));
    });

    test('a three-player round still offers a real choice', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);

      controller.setPlayerCount(3);
      await controller.startRound();
      final state = container.read(gameControllerProvider);

      // Without the fallback the detective would face a single name.
      expect(state.witnessIsAccusable, isTrue);
      expect(state.accusableSuspects.length, 2);
      expect(state.accusableSuspects, contains(state.culprit));
      expect(state.accusableSuspects, contains(state.witness));
      expect(state.accusableSuspects, isNot(contains(state.detective)));

      controller.selectAccused(state.witness!.id);
      expect(container.read(gameControllerProvider).detectiveWon, isFalse);
    });

    test('accusing the culprit wins the round for the detective', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);

      controller.setPlayerCount(5);
      await controller.startRound();

      final culpritId = container.read(gameControllerProvider).culprit!.id;
      controller.selectAccused(culpritId);
      expect(container.read(gameControllerProvider).detectiveWon, isTrue);

      final innocent = container
          .read(gameControllerProvider)
          .players
          .firstWhere((p) => p.role == GameRole.suspect);
      controller.selectAccused(innocent.id);
      expect(container.read(gameControllerProvider).detectiveWon, isFalse);
    });
  });

  group('round bookkeeping', () {
    test('the witness has exactly three questions', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);
      await controller.startRound();

      expect(container.read(gameControllerProvider).questionsLeft,
          GameState.maxWitnessQuestions);
      for (var i = 0; i < 5; i++) {
        controller.useWitnessQuestion();
      }
      expect(container.read(gameControllerProvider).questionsLeft, 0);

      controller.resetWitnessQuestions();
      expect(container.read(gameControllerProvider).questionsLeft,
          GameState.maxWitnessQuestions);
    });

    test('the alibi button always returns something, key or no key', () async {
      final container = await _container(repository);
      addTearDown(container.dispose);
      final controller = container.read(gameControllerProvider.notifier);
      await controller.startRound();

      await controller.requestAlibi();
      final state = container.read(gameControllerProvider);
      expect(state.alibiLoading, isFalse);
      expect(state.aiAlibi, isNotNull);
      expect(state.aiAlibi!.trim(), isNotEmpty);
    });

    test('player names fall back to Arabic-numbered defaults', () {
      const settings = GameSettings(playerNames: ['سارة', '   ']);
      expect(settings.nameFor(0), 'سارة');
      expect(settings.nameFor(1), 'لاعب ٢');
      expect(settings.nameFor(9), 'لاعب ١٠');
    });

    test('the clock formats as mm:ss', () {
      expect(CountdownRing.format(180), '03:00');
      expect(CountdownRing.format(65), '01:05');
      expect(CountdownRing.format(0), '00:00');
    });
  });

  testWidgets('the home screen opens in Arabic and right-to-left',
      (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          caseRepositoryProvider.overrideWithValue(repository),
        ],
        child: const SilentWitnessApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('الشاهد الصامت'), findsOneWidget);
    expect(find.text('افتح قضية جديدة'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('افتح قضية جديدة'))),
      TextDirection.rtl,
    );
  });
}
