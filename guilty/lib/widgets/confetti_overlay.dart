import 'dart:math';

import 'package:flutter/material.dart';

import '../core/app_theme.dart';

/// A dependency-free confetti burst for a correct verdict.
class ConfettiOverlay extends StatefulWidget {
  const ConfettiOverlay({super.key, this.pieces = 90});

  final int pieces;

  @override
  State<ConfettiOverlay> createState() => _ConfettiOverlayState();
}

class _ConfettiOverlayState extends State<ConfettiOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  )..forward();

  late final List<_Piece> _confetti = _build(widget.pieces);

  static const List<Color> _palette = [
    AppColors.brass,
    AppColors.manila,
    AppColors.crimsonLight,
    AppColors.verdict,
    Color(0xFFF5E6A8),
  ];

  static List<_Piece> _build(int count) {
    final random = Random();
    return List<_Piece>.generate(
      count,
      (i) => _Piece(
        x: random.nextDouble(),
        delay: random.nextDouble() * 0.35,
        speed: 0.65 + random.nextDouble() * 0.6,
        drift: (random.nextDouble() - 0.5) * 0.45,
        spin: (random.nextDouble() - 0.5) * 12,
        width: 6 + random.nextDouble() * 7,
        height: 9 + random.nextDouble() * 12,
        color: _palette[random.nextInt(_palette.length)],
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          size: Size.infinite,
          painter: _ConfettiPainter(_confetti, _controller.value),
        ),
      ),
    );
  }
}

class _Piece {
  const _Piece({
    required this.x,
    required this.delay,
    required this.speed,
    required this.drift,
    required this.spin,
    required this.width,
    required this.height,
    required this.color,
  });

  final double x;
  final double delay;
  final double speed;
  final double drift;
  final double spin;
  final double width;
  final double height;
  final Color color;
}

class _ConfettiPainter extends CustomPainter {
  const _ConfettiPainter(this.pieces, this.t);

  final List<_Piece> pieces;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (final piece in pieces) {
      final local = ((t - piece.delay) / (1 - piece.delay)).clamp(0.0, 1.0);
      if (local <= 0) continue;

      final progress = local * piece.speed;
      final dy = -0.15 * size.height + progress * size.height * 1.35;
      if (dy > size.height + 40) continue;

      final dx = (piece.x + piece.drift * sin(progress * pi * 2)) * size.width;
      final opacity = local < 0.85 ? 1.0 : (1 - (local - 0.85) / 0.15);

      paint.color = piece.color.withValues(alpha: opacity.clamp(0.0, 1.0));

      canvas.save();
      canvas.translate(dx, dy);
      canvas.rotate(progress * piece.spin);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset.zero,
            width: piece.width,
            height: piece.height,
          ),
          const Radius.circular(2),
        ),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}
