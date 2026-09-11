import 'package:flutter/material.dart';

import '../core/app_theme.dart';

/// The four roles handed out at the start of a round.
enum GameRole {
  /// Asks the questions and finally names a suspect.
  detective,

  /// Knows who did it but may only answer yes / no / I-don't-know.
  witness,

  /// Did it, and must survive the interrogation.
  culprit,

  /// Innocent, but under suspicion like everyone else.
  suspect;

  String get title => switch (this) {
        GameRole.detective => 'المحقق',
        GameRole.witness => 'الشاهد الصامت',
        GameRole.culprit => 'الجاني',
        GameRole.suspect => 'مشتبه به بريء',
      };

  /// One line the player reads while holding the phone, before passing it on.
  String get brief => switch (this) {
        GameRole.detective =>
          'أنت من يقود التحقيق. لديك ٣ أسئلة فقط للشاهد الصامت، ثم استجوب الجميع وسمِّ الجاني قبل انتهاء الوقت.',
        GameRole.witness =>
          'أنت رأيت كل شيء وتعرف الجاني، لكنك ممنوع من الكلام. أجب فقط بهز الرأس: نعم، لا، لا أعلم — أو اعرض بطاقة تلميح صامتة.',
        GameRole.culprit =>
          'أنت الجاني. تظاهر بالبراءة، شتّت المحقق، ولا تتناقض. إن ارتبكت استخدم زر «استشارة المحامي» سراً.',
        GameRole.suspect =>
          'أنت بريء تماماً، لكن لا أحد يصدقك. دافع عن نفسك وساعد المحقق في كشف الجاني قبل أن تُتهم أنت.',
      };

  IconData get icon => switch (this) {
        GameRole.detective => Icons.search_rounded,
        GameRole.witness => Icons.visibility_off_rounded,
        GameRole.culprit => Icons.local_fire_department_rounded,
        GameRole.suspect => Icons.person_outline_rounded,
      };

  Color get color => switch (this) {
        GameRole.detective => AppColors.brass,
        GameRole.witness => AppColors.manila,
        GameRole.culprit => AppColors.crimsonLight,
        GameRole.suspect => AppColors.graphite,
      };

  /// Roles that may be accused at the verdict screen.
  bool get isAccusable => this == GameRole.culprit || this == GameRole.suspect;
}
