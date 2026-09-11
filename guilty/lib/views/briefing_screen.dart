import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../widgets/abandon_round_guard.dart';
import '../widgets/case_file_scaffold.dart';
import '../widgets/hold_to_reveal.dart';
import 'investigation_screen.dart';

/// The open case file: the crime is read aloud to everyone, the three clues
/// stay behind a fingerprint for the Silent Witness alone.
class BriefingScreen extends ConsumerStatefulWidget {
  const BriefingScreen({super.key});

  @override
  ConsumerState<BriefingScreen> createState() => _BriefingScreenState();
}

class _BriefingScreenState extends ConsumerState<BriefingScreen> {
  bool _cluesVisible = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final mystery = state.mysteryCase;

    if (state.caseLoading || mystery == null) {
      return const CaseFileScaffold(
        title: 'ملف القضية',
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: AppColors.brass),
              SizedBox(height: 18),
              Text('جارٍ فتح الملف…'),
            ],
          ),
        ),
      );
    }

    return AbandonRoundGuard(
      child: CaseFileScaffold(
        title: 'ملف القضية',
        subtitle: 'اقرأ التفاصيل بصوت عالٍ أمام الجميع',
        bottom: ElevatedButton.icon(
          icon: const Icon(Icons.timer_outlined, size: 26),
          label: const Text('ابدأ التحقيق'),
          onPressed: () {
            ref.read(audioServiceProvider).click();
            controller.openInvestigation();
            Navigator.of(context).pushReplacement(
              MaterialPageRoute<void>(builder: (_) => const InvestigationScreen()),
            );
          },
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            10,
            AppSizes.gutter,
            10,
          ),
          children: [
            PaperCard(
              stamp: mystery.aiGenerated ? 'قضية مولّدة' : 'قضية رقم ${state.roundNumber}',
              padding: const EdgeInsets.fromLTRB(20, 46, 20, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    mystery.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 27,
                      fontWeight: FontWeight.w900,
                      color: AppColors.ink,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(height: 1.2, color: AppColors.manilaDark),
                  const SizedBox(height: 14),
                  Text(
                    mystery.description,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 18,
                      color: AppColors.ink,
                      height: 1.9,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SlatePanel(
              borderColor: AppColors.brassDim,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.visibility_off_rounded,
                          color: AppColors.brass),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'الأدلة الثلاثة — للشاهد الصامت وحده',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    state.witness == null
                        ? ''
                        : 'مرّر الجهاز إلى ${state.witness!.name} فقط.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  if (_cluesVisible)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ...mystery.clues.asMap().entries.map(
                              (entry) => _Clue(
                                number: entry.key + 1,
                                text: entry.value,
                              ),
                            ),
                        const SizedBox(height: 6),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.lock_rounded),
                          label: const Text('أخفِ الأدلة'),
                          onPressed: () => setState(() => _cluesVisible = false),
                        ),
                      ],
                    )
                  else
                    Center(
                      child: HoldToReveal(
                        label: 'الشاهد الصامت فقط',
                        hint: 'اضغط واستمر لعرض الأدلة',
                        onRevealed: () => setState(() => _cluesVisible = true),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}

class _Clue extends StatelessWidget {
  const _Clue({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.brass.withValues(alpha: 0.16),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.brassDim),
            ),
            child: Text(
              '$number',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                color: AppColors.brass,
                fontWeight: FontWeight.w900,
                fontSize: 15,
                height: 1.3,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyLarge),
          ),
        ],
      ),
    );
  }
}
