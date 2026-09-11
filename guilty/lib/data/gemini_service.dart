import 'dart:convert';

import 'package:dio/dio.dart';

import '../models/mystery_case.dart';

/// Optional Google Gemini integration.
///
/// The game never depends on it: every call has an offline fallback in
/// [CaseRepository], and the whole service is skipped when no key is set.
///
/// A key can be supplied in two ways:
///  * at build time — `flutter build apk --release --dart-define=GEMINI_API_KEY=...`
///  * at run time — from the settings sheet inside the app.
class GeminiService {
  GeminiService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: _baseUrl,
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 25),
              headers: {'Content-Type': 'application/json'},
            ));

  static const String _baseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/';

  /// Change this one line to move to another Gemini model.
  static const String model = 'gemini-2.5-flash';

  /// Compile-time key, empty unless passed with `--dart-define`.
  static const String buildTimeKey =
      String.fromEnvironment('GEMINI_API_KEY', defaultValue: '');

  final Dio _dio;

  /// Key entered in the app; takes priority over [buildTimeKey].
  String _runtimeKey = '';

  set runtimeKey(String value) => _runtimeKey = value.trim();

  String get _key => _runtimeKey.isNotEmpty ? _runtimeKey : buildTimeKey;

  bool get isConfigured => _key.isNotEmpty;

  /// Generates a brand new case. Returns `null` on any failure so the caller
  /// can silently fall back to the offline pack.
  Future<MysteryCase?> generateCase({
    required String categoryId,
    required String categoryName,
    required int playerCount,
  }) async {
    final prompt = '''
أنت كاتب ألغاز عائلية باللهجة العربية الفصحى المبسطة.
اكتب قضية غامضة فكاهية ومناسبة تماماً لجلسة عائلية (بدون عنف أو دم أو أي محتوى مخيف).
الفئة: $categoryName.
عدد الحاضرين: $playerCount.

اكتب بصيغة JSON فقط، بدون أي شرح أو علامات تنسيق، بهذا الشكل بالضبط:
{
  "title": "عنوان قصير جذاب لا يتجاوز ٦ كلمات",
  "description": "وصف الحادثة في جملتين، طريف ومشوق",
  "clues": ["دليل أول", "دليل ثانٍ", "دليل ثالث"],
  "questions": ["سؤال استجواب ذكي", "سؤال ثانٍ", "سؤال ثالث"]
}

شروط مهمة:
- الأدلة الثلاثة يجب أن تكون عن ظروف الحادثة (الوقت، المكان، الأثر المتروك) وليس عن صفات شخص معيّن، لأن الجاني يُختار عشوائياً من الحاضرين.
- الأسئلة الثلاثة موجهة للمشتبه بهم.
- كل النص بالعربية.
''';

    final data = await _generate(prompt);
    if (data == null) return null;

    final map = _extractJsonObject(data);
    if (map == null) return null;

    final mystery = MysteryCase.fromJson(
      {
        'id': 'ai_${DateTime.now().millisecondsSinceEpoch}',
        'category': categoryId,
        ...map,
      },
      aiGenerated: true,
    );
    return mystery.isUsable ? mystery : null;
  }

  /// The "AI defence lawyer": a witty one-line alibi for the culprit.
  /// Returns `null` on failure so the offline alibi pool takes over.
  Future<String?> generateAlibi({
    required String caseTitle,
    required String caseDescription,
  }) async {
    final prompt = '''
أنت محامي دفاع بارع وخفيف الظل في لعبة عائلية.
القضية: "$caseTitle". التفاصيل: "$caseDescription".
اكتب حجة غياب واحدة فقط، بالعربية، في جملة أو جملتين كحد أقصى،
تكون مقنعة وطريفة ومهذبة ومناسبة للعائلة، ولا تتهم شخصاً بعينه.
اكتب الحجة مباشرة بدون مقدمات وبدون علامات اقتباس.
''';

    final text = await _generate(prompt);
    if (text == null) return null;
    final cleaned = text.replaceAll('"', '').replaceAll('*', '').trim();
    return cleaned.isEmpty ? null : cleaned;
  }

  Future<String?> _generate(String prompt) async {
    if (!isConfigured) return null;
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$model:generateContent',
        queryParameters: {'key': _key},
        data: {
          'contents': [
            {
              'parts': [
                {'text': prompt}
              ]
            }
          ],
          'generationConfig': {
            'temperature': 1.0,
            'maxOutputTokens': 700,
          },
        },
      );

      final candidates = response.data?['candidates'] as List<dynamic>?;
      if (candidates == null || candidates.isEmpty) return null;
      final parts = ((candidates.first as Map<String, dynamic>)['content']
          as Map<String, dynamic>?)?['parts'] as List<dynamic>?;
      if (parts == null || parts.isEmpty) return null;

      final buffer = StringBuffer();
      for (final part in parts) {
        final text = (part as Map<String, dynamic>)['text'];
        if (text is String) buffer.write(text);
      }
      final result = buffer.toString().trim();
      return result.isEmpty ? null : result;
    } on DioException {
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Pulls the first `{ ... }` block out of a reply that may be wrapped in
  /// markdown fences.
  static Map<String, dynamic>? _extractJsonObject(String raw) {
    final start = raw.indexOf('{');
    final end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      final decoded = jsonDecode(raw.substring(start, end + 1));
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }
}
