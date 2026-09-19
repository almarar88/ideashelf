# نشر مجلس (Majlis AI) على Google Play — الدليل الكامل

هذا الدليل يأخذك من الصفر إلى تطبيق منشور للجميع، بحسابات واشتراكات، بحيث تدفع أنت فاتورة الذكاء الاصطناعي **بهامش ربح محمي**.

## 0. كيف يعمل النموذج المالي (اقرأه أولاً)
- المستخدم يشترك عبر Google Play. Google تأخذ 15% (أول مليون دولار سنوياً) وأنت تستلم الباقي.
- كل باقة لها **رصيد ذكاء اصطناعي شهري بالدولار** يفرضه الخادم. لا يمكن لأي مستخدم أن يكلّفك أكثر منه مهما استخدم.
- الأرقام الافتراضية (تعدّلها في جدول `plans` في Supabase بدون تحديث التطبيق):

| الباقة | السعر | صافي بعد Google | رصيد AI أقصى | أسوأ حالة ربح | الحالة المعتادة* |
|---|---|---|---|---|---|
| مجاني | 0 | 0 | $0.60 | −$0.60 | −$0.15 |
| برو | $9.99 | $8.49 | $4.00 | +$4.49 (53%) | +$6.5 (77%) |
| ألترا | $29.99 | $25.49 | $13.00 | +$12.49 (49%) | +$19 (75%) |

\* أغلب المشتركين يستخدمون 20-40% من رصيدهم. تكلفة الرسالة الواحدة في الوضع "سريع" (Sonnet 5 مع التخزين المؤقت) ≈ 1-3 سنت، والمجلس الكامل ≈ 8-15 سنت.
- الخادم يستبدل النماذج غير المسموحة تلقائياً (مثلاً Opus ← Sonnet في باقة برو) ويمنع البحث في الإنترنت في المجاني، فالتكاليف تحت السيطرة دائماً.
- ما يبقى ثابتاً لك: Supabase (0-25$/شهر)، الخادم (5-10$/شهر)، RevenueCat (مجاني حتى 2,500$ إيراد شهري)، حساب مطوّر Google (25$ مرة واحدة).

## 1. Supabase (الحسابات وقاعدة البيانات) — 10 دقائق
1. supabase.com → New project (اختر منطقة قريبة، مثل فرانكفورت).
2. SQL Editor → الصق محتوى `server/schema.sql` → Run.
3. Authentication → Providers → Email: مفعّل. (للبداية عطّل "Confirm email" حتى لا يحتاج المستخدم تأكيد البريد.)
4. Authentication → URL Configuration → Site URL: `https://almarar88.github.io/ideashelf/app/`.
5. Settings → API: انسخ `Project URL` و`anon public` (للتطبيق) و`service_role` (للخادم فقط، سرّي).

## 2. الخادم — 10 دقائق
1. Railway.app → New Project → Deploy from GitHub → اختر `almarar88/ideashelf` → Root Directory: `server` (يكتشف Dockerfile تلقائياً).
2. Variables: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, وأضف `ADMIN_USERS=almarar707@gmail.com` (يعطيك باقة ألترا مجاناً للتجربة).
3. Settings → Networking → Generate Domain. ستحصل على رابط مثل `https://majlis-api.up.railway.app`. افتح `/health` للتأكد.

## 3. RevenueCat (الاشتراكات) — 20 دقيقة
1. revenuecat.com → New project "Majlis" → Add app → Google Play: Package `com.ideashelf.majlis`، وارفع Service Account JSON (شرح RevenueCat خطوة بخطوة داخل الصفحة).
2. Google Play Console → Monetize → Subscriptions: أنشئ اشتراكين: `majlis_pro_monthly` (9.99$) و`majlis_ultra_monthly` (29.99$)، كل واحد بخطة أساسية شهرية. أضف عرض تجربة مجانية 7 أيام إن أردت.
3. RevenueCat → Products: استورد المنتجين. Entitlements: `pro` ← مرتبط بـ majlis_pro_monthly، و`ultra` ← majlis_ultra_monthly. Offerings: default يحوي الباقتين.
4. Integrations → Webhooks: URL `https://<خادمك>/webhooks/revenuecat`، Authorization: نص عشوائي طويل (ضعه أيضاً في متغير `REVENUECAT_WEBHOOK_AUTH` بالخادم).
5. API keys → انسخ مفتاح Google Play العام (يبدأ بـ `goog_`) ومفتاح secret (للخادم: `REVENUECAT_SECRET_KEY`).

