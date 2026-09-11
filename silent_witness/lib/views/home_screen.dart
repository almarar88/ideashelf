import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../widgets/case_file_scaffold.dart';
import 'settings_sheet.dart';
import 'setup_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);

    return CaseFileScaffold(
      actions: [
        IconButton(
          tooltip: 'الإعدادات',
          icon: const Icon(Icons.settings_rounded),
          onPressed: () => showSettingsSheet(context, ref),
        ),
      ],
      leading: IconButton(
        tooltip: state.settings.soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت',
        icon: Icon(
          state.settings.soundEnabled
              ? Icons.volume_up_rounded
              : Icons.volume_off_rounded,
        ),
        onPressed: () => controller.setSoundEnabled(!state.settings.soundEnabled),
      ),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ElevatedButton.icon(
            icon: const Icon(Icons.folder_open_rounded, size: 26),
            label: const Text('افتح قضية جديدة'),
            onPressed: () {
              ref.read(audioServiceProvider).click();
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const SetupScreen()),
              );
            },
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            icon: const Icon(Icons.menu_book_rounded),
            label: const Text('كيف نلعب؟'),
            onPressed: () => _showRules(context),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          10,
          AppSizes.gutter,
          10,
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            const _Emblem(),
            const SizedBox(height: 22),
            Text(
              'الشاهد الصامت',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayLarge,
            ),
            const SizedBox(height: 4),
            Text(
              'لعبة غموض عائلية في ثلاث دقائق',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 26),
            const PaperCard(
              stamp: 'سري للغاية',
              padding: EdgeInsets.fromLTRB(20, 44, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Rule(
                    icon: Icons.search_rounded,
                    title: 'محقّق واحد',
                    body: 'يسأل، يستجوب، ثم يسمّي الجاني قبل انتهاء الوقت.',
                  ),
                  _Rule(
                    icon: Icons.visibility_off_rounded,
                    title: 'شاهد صامت',
                    body: 'يعرف كل شيء، ولا يملك سوى: نعم، لا، لا أعلم.',
                  ),
                  _Rule(
                    icon: Icons.local_fire_department_rounded,
                    title: 'جانٍ مختبئ',
                    body: 'يتظاهر بالبراءة، ومعه محامٍ ذكي عند الحاجة.',
                  ),
                  _Rule(
                    icon: Icons.groups_rounded,
                    title: 'لا أحد يخرج',
                    body: 'كل اللاعبين يبقون في الجولة من أولها لآخرها.',
                    last: true,
                  ),
                ],
              ),
            ),
            if (state.roundNumber > 0) ...[
              const SizedBox(height: 18),
              _ScoreBoard(
                detectiveWins: state.detectiveWins,
                culpritWins: state.culpritWins,
                onReset: controller.resetScores,
              ),
            ],
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showRules(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.slate,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        maxChildSize: 0.92,
        builder: (context, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(22, 0, 22, 32),
          children: [
            Text(
              'كيف نلعب؟',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium,
            ),
            const SizedBox(height: 18),
            ..._steps.asMap().entries.map(
                  (entry) => _Step(number: entry.key + 1, text: entry.value),
                ),
            const SizedBox(height: 12),
            const Divider(),
            Text(
              'نصيحة: الشاهد الصامت هو روح اللعبة. امنعوه من الكلام تماماً، '
              'واتركوه يجيب بهز رأسه أو ببطاقات التلميح داخل التطبيق.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }

  static const List<String> _steps = [
    'اختاروا عدد اللاعبين (من ٣ إلى ١٠) ونوع القضية، ثم افتحوا الملف.',
    'مرّروا الجهاز واحداً تلو الآخر. كل لاعب يضع إصبعه على البصمة ليرى دوره سراً.',
    'اقرأوا تفاصيل القضية بصوت عالٍ. الأدلة الثلاثة يراها الشاهد الصامت وحده.',
    'يبدأ المؤقت. للمحقق ٣ أسئلة فقط للشاهد الصامت، وبقية الوقت لاستجواب الجميع.',
    'إن ارتبك الجاني فليضغط «استشارة المحامي» ليحصل على حجة غياب جاهزة.',
    'قبل انتهاء الوقت يختار المحقق المتهم. أصاب: يفوز مع الشاهد. أخطأ: يفلت الجاني.',
  ];
}

class _Emblem extends StatelessWidget {
  const _Emblem();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 130,
      height: 130,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.slate,
        border: Border.all(color: AppColors.brass, width: 2),
        boxShadow: const [
          BoxShadow(color: Color(0x55D4AF37), blurRadius: 34, spreadRadius: 2),
        ],
      ),
      child: const Stack(
        alignment: Alignment.center,
        children: [
          Icon(Icons.visibility_off_rounded, size: 62, color: AppColors.brass),
        ],
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule({
    required this.icon,
    required this.title,
    required this.body,
    this.last = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.midnight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.brass, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: AppColors.ink,
                    height: 1.5,
                  ),
                ),
                Text(
                  body,
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 16,
                    color: AppColors.inkFaded,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.brass, width: 1.4),
            ),
            child: Text(
              '$number',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                color: AppColors.brass,
                fontWeight: FontWeight.w900,
                fontSize: 16,
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

class _ScoreBoard extends StatelessWidget {
  const _ScoreBoard({
    required this.detectiveWins,
    required this.culpritWins,
    required this.onReset,
  });

  final int detectiveWins;
  final int culpritWins;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return SlatePanel(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _Score(
                  label: 'فوز المحققين',
                  value: detectiveWins,
                  color: AppColors.brass,
                ),
              ),
              Container(width: 1, height: 46, color: AppColors.graphite),
              Expanded(
                child: _Score(
                  label: 'فوز الجناة',
                  value: culpritWins,
                  color: AppColors.crimsonLight,
                ),
              ),
            ],
          ),
          TextButton(onPressed: onReset, child: const Text('تصفير النتيجة')),
        ],
      ),
    );
  }
}

class _Score extends StatelessWidget {
  const _Score({required this.label, required this.value, required this.color});

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
            fontSize: 34,
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
