import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../models/game_state.dart';
import '../widgets/abandon_round_guard.dart';
import '../widgets/case_file_scaffold.dart';
import '../widgets/countdown_ring.dart';
import 'verdict_screen.dart';

/// The three-minute interrogation: the clock, the detective's question card,
/// the witness's silent hint cards, and the culprit's AI defence lawyer.
class InvestigationScreen extends ConsumerStatefulWidget {
  const InvestigationScreen({super.key});

  @override
  ConsumerState<InvestigationScreen> createState() =>
      _InvestigationScreenState();
}

class _InvestigationScreenState extends ConsumerState<InvestigationScreen> {
  int _questionIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final mystery = state.mysteryCase;

    // The controller flips to the verdict phase when the clock hits zero.
    ref.listen<GamePhase>(
      gameControllerProvider.select((s) => s.phase),
      (previous, next) {
        if (next == GamePhase.verdict && ModalRoute.of(context)?.isCurrent == true) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute<void>(builder: (_) => const VerdictScreen()),
          );
        }
      },
    );

    return AbandonRoundGuard(
      child: CaseFileScaffold(
        title: mystery?.title ?? 'التحقيق',
        subtitle: 'استجواب مفتوح — الجميع تحت الشبهة',
        leading: IconButton(
          tooltip: state.timerRunning ? 'إيقاف مؤقت' : 'استئناف',
          icon: Icon(
            state.timerRunning
                ? Icons.pause_circle_outline_rounded
                : Icons.play_circle_outline_rounded,
          ),
          onPressed: controller.toggleTimer,
        ),
        actions: [
          IconButton(
            tooltip: 'أضف ٣٠ ثانية',
            icon: const Icon(Icons.more_time_rounded),
            onPressed: () => controller.addSeconds(30),
          ),
        ],
        bottom: ElevatedButton.icon(
          icon: const Icon(Icons.gavel_rounded, size: 26),
          label: const Text('انتقل إلى الحكم'),
          // Navigation is handled by the phase listener above, so an early
          // hand-over and a clock that runs out take exactly the same path.
          onPressed: controller.openVerdict,
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            6,
            AppSizes.gutter,
            8,
          ),
          children: [
            Center(
              child: CountdownRing(
                secondsLeft: state.secondsLeft,
                fraction: state.timeFraction,
                running: state.timerRunning,
              ),
            ),
            const SizedBox(height: 14),
            _WitnessQuestionsPanel(
              questionsLeft: state.questionsLeft,
              onUse: controller.useWitnessQuestion,
              onReset: controller.resetWitnessQuestions,
            ),
            const SizedBox(height: 14),
            if (mystery != null && mystery.questions.isNotEmpty)
              _QuestionCard(
                question: mystery.questions[_questionIndex % mystery.questions.length],
                onNext: () {
                  ref.read(audioServiceProvider).click();
                  setState(() => _questionIndex++);
                },
              ),
            const SizedBox(height: 14),
            const _SilentCardsPanel(),
            const SizedBox(height: 14),
            _LawyerPanel(
              alibi: state.aiAlibi,
              loading: state.alibiLoading,
              onRequest: controller.requestAlibi,
              onClear: controller.clearAlibi,
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _WitnessQuestionsPanel extends StatelessWidget {
  const _WitnessQuestionsPanel({
    required this.questionsLeft,
    required this.onUse,
    required this.onReset,
  });

  final int questionsLeft;
  final VoidCallback onUse;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final used = GameState.maxWitnessQuestions - questionsLeft;
    return SlatePanel(
      borderColor: questionsLeft == 0 ? AppColors.crimson : AppColors.graphite,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'أسئلة المحقق للشاهد الصامت',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              IconButton(
                tooltip: 'إعادة العدّاد',
                icon: const Icon(Icons.refresh_rounded, size: 20),
                color: AppColors.graphite,
                onPressed: onReset,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              GameState.maxWitnessQuestions,
              (i) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7),
                child: Icon(
                  i < used
                      ? Icons.help_outline_rounded
                      : Icons.help_center_rounded,
                  size: 40,
                  color: i < used ? AppColors.graphite : AppColors.brass,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            questionsLeft == 0
                ? 'انتهت الأسئلة. الشاهد لا يجيب بعد الآن.'
                : 'متبقٍ $questionsLeft من ${GameState.maxWitnessQuestions} — الجواب بهز الرأس فقط.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            icon: const Icon(Icons.record_voice_over_rounded),
            label: Text(questionsLeft == 0 ? 'لا مزيد من الأسئلة' : 'سألت سؤالاً'),
            onPressed: questionsLeft == 0 ? null : onUse,
          ),
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question, required this.onNext});

  final String question;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return PaperCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.quiz_rounded, color: AppColors.ink, size: 22),
              const SizedBox(width: 8),
              Text(
                'بطاقة أسئلة ذكية',
                style: const TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: AppColors.ink,
                  height: 1.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            question,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
              height: 1.8,
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: AppColors.crimson),
              icon: const Icon(Icons.autorenew_rounded, size: 20),
              label: const Text('سؤال آخر'),
              onPressed: onNext,
            ),
          ),
        ],
      ),
    );
  }
}

