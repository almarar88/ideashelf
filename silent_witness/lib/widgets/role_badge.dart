import 'package:flutter/material.dart';

import '../core/app_theme.dart';
import '../models/game_role.dart';

/// The big card a player sees when their fingerprint unlocks their role.
class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role, this.extraLine});

  final GameRole role;

  /// Used to tell the Silent Witness who the culprit is.
  final String? extraLine;

  @override
  Widget build(BuildContext context) {
    final color = role.color;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
      decoration: BoxDecoration(
        color: AppColors.slate,
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: color, width: 2),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.22), blurRadius: 26, spreadRadius: 1),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 92,
            height: 92,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.14),
              border: Border.all(color: color, width: 1.6),
            ),
            child: Icon(role.icon, size: 46, color: color),
          ),
          const SizedBox(height: 18),
          Text(
            role.title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              color: color,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            role.brief,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if (extraLine != null) ...[
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.crimson.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(AppSizes.radiusSmall),
                border: Border.all(color: AppColors.crimson),
              ),
              child: Text(
                extraLine!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                  color: AppColors.crimsonLight,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
