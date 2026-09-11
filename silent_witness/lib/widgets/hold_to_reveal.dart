import 'package:flutter/material.dart';

import '../core/app_theme.dart';

/// A fingerprint pad the player must press and hold before a secret is shown.
///
/// Holding — rather than tapping — is deliberate: it stops a curious cousin
/// from flipping somebody else's role card by accident.
class HoldToReveal extends StatefulWidget {
  const HoldToReveal({
    super.key,
    required this.label,
    required this.onRevealed,
    this.holdDuration = const Duration(milliseconds: 1100),
    this.hint,
  });

  final String label;
  final String? hint;
  final Duration holdDuration;
  final VoidCallback onRevealed;

  @override
  State<HoldToReveal> createState() => _HoldToRevealState();
}

class _HoldToRevealState extends State<HoldToReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.holdDuration,
  )..addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onRevealed();
        _controller.value = 0;
      }
    });

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _start(_) => _controller.forward();

  void _cancel([_]) => _controller.reverse();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _start,
      onTapUp: _cancel,
      onTapCancel: _cancel,
      onLongPressStart: _start,
      onLongPressEnd: _cancel,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final t = _controller.value;
              return SizedBox(
                width: 168,
                height: 168,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color.lerp(
                          AppColors.slate,
                          AppColors.brassDim,
                          t * 0.7,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brass.withValues(alpha: 0.35 * t),
                            blurRadius: 28 * t,
                            spreadRadius: 4 * t,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 160,
                      height: 160,
                      child: CircularProgressIndicator(
                        value: t,
                        strokeWidth: 5,
                        backgroundColor: AppColors.graphite,
                        valueColor: const AlwaysStoppedAnimation(AppColors.brass),
                      ),
                    ),
                    Icon(
                      Icons.fingerprint_rounded,
                      size: 84,
                      color: Color.lerp(AppColors.brassDim, AppColors.manila, t),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 22),
          Text(
            widget.label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (widget.hint != null) ...[
            const SizedBox(height: 6),
            Text(
              widget.hint!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}