## 4. مفتاح التوقيع الخاص (مهم جداً)
المستودع يحتوي مفتاحاً عاماً للتجارب فقط. لمتجر Google أنشئ مفتاحاً خاصاً على جهازك:
```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.keystore > upload.b64     # على ويندوز: certutil -encode upload.keystore upload.b64
```
GitHub → المستودع → Settings → Secrets and variables → Actions:
- Secrets: `ANDROID_UPLOAD_KEYSTORE_B64` (محتوى upload.b64)، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS=upload`، `ANDROID_KEY_PASSWORD`.
- Variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REVENUECAT_ANDROID_KEY`.
احتفظ بنسخة من `upload.keystore` في مكان آمن؛ ضياعه يعني عدم قدرتك على تحديث التطبيق.

## 5. بناء حزمة المتجر (AAB)
- من GitHub → Actions → "Build Google Play bundle (AAB)" → Run workflow، أو ادفع وسماً `git tag v2.0.0 && git push --tags`.
- حمّل `MajlisAI.aab` من Artifacts.

## 6. Google Play Console
1. play.google.com/console → إنشاء حساب مطوّر (25$).
2. Create app → الاسم "مجلس - Majlis AI" → تطبيق → مجاني (مع مشتريات داخل التطبيق).
3. Setup → App integrity → Play App Signing: مفعّل (ارفع AAB الموقّع بمفتاح الرفع الخاص بك).
4. Store listing: الوصف والصور (لقطات من التطبيق بمقاس الهاتف، أيقونة 512×512 من `app/public/icon-512.png` مكبّرة، صورة مميزة 1024×500).
5. App content:
   - Privacy policy: `https://almarar88.github.io/ideashelf/legal/privacy.html`
   - Data safety: يجمع البريد الإلكتروني (حساب)، محتوى المستخدم يُرسل لمعالجة الذكاء الاصطناعي، الموقع/الصور/الصوت اختيارية عند التفعيل، البيانات مشفّرة أثناء النقل، يمكن طلب الحذف.
   - Account deletion URL: `https://almarar88.github.io/ideashelf/legal/delete-account.html`
   - Ads: لا. Target audience: 18+. Content rating: استبيان.
6. Monetize → Subscriptions (الخطوة 3 أعلاه) ثم Testing → Internal testing: ارفع AAB، أضف بريدك كمختبر، ثبّت وجرّب الشراء (لن تُحاسَب كمختبر مرخّص).
7. Production → Create release → Review → Rollout. المراجعة الأولى عادة 1-7 أيام.

## 7. بعد النشر
- راقب التكلفة يومياً في console.anthropic.com → Usage. ضع حداً للإنفاق الشهري (Spend limit) هناك كصمام أمان أخير.
- عدّل أرصدة الباقات من جدول `plans` مباشرة إذا وجدت الهامش مرتفعاً أو منخفضاً.
- أضف مستخدمين ألترا مجاناً (مؤثرين، أصدقاء) عبر `ADMIN_USERS` أو بتغيير `plan` في جدول `profiles` مع `plan_source = 'manual'`.

## أسئلة شائعة
- **هل أحتاج مطوّراً لتشغيل الخادم؟** لا. Railway يبني من Dockerfile تلقائياً وتحدّثه بضغطة عند كل تحديث في GitHub.
- **ماذا لو نفد رصيد مستخدم؟** يرى نافذة الترقية داخل الدردشة، ويستمر الشهر التالي تلقائياً.
- **آيفون؟** نفس الخادم ونفس الحسابات. يلزم حساب Apple Developer (99$/سنة) ومفتاح RevenueCat لـ iOS، ثم `VITE_REVENUECAT_IOS_KEY`.
