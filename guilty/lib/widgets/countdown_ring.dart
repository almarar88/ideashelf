import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/app_theme.dart';

/// The interrogation clock: a brass ring that empties, turning crimson in the
/// final minute and pulsing over the last ten seconds.
class CountdownRing extends StatelessWidget {
  const CountdownRing({
    super.key,
    required this.secondsLeft,
    required this.fraction,
    required this.running,
    this.size = 230,
  });

  final int secondsLeft;
  final double fraction;
  final bool running;
  final double size;

  static String format(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final urgent = secondsLeft <= 60;
    final critical = secondsLeft <= 10;
    final color = critical
        ? AppColors.crimsonLight
        : urgent
            ? AppColors.crimson
            : AppColors.brass;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size.square(size),
            painter: _RingPainter(fraction: fraction, color: color),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 250),
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: critical ? 62 : 54,
                  fontWeight: FontWeight.w900,
                  color: color,
                  height: 1.2,
                ),
                child: Text(format(secondsLeft)),
              ),
              const SizedBox(height: 2),
              Text(
                running ? 'التحقيق جارٍ' : 'التحقيق متوقف',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = size.width / 2 - 12;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = AppColors.slate;
    canvas.drawCircle(center, radius, track);

    final hairline = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = AppColors.graphite;
    canvas.drawCircle(center, radius - 11, hairline);

    if (fraction > 0) {
      final arc = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          startAngle: -math.pi / 2,
          endAngle: 3 * math.pi / 2,
          colors: [color.withValues(alpha: 0.55), color],
        ).createShader(Rect.fromCircle(center: center, radius: radius));

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2,
        -2 * math.pi * fraction,
        false,
        arc,
      );
    }

    // Minute ticks around the dial.
    final tick = Paint()
      ..color = AppColors.brassDim
      ..strokeWidth = 2;
    for (var i = 0; i < 12; i++) {
      final angle = -math.pi / 2 + i * math.pi / 6;
      final outer = center + Offset(math.cos(angle), math.sin(angle)) * (radius + 9);
      final inner = center + Offset(math.cos(angle), math.sin(angle)) * (radius + 4);
      canvas.drawLine(inner, outer, tick);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.color != color;
}
