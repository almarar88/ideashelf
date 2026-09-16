# مكتبة الكود الرقمية

مكتبة إلكترونية مدعومة بالذكاء الاصطناعي: ارفع كتبك بصيغة PDF، اقرأها، ثم لخّصها وحلّلها واسألها بالذكاء الاصطناعي (Claude). تعمل كتطبيق ويب (PWA) وكتطبيق أندرويد (APK) مع دعم الأجهزة القابلة للطي.

## المزايا

- **قارئ PDF** مدمج (pdf.js) مع حفظ موضع القراءة وقرص تقدّم مستوحى من التصميم المرجعي.
- **ذكاء اصطناعي** على مستوى الصفحة، أو نطاق صفحات، أو الكتاب كاملاً: تلخيص، تحليل عميق، شرح مبسط، اختبار، ومحادثة مع الكتاب مع ذكر أرقام الصفحات. الكتب الطويلة جدًا تُعالج على مراحل (map-reduce).
- **تخزين محلي كامل** (IndexedDB): الكتب، النص المستخرج، النتائج، والمحادثات تبقى على الجهاز وتعمل بلا إنترنت.
- **تحليل القراءة**: دقائق القراءة أسبوعيًا/شهريًا واستخدام كل كتاب.
- **لوحة تحكم المشرف** (محمية برمز PIN): رفع كتب بالجملة، تعديل/حذف الكتب، فهرس كتب عام من `public/catalog.json`، تصدير/استعادة نسخة احتياطية، مسح البيانات.
- **تصميم متجاوب**: عمود واحد على الهاتف، وعرض مزدوج (القارئ + لوحة الذكاء الاصطناعي) عند فتح الجهاز القابل للطي أو على الأجهزة اللوحية.

## مفتاح الذكاء الاصطناعي

التطبيق يعمل بدون خادم وسيط. أدخل مفتاح Anthropic API من `الإعدادات`؛ يُحفظ على جهازك فقط ويُرسل مباشرة إلى `api.anthropic.com`. النموذج الافتراضي `claude-opus-5` ويمكن اختيار Sonnet 5 أو Haiku 4.5.

## التشغيل محليًا

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # إخراج dist/ (base = ./)
npm run build:pages  # إخراج dist/ لـ GitHub Pages (base = /ideashelf/)
```

## أندرويد (APK)

المشروع مغلّف بـ Capacitor 7. متطلبات: JDK 21 + Android SDK (platform 35).

```bash
npm run apk        # build + cap sync + gradlew assembleDebug
# الناتج: android/app/build/outputs/apk/debug/app-debug.apk
```

نسخة جاهزة للتثبيت موجودة في `release/digital-code-library-debug.apk`، وعملية `Build Android APK` في GitHub Actions تبني APK عند كل دفع إلى `main` وترفقه بالإصدار عند الوسم `v*`.

**دعم الأجهزة القابلة للطي:** النشاط معلَّم `resizeableActivity="true"` ويتعامل مع تغييرات `screenSize|smallestScreenSize|screenLayout|density` دون إعادة إنشاء، والواجهة تتبدل تلقائيًا بين تخطيط الهاتف والتخطيط المزدوج عند الطي/الفتح مع الحفاظ على الحالة.

## الفهرس العام للكتب

ضع ملفات PDF في `public/library/` وأضفها إلى `public/catalog.json`:

```json
{ "books": [ { "id": "clean-code", "title": "Clean Code", "author": "Robert C. Martin", "url": "./library/clean-code.pdf", "tags": ["برمجة"] } ] }
```

بعد النشر يستطيع أي مستخدم تنزيلها من لوحة المشرف ← الفهرس العام.

## البنية

- `src/lib/db.ts` قاعدة البيانات (Dexie) · `src/lib/pdf.ts` فتح/رسم/استخراج النص · `src/lib/ai.ts` استدعاءات Claude مع البث · `src/lib/admin.ts` PIN/الفهرس/النسخ الاحتياطي
- `src/screens/` الشاشات: Home, Library, Reader, AIPanel, Insights, Settings, Admin, Onboarding
- `android/` مشروع Capacitor Android
