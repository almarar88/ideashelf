import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../models/game_role.dart';
import '../widgets/abandon_round_guard.dart';
import '../widgets/case_file_scaffold.dart';
import '../widgets/hold_to_reveal.dart';
import '../widgets/role_badge.dart';
import 'briefing_screen.dart';

/// Pass-and-play role hand-out. One player at a time, nothing on screen until
/// a finger is held on the pad.
class RoleRevealScreen extends ConsumerStatefulWidget {
  const RoleRevealScreen({super.key});

  @override
  ConsumerState<RoleRevealScreen> createState() => _RoleRevealScreenState();
}

class _RoleRevealScreenState extends ConsumerState<RoleRevealScreen> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);

    if (state.players.isEmpty) {
      return const CaseFileScaffold(
        child: Center(child: CircularProgressIndicator(color: AppColors.brass)),
      );
    }

    final index = state.revealIndex.clamp(0, state.players.length - 1);
    final player = state.players[index];
    final isLast = index == state.players.length - 1;

    return AbandonRoundGuard(
      child: CaseFileScaffold(
        title: 'توزيع الأدوار',
        subtitle: 'اللاعب ${index + 1} من ${state.players.length}',
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.gutter),
          child: _revealed
              ? _RevealedView(
                  playerName: player.name,
                  role: player.role,
                  culpritName: state.culprit?.name,
                  isLast: isLast,
                  onNext: () {
                    ref.read(audioServiceProvider).click();
                    setState(() => _revealed = false);
                    final wasLast = isLast;
                    controller.nextReveal();
                    if (wasLast) {
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute<void>(
                          builder: (_) => const BriefingScreen(),
                        ),
                      );
                    }
                  },
                )
              : _HandoverView(
                  playerName: player.name,
                  onRevealed: () => setState(() => _revealed = true),
                ),
        ),
      ),
    );
  }
}

class _HandoverView extends StatelessWidget {
  const _HandoverView({required this.playerName, required this.onRevealed});

  final String playerName;
  final VoidCallback onRevealed;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'مرّر الجهاز إلى',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 6),
        Text(
          playerName,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.displayMedium,
        ),
        const SizedBox(height: 34),
        HoldToReveal(
          label: 'ضع إصبعك واستمر بالضغط',
          hint: 'لا ترفع إصبعك حتى تكتمل الدائرة',
          onRevealed: onRevealed,
        ),
        const SizedBox(height: 26),
        Text(
          'تأكّد أن أحداً لا ينظر إلى الشاشة',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _RevealedView extends StatelessWidget {
  const _RevealedView({
    required this.playerName,
    required this.role,
    required this.culpritName,
    required this.isLast,
    required this.onNext,
  });

  final String playerName;
  final GameRole role;
  final String? culpritName;
  final bool isLast;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    // Only the Silent Witness is told who did it.
    final secret = role == GameRole.witness && culpritName != null
        ? 'الجاني هو: $culpritName'
        : null;

    return Column(
      children: [
        const SizedBox(height: 6),
        Text(playerName, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 10),
        Expanded(
          child: SingleChildScrollView(
            child: RoleBadge(role: role, extraLine: secret),
          ),
        ),
        const SizedBox(height: 10),
        ElevatedButton.icon(
          icon: Icon(
            isLast ? Icons.folder_open_rounded : Icons.swipe_rounded,
            size: 24,
          ),
          label: Text(isLast ? 'افتح ملف القضية' : 'حفظت دوري — التالي'),
          onPressed: onNext,
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}
