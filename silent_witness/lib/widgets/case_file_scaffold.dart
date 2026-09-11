import 'package:flutter/material.dart';

import '../core/app_theme.dart';

/// The one layout every screen uses: an open case file on a midnight desk.
class CaseFileScaffold extends StatelessWidget {
  const CaseFileScaffold({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.leading,
    this.actions,
    this.bottom,
  });

  final Widget child;
  final String? title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget>? actions;

  /// Pinned to the bottom, outside the scroll area — where primary actions go.
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.65),
            radius: 1.25,
            colors: [Color(0xFF1B2436), AppColors.midnight],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              if (title != null || leading != null || actions != null)
                _Header(
                  title: title,
                  subtitle: subtitle,
                  leading: leading,
                  actions: actions,
                ),
              Expanded(child: child),
              if (bottom != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.gutter,
                    8,
                    AppSizes.gutter,
                    16,
                  ),
                  child: bottom,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({this.title, this.subtitle, this.leading, this.actions});

  final String? title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(width: 48, child: leading),
              Expanded(
                child: Column(
                  children: [
                    if (title != null)
                      Text(
                        title!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).appBarTheme.titleTextStyle,
                      ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              SizedBox(
                width: 48,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: actions ?? const [],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const _GoldRule(),
        ],
      ),
    );
  }
}

class _GoldRule extends StatelessWidget {
  const _GoldRule();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1.4,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.transparent,
            AppColors.brassDim,
            AppColors.brass,
            AppColors.brassDim,
            Colors.transparent,
          ],
        ),
      ),
    );
  }
}

/// A sheet of manila paper. Used for the case brief, clues and results.
class PaperCard extends StatelessWidget {
  const PaperCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.stamp,
    this.stampColor = AppColors.crimson,
  });

  final Widget child;
  final EdgeInsets padding;

  /// Optional red rubber stamp printed across the top corner.
  final String? stamp;
  final Color stampColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.manila,
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: AppColors.manilaDark, width: 1.5),
        boxShadow: const [
          BoxShadow(color: Color(0x66000000), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          Padding(padding: padding, child: child),
          if (stamp != null)
            Positioned(
              top: 10,
              left: 12,
              child: Transform.rotate(
                angle: -0.18,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    border: Border.all(color: stampColor, width: 2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    stamp!,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      color: stampColor,
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A dark panel that sits on the desk rather than on the paper.
class SlatePanel extends StatelessWidget {
  const SlatePanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.borderColor = AppColors.graphite,
  });

  final Widget child;
  final EdgeInsets padding;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.slate,
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: borderColor),
      ),
      child: child,
    );
  }
}
