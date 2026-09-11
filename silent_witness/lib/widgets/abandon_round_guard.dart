import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/game_controller.dart';
import '../core/app_theme.dart';

/// Wraps a mid-round screen so the Android back gesture asks before throwing
/// the round away, instead of doing nothing at all.
class AbandonRoundGuard extends ConsumerWidget {
  const AbandonRoundGuard({
    super.key,
    required this.child,
    this.confirm = true,
  });

  final Widget child;

  /// Set to false once the round is over — there is nothing left to lose, so
  /// back simply returns home.
  final bool confirm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        if (confirm && !await _confirm(context)) return;
        ref.read(gameControllerProvider.notifier).backToHome();
        navigator.popUntil((route) => route.isFirst);
      },
      child: child,
    );
  }

  Future<bool> _confirm(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('إنهاء الجولة؟',
            style: Theme.of(context).textTheme.titleLarge),
        content: Text(
          'ستُلغى القضية الحالية وتعود إلى الشاشة الرئيسية. النتيجة المسجلة تبقى كما هي.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('أكمل اللعب'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.crimsonLight),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('إنهاء'),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
