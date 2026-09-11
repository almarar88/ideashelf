import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../widgets/abandon_round_guard.dart';
import '../widgets/case_file_scaffold.dart';
import '../widgets/confetti_overlay.dart';
import 'role_reveal_screen.dart';

/// The culprit is revealed, the round is scored, and the table decides whether
/// to open another file.
class ResultScreen extends ConsumerStatefulWidget {
  const ResultScreen({super.key});

  @override
  ConsumerState<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends ConsumerState<ResultScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entry = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..forward();

  bool _startingNext = false;

  @override
  void dispose() {
    _entry.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final won = state.detectiveWon;
    final culprit = state.culprit;
    final accused = state.accused;

    return AbandonRoundGuard(
      confirm: false,
      child: Stack(
        children: [
          CaseFileScaffold(
            title: 'الحكم النهائي',
            subtitle: state.mysteryCase?.title,
            bottom: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ElevatedButton.icon(
                  icon: _startingNext
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: AppColors.midnight,
                          ),
                        )
                      : const Icon(Icons.replay_rounded, size: 26),
                  label: Text(_startingNext ? 'جارٍ التجهيز…' : 'جولة جديدة'),
                  onPressed: _startingNext ? null : () => _nextRound(controller),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  icon: const Icon(Icons.home_rounded),
                  label: const Text('العودة للرئيسية'),
                  onPressed: () {
                    controller.backToHome();
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                ),
              ],
            ),
            child: FadeTransition(
              opacity: _entry,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.gutter,
                  10,
                  AppSizes.gutter,
                  8,
                ),
                children: [
                  _Headline(won: won),
                  const SizedBox(height: 18),
                  PaperCard(
                    stamp: won ? 'قضية محلولة' : 'قضية مغلقة',
                    stampColor: won ? AppColors.verdict : AppColors.crimson,
                    padding: const EdgeInsets.fromLTRB(20, 48, 20, 22),
                    child: Column(
                      children: [
                        const Text(
                          'الجاني الحقيقي',
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 17,
                            color: AppColors.inkFaded,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          culprit?.name ?? '—',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            color: AppColors.crimson,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Container(height: 1.2, color: AppColors.manilaDark),
                        const SizedBox(height: 14),
                        Text(
                          accused == null
                              ? 'لم يوجَّه أي اتهام قبل انتهاء الوقت.'
                              : 'اتهم المحقق: ${accused.name}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 18,
                            color: AppColors.ink,
                            height: 1.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  SlatePanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('كشف الأدوار',
                            style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 10),
                        ...state.players.map(
                          (player) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Icon(player.role.icon,
                                    color: player.role.color, size: 22),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    player.name,
                                    style:
                                        Theme.of(context).textTheme.bodyLarge,
                                  ),
                                ),
                                Text(
                                  player.role.title,
                                  style: TextStyle(
                                    fontFamily: AppTheme.fontFamily,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: player.role.color,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const Divider(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _Tally(
                              label: 'المحققون',
                              value: state.detectiveWins,
                              color: AppColors.brass,
                            ),
                            _Tally(
                              label: 'الجناة',
                              value: state.culpritWins,
                              color: AppColors.crimsonLight,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
          if (won) const Positioned.fill(child: ConfettiOverlay()),
        ],
      ),
    );
  }

  Future<void> _nextRound(GameController controller) async {
    setState(() => _startingNext = true);
    ref.read(audioServiceProvider).click();
    await controller.startNextRound();
    if (!mounted) return;
    setState(() => _startingNext = false);

    // Straight back into the hand-out; the briefing follows it.
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const RoleRevealScreen()),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline({required this.won});

  final bool won;

  @override
  Widget build(BuildContext context) {
    final color = won ? AppColors.verdict : AppColors.crimson;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: color, width: 2),
      ),
      child: Column(
        children: [
          Icon(
            won ? Icons.verified_rounded : Icons.running_with_errors_rounded,
            size: 54,
            color: won ? AppColors.verdict : AppColors.crimsonLight,
          ),
          const SizedBox(height: 10),
          Text(
            won ? 'القضية حُلّت!' : 'الجاني أفلت!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: won ? AppColors.verdict : AppColors.crimsonLight,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            won
                ? 'المحقق والشاهد الصامت يفوزان بهذه الجولة.'
                : 'الجاني يفوز بالجولة… ابتسامته تكفي.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    );
  }
}

class _Tally extends StatelessWidget {
  const _Tally({required this.label, required this.value, required this.color});

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$value',
          style: TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 30,
            fontWeight: FontWeight.w900,
            color: color,
            height: 1.2,
          ),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
