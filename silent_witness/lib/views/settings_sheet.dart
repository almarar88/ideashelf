import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';
import '../core/providers.dart';
import '../data/gemini_service.dart';

/// Sound switch plus the optional Gemini key. Kept in one small sheet so the
/// main flow stays free of settings.
Future<void> showSettingsSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.slate,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => const _SettingsSheet(),
  );
}

class _SettingsSheet extends ConsumerStatefulWidget {
  const _SettingsSheet();

  @override
  ConsumerState<_SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends ConsumerState<_SettingsSheet> {
  late final TextEditingController _keyController = TextEditingController(
    text: ref.read(sharedPreferencesProvider).getString(PrefKeys.geminiKey) ?? '',
  );
  bool _obscure = true;

  @override
  void dispose() {
    _keyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(gameControllerProvider);
    final controller = ref.read(gameControllerProvider.notifier);
    final buildKeySet = GeminiService.buildTimeKey.isNotEmpty;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        0,
        22,
        MediaQuery.viewInsetsOf(context).bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'الإعدادات',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: 16),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppColors.brass,
            value: state.settings.soundEnabled,
            onChanged: controller.setSoundEnabled,
            title: Text('المؤثرات الصوتية',
                style: Theme.of(context).textTheme.titleMedium),
            subtitle: Text(
              'دقات الساعة، مطرقة الحكم، وإعلان النتيجة',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          const Divider(),
          Text('مفتاح Gemini (اختياري)',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            buildKeySet
                ? 'يوجد مفتاح مضمّن وقت البناء. أي مفتاح تكتبه هنا سيُستخدم بدلاً منه.'
                : 'اللعبة تعمل بالكامل بدون مفتاح باستخدام ٥٤ قضية مخزّنة داخل التطبيق. '
                    'أضف مفتاحاً فقط إن أردت قضايا وحجج غياب مولّدة لحظياً.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _keyController,
            obscureText: _obscure,
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              hintText: 'AIza…',
              suffixIcon: IconButton(
                icon: Icon(
                  _obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                  color: AppColors.graphite,
                ),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: () async {
              await controller.setGeminiKey(_keyController.text);
              if (!context.mounted) return;
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('تم حفظ الإعدادات')),
              );
            },
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
  }
}