/// The cards the Silent Witness may hold up instead of speaking.
class _SilentCardsPanel extends ConsumerStatefulWidget {
  const _SilentCardsPanel();

  @override
  ConsumerState<_SilentCardsPanel> createState() => _SilentCardsPanelState();
}

class _SilentCardsPanelState extends ConsumerState<_SilentCardsPanel> {
  String? _shown;

  @override
  Widget build(BuildContext context) {
    final cards = ref.watch(caseRepositoryProvider).silentCards;

    return SlatePanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'بطاقات الشاهد الصامت',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'اختر بطاقة واعرضها على المحقق بدل الكلام.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          if (_shown != null) ...[
            GestureDetector(
              onTap: () => setState(() => _shown = null),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.manila,
                  borderRadius: BorderRadius.circular(AppSizes.radius),
                  border: Border.all(color: AppColors.brass, width: 2),
                ),
                child: Text(
                  _shown!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: AppColors.ink,
                    height: 1.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'اضغط البطاقة لإخفائها.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ] else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: cards
                  .map(
                    (card) => ActionChip(
                      label: Text(card),
                      backgroundColor: AppColors.midnight,
                      side: const BorderSide(color: AppColors.graphite),
                      labelStyle: const TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 16,
                        color: AppColors.manila,
                        height: 1.5,
                      ),
                      onPressed: () {
                        ref.read(audioServiceProvider).click();
                        setState(() => _shown = card);
                      },
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }
}

class _LawyerPanel extends StatelessWidget {
  const _LawyerPanel({
    required this.alibi,
    required this.loading,
    required this.onRequest,
    required this.onClear,
  });

  final String? alibi;
  final bool loading;
  final Future<void> Function() onRequest;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return SlatePanel(
      borderColor: AppColors.crimson,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.balance_rounded, color: AppColors.crimsonLight),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'المحامي الآلي — للجاني فقط',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'ارتبكت؟ اسحب الجهاز بهدوء واطلب حجة غياب.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          if (alibi != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.crimson.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
                border: Border.all(color: AppColors.crimson),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(alibi!, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 8),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: TextButton(
                      onPressed: onClear,
                      child: const Text('حفظتها — أخفِ'),
                    ),
                  ),
                ],
              ),
            ),
          if (alibi != null) const SizedBox(height: 10),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.crimsonLight,
              side: const BorderSide(color: AppColors.crimson, width: 1.5),
            ),
            icon: loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: AppColors.crimsonLight,
                    ),
                  )
                : const Icon(Icons.shield_rounded),
            label: Text(loading ? 'المحامي يفكّر…' : 'استشارة المحامي'),
            onPressed: loading ? null : () => onRequest(),
          ),
        ],
      ),
    );
  }
}
