import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart' show rootBundle;

import '../models/mystery_case.dart';

/// The offline case pack shipped inside the APK.
///
/// The game is fully playable from this file alone — no API key, no network.
class CaseRepository {
  CaseRepository._({
    required this.categories,
    required this.cases,
    required this.alibis,
    required this.silentCards,
  });

  static const String assetPath = 'assets/cases.json';

  static Future<CaseRepository> load() async {
    final raw = await rootBundle.loadString(assetPath);
    final json = jsonDecode(raw) as Map<String, dynamic>;

    final categories = (json['categories'] as List<dynamic>? ?? const [])
        .map((e) => CaseCategory.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);

    final cases = (json['cases'] as List<dynamic>? ?? const [])
        .map((e) => MysteryCase.fromJson(e as Map<String, dynamic>))
        .where((c) => c.isUsable)
        .toList(growable: false);

    final alibis = (json['alibis'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList(growable: false);

    final silentCards = (json['silentCards'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList(growable: false);

    return CaseRepository._(
      categories: categories,
      cases: cases,
      alibis: alibis,
      silentCards: silentCards,
    );
  }

  final List<CaseCategory> categories;
  final List<MysteryCase> cases;
  final List<String> alibis;
  final List<String> silentCards;

  final Random _random = Random();

  /// Case ids already played this session, so families do not see repeats
  /// until the whole category has been used up.
  final Set<String> _served = <String>{};

  CaseCategory categoryById(String id) => categories.firstWhere(
        (c) => c.id == id,
        orElse: () => categories.isNotEmpty
            ? categories.first
            : const CaseCategory(id: 'general', name: 'قضايا متنوعة', emoji: '🗂️'),
      );

  /// Draws a case from [categoryId], avoiding anything already played until
  /// the pool runs dry.
  MysteryCase randomCase(String categoryId) {
    final pool = cases.where((c) => c.category == categoryId).toList();
    final fallback = pool.isEmpty ? cases.toList() : pool;
    if (fallback.isEmpty) {
      return const MysteryCase(
        id: 'empty',
        category: 'general',
        title: 'قضية غامضة',
        description: 'حدث شيء غريب في البيت، ولا أحد يعترف.',
        clues: ['لا توجد أدلة واضحة.'],
        questions: ['أين كنت؟'],
      );
    }

    final unseen = fallback.where((c) => !_served.contains(c.id)).toList();
    final source = unseen.isNotEmpty ? unseen : fallback;
    if (unseen.isEmpty) {
      _served.removeWhere((id) => fallback.any((c) => c.id == id));
    }

    final picked = source[_random.nextInt(source.length)];
    _served.add(picked.id);
    return picked;
  }

  /// Offline stand-in for the AI defence lawyer.
  String randomAlibi() {
    if (alibis.isEmpty) return 'كنت في مكان آخر تماماً، وهذا كل ما سأقوله.';
    return alibis[_random.nextInt(alibis.length)];
  }
}
