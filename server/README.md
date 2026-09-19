# Majlis AI — الخادم (Hosted API)

هذا الخادم هو ما يجعل التطبيق قابلاً للنشر لعامة الناس: يحمل مفتاح Anthropic **الخاص بك** ولا يراه المستخدم، يتحقق من حساب المستخدم، يطبّق حدود باقته، ويمرّر الطلبات إلى Claude مع قياس التكلفة الفعلية لكل مستخدم.

## كيف يحميك من الخسارة
- لكل باقة **ميزانية شهرية بالدولار** (`plans.monthly_budget_usd`). عندما يستهلكها المستخدم يتوقف الذكاء الاصطناعي حتى الشهر التالي أو حتى يرقّي باقته. لا يمكن لأي مستخدم أن يكلّفك أكثر من ميزانيته.
- المجاني محدود بعدد رسائل يومياً ونموذج Haiku فقط وبدون بحث.
- النماذج غير المسموحة للباقة تُستبدل تلقائياً بأفضل نموذج مسموح (لا خطأ للمستخدم).
- التخزين المؤقت للتعليمات (prompt caching) مفعّل في التطبيق فيقلّ الإدخال المدفوع ~90%.

الأرقام الافتراضية في `schema.sql` (عدّلها من جدول `plans` مباشرة بدون إعادة نشر):

| الباقة | السعر | ميزانية AI | الهامش التقريبي | النماذج |
|---|---|---|---|---|
| مجاني | 0 | $0.60/شهر (10 رسائل/يوم) | تكلفة تسويق | Haiku |
| برو | $9.99 | $4.00 | ~60% قبل عمولة Google (15-30%) | Haiku, Sonnet |
| ألترا | $29.99 | $13.00 | ~57% قبل عمولة Google | + Opus |

## النشر في 15 دقيقة
1. **Supabase** (supabase.com، مجاني): أنشئ مشروعاً → SQL Editor → الصق `schema.sql` ونفّذه → Authentication → Providers → فعّل Email (يمكنك تعطيل تأكيد البريد للبداية).
2. **الخادم**: Railway.app أو Render.com أو Fly.io (كلها تدعم Docker). اربط المستودع واختر مجلد `server/`، وأضف متغيرات البيئة من `.env.example` (المفتاحان الأساسيان: `ANTHROPIC_API_KEY` و`SUPABASE_SERVICE_ROLE_KEY`). ستحصل على رابط مثل `https://majlis-api.up.railway.app`.
3. **RevenueCat** (revenuecat.com، مجاني حتى 2,500$ إيراد شهري): أنشئ مشروعاً → اربط تطبيق Google Play (Service account JSON) → أنشئ Entitlements باسم `pro` و`ultra` → المنتجات `majlis_pro_monthly` و`majlis_ultra_monthly` → Offering افتراضي يحتوي الباقتين → Integrations → Webhooks → رابط `https://<الخادم>/webhooks/revenuecat` مع Authorization تختاره وتضعه في `REVENUECAT_WEBHOOK_AUTH`.
4. **التطبيق**: ضع القيم في GitHub → Settings → Secrets and variables → Actions → Variables:
   `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REVENUECAT_ANDROID_KEY`. عندها يُبنى التطبيق بوضع "مستضاف" ويطلب تسجيل الدخول بدل مفتاح API.

## نقاط الخادم
- `GET /health`
- `GET /me?refresh=1` — الحساب، الباقة، الاستهلاك هذا الشهر
- `POST /v1/messages` — متوافق مع Claude API (يستخدمه تطبيق Majlis عبر SDK Anthropic مع `baseURL`)
- `POST /webhooks/revenuecat`
- `POST /account/delete` — حذف الحساب (مطلوب من Google Play)

## تشغيل محلي
```bash
cd server && cp .env.example .env && npm install && npm run dev
```
