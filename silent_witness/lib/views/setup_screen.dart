import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../models/game_settings.dart';
import '../widgets/case_file_scaffold.dart';
import 'role_reveal_screen.dart';

class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  bool _starting = false;
  bool _editingNames = false;

  static const List<int> _durations = [120, 180, 300];

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final repository = ref.watch(caseRepositoryProvider);
    final settings = state.settings;
    final aiReady = ref.watch(geminiServiceProvider).isConfigured;

    return CaseFileScaffold(
      title: 'ملف القضية',
      subtitle: 'جهّز الجلسة قبل فتح التحقيق',
      leading: IconButton(
        icon: const Icon(Icons.arrow_forward_rounded),
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      bottom: ElevatedButton.icon(
        icon: _starting
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: AppColors.midnight,
                ),
              )
            : const Icon(Icons.fingerprint_rounded, size: 26),
        label: Text(_starting ? 'جارٍ تجهيز القضية…' : 'وزّع الأدوار'),
        onPressed: _starting ? null : () => _start(controller),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          14,
          AppSizes.gutter,
          10,
        ),
        children: [
          _Section(
            title: 'عدد اللاعبين',
            trailing: Text(
              '${settings.playerCount}',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 30,
                fontWeight: FontWeight.w900,
                color: AppColors.brass,
                height: 1.2,
              ),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    _RoundIconButton(
                      icon: Icons.remove_rounded,
                      enabled: settings.playerCount > GameSettings.minPlayers,
                      onPressed: () =>
                          controller.setPlayerCount(settings.playerCount - 1),
                    ),
                    Expanded(
                      child: SliderTheme(
                        data: SliderThemeData(
                          activeTrackColor: AppColors.brass,
                          inactiveTrackColor: AppColors.graphite,
                          thumbColor: AppColors.brass,
                          overlayColor: AppColors.brass.withValues(alpha: 0.14),
                          valueIndicatorColor: AppColors.brass,
                        ),
                        child: Slider(
                          min: GameSettings.minPlayers.toDouble(),
                          max: GameSettings.maxPlayers.toDouble(),
                          divisions:
                              GameSettings.maxPlayers - GameSettings.minPlayers,
                          value: settings.playerCount.toDouble(),
                          onChanged: (v) => controller.setPlayerCount(v.round()),
                        ),
                      ),
                    ),
                    _RoundIconButton(
                      icon: Icons.add_rounded,
                      enabled: settings.playerCount < GameSettings.maxPlayers,
                      onPressed: () =>
                          controller.setPlayerCount(settings.playerCount + 1),
                    ),
                  ],
                ),
                Text(
                  'محقق واحد + شاهد صامت + جانٍ'
                  '${settings.playerCount > 3 ? ' + ${settings.playerCount - 3} مشتبه بهم' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          _Section(
            title: 'أسماء اللاعبين',
            trailing: TextButton(
              onPressed: () => setState(() => _editingNames = !_editingNames),
              child: Text(_editingNames ? 'إخفاء' : 'تعديل'),
            ),
            child: _editingNames
                ? Column(
                    children: List.generate(
                      settings.playerCount,
                      (i) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: TextField(
                          textInputAction: i == settings.playerCount - 1
                              ? TextInputAction.done
                              : TextInputAction.next,
                          decoration: InputDecoration(hintText: settings.nameFor(i)),
                          onChanged: (value) => controller.setPlayerName(i, value),
                        ),
                      ),
                    ),
                  )
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: List.generate(
                      settings.playerCount,
                      (i) => Chip(
                        label: Text(settings.nameFor(i)),
                        backgroundColor: AppColors.midnight,
                        side: const BorderSide(color: AppColors.graphite),
                        labelStyle: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ),
          ),
          _Section(
            title: 'نوع القضية',
            child: Column(
              children: repository.categories
                  .map(
                    (category) => _CategoryTile(
                      emoji: category.emoji,
                      name: category.name,
                      selected: category.id == settings.categoryId,
                      onTap: () {
                        ref.read(audioServiceProvider).click();
                        controller.setCategory(category.id);
                      },
                    ),
                  )
                  .toList(),
            ),
          ),
          _Section(
            title: 'مدة التحقيق',
            child: Row(
              children: _durations
                  .map(
                    (seconds) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: _DurationChip(
                          seconds: seconds,
                          selected: settings.roundSeconds == seconds,
                          onTap: () => controller.setRoundSeconds(seconds),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          _Section(
            title: 'الذكاء الاصطناعي',
            child: SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: AppColors.brass,
              value: settings.useAi && aiReady,
              onChanged: aiReady ? controller.setUseAi : null,
              title: Text(
                'قضية مولّدة لحظياً',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              subtitle: Text(
                aiReady
                    ? 'سيكتب Gemini قضية جديدة تماماً لهذه الجولة.'
                    : 'أضف مفتاح Gemini من الإعدادات لتفعيل هذا الخيار. '
                        'اللعبة تعمل بدونه بـ ٥٤ قضية جاهزة.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Future<void> _start(GameController controller) async {
    setState(() => _starting = true);
    ref.read(audioServiceProvider).click();
    await controller.startRound();
    if (!mounted) return;
    setState(() => _starting = false);

    final error = ref.read(gameControllerProvider).errorMessage;
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      controller.clearError();
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const RoleRevealScreen()),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: SlatePanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.onPressed,
    this.enabled = true,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return IconButton.filled(
      onPressed: enabled ? onPressed : null,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        backgroundColor: AppColors.midnight,
        foregroundColor: enabled ? AppColors.brass : AppColors.graphite,
        side: BorderSide(
          color: enabled ? AppColors.brassDim : AppColors.graphite,
        ),
        minimumSize: const Size(48, 48),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.emoji,
    required this.name,
    required this.selected,
    required this.onTap,
  });

  final String emoji;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.brass.withValues(alpha: 0.12)
                : AppColors.midnight,
            borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
            border: Border.all(
              color: selected ? AppColors.brass : AppColors.graphite,
              width: selected ? 1.8 : 1,
            ),
          ),
          child: Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 26)),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    color: selected ? AppColors.brass : AppColors.manila,
                    height: 1.5,
                  ),
                ),
              ),
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected ? AppColors.brass : AppColors.graphite,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DurationChip extends StatelessWidget {
  const _DurationChip({
    required this.seconds,
    required this.selected,
    required this.onTap,
  });

  final int seconds;
  final bool selected;
  final VoidCallback onTap;

  static String _label(int seconds) {
    final minutes = seconds ~/ 60;
    return switch (minutes) {
      1 => 'دقيقة',
      2 => 'دقيقتان',
      _ => '$minutes دقائق',
    };
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? AppColors.brass.withValues(alpha: 0.12)
              : AppColors.midnight,
          borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
          border: Border.all(
            color: selected ? AppColors.brass : AppColors.graphite,
            width: selected ? 1.8 : 1,
          ),
        ),
        child: Text(
          _label(seconds),
          style: TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: selected ? AppColors.brass : AppColors.manila,
            height: 1.5,
          ),
        ),
      ),
    );
  }
}
