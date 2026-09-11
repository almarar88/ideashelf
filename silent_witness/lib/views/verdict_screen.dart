import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../models/player.dart';
import '../widgets/abandon_round_guard.dart';
import '../widgets/case_file_scaffold.dart';
import 'result_screen.dart';

/// The detective names one suspect. Nothing is revealed until the gavel falls.
class VerdictScreen extends ConsumerWidget {
  const VerdictScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final suspects = state.accusableSuspects;

    return AbandonRoundGuard(
      child: CaseFileScaffold(
        title: 'لحظة الاتهام',
        subtitle: state.detective == null
            ? null
            : 'القرار بيد ${state.detective!.name}',
        bottom: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    state.accusedId == null ? AppColors.graphite : AppColors.crimson,
                foregroundColor: Colors.white,
              ),
              icon: const Icon(Icons.gavel_rounded, size: 26),
              label: Text(
                state.accused == null
                    ? 'اختر المتهم أولاً'
                    : 'أتهم ${state.accused!.name}',
              ),
              onPressed: state.accusedId == null
                  ? null
                  : () async {
                      await controller.confirmVerdict();
                      if (!context.mounted) return;
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute<void>(
                          builder: (_) => const ResultScreen(),
                        ),
                      );
                    },
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () async {
                final confirmed = await _confirmSurrender(context);
                if (!confirmed || !context.mounted) return;
                await controller.surrenderRound();
                if (!context.mounted) return;
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute<void>(builder: (_) => const ResultScreen()),
                );
              },
              child: const Text('المحقق يستسلم — اكشف الجاني'),
            ),
          ],
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            10,
            AppSizes.gutter,
            8,
          ),
          children: [
            PaperCard(
              stamp: 'الحكم',
              padding: const EdgeInsets.fromLTRB(20, 46, 20, 20),
              child: Text(
                'انتهى الاستجواب. على المحقق أن يسمّي شخصاً واحداً.\n'
                'إن أصاب فاز هو والشاهد الصامت، وإن أخطأ أفلت الجاني بجريمته.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 18,
                  color: AppColors.ink,
                  height: 1.9,
                ),
              ),
            ),
            const SizedBox(height: 18),
            ...suspects.map(
              (player) => _SuspectTile(
                player: player,
                selected: player.id == state.accusedId,
                onTap: () => controller.selectAccused(player.id),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              state.witnessIsAccusable
                  ? 'في جلسة الثلاثة لاعبين يدخل الشاهد الصامت قائمة الاتهام '
                      'حتى يكون أمام المحقق خيار حقيقي. المحقق وحده خارجها.'
                  : 'المحقق والشاهد الصامت خارج قائمة الاتهام.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Future<bool> _confirmSurrender(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('تأكيد الاستسلام',
            style: Theme.of(context).textTheme.titleLarge),
        content: Text(
          'ستُحتسب الجولة لصالح الجاني ويُكشف اسمه مباشرة. هل أنت متأكد؟',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('تراجع'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.crimsonLight),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('نعم، اكشف'),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}

class _SuspectTile extends StatelessWidget {
  const _SuspectTile({
    required this.player,
    required this.selected,
    required this.onTap,
  });

  final Player player;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSizes.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.crimson.withValues(alpha: 0.16)
                : AppColors.slate,
            borderRadius: BorderRadius.circular(AppSizes.radius),
            border: Border.all(
              color: selected ? AppColors.crimson : AppColors.graphite,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.midnight,
                  border: Border.all(
                    color: selected ? AppColors.crimsonLight : AppColors.brassDim,
                  ),
                ),
                child: Icon(
                  Icons.person_rounded,
                  color: selected ? AppColors.crimsonLight : AppColors.brass,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  player.name,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                    color: selected ? AppColors.crimsonLight : AppColors.manila,
                    height: 1.5,
                  ),
                ),
              ),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected ? AppColors.crimsonLight : AppColors.graphite,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
