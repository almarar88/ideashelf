# Majlis AI — مجلس الوكلاء

تطبيق أندرويد (APK) يعمل كـ **مجموعة دردشة مثل واتساب** بينك وبين فريق من وكلاء الذكاء الاصطناعي، كل وكيل خبير في مجاله، ووكيل "قاضٍ" يحلّل آراء الجميع ويتخذ القرار النهائي.

## المميزات
- **دردشة جماعية طبيعية**: ترسل أمرك، الوكيل المناسب يستلمه ("تمام، أشتغل عليه الآن")، ينفّذ ويعرض النتيجة، وتعطيه ملاحظاتك.
- **رفع صور وملفات** (صور، PDF، نصوص، CSV) — الوكلاء يقرؤونها ويحللونها.
- **توليد ملفات**: تقارير `.md`، جداول `.csv`، صفحات `.html` — تتصفحها داخل التطبيق وتشاركها/تحفظها.
- **بحث في الإنترنت** لكل وكيل (قابل للتفعيل/التعطيل مع حد أقصى لعمليات البحث).
- **القاضي**: يحلّل ردود الوكلاء، يرجّح، ويقرر. له 4 أساليب (متوازن / ناقد / إجماع / جريء).
- **وضع المجلس 🏛**: كل الأعضاء يردّون، جولة مناظرة اختيارية، ثم قرار مُهيكل (القرار، الثقة %، تقييم كل وكيل، خطة تنفيذ، المخاطر، الرأي المخالف).
- **توجيه الرسالة** لوكيل محدد أو للقاضي، أو ترك الفريق يقرر من يرد (موزّع ذكي).
- **وكلاء قابلون للتخصيص بالكامل**: الاسم، المسمى، المجال، المهارات، الشخصية، التعليمات، وجه الروبوت (12 شكلاً × 12 لوناً)، عمق التفكير (مؤشر دائري)، النموذج.
- **12 قالباً جاهزاً** (استراتيجي، مالي، تسويق، قانوني، تقني، طبيب، باحث، محامي الشيطان، مفاوض، مستثمر، عمليات، مصمم).
- **تحليلات**: الرموز المستهلكة والتكلفة التقديرية يومياً، ولكل وكيل.
- عربي/إنجليزي، فاتح/داكن، كل البيانات محفوظة على الجهاز فقط.

## التثبيت
1. حمّل `MajlisAI.apk` من صفحة **Releases** في المستودع (يُبنى تلقائياً بواسطة GitHub Actions).
2. ثبّته على الهاتف (اسمح بالتثبيت من مصادر غير معروفة).
3. عند أول تشغيل أدخل اسمك و**مفتاح Anthropic API** من https://console.anthropic.com/settings/keys

> المفتاح يُحفظ على جهازك فقط ويُرسل إلى Anthropic مباشرة. الاستخدام يُحاسب على حسابك في Anthropic.

## التطوير
```bash
cd app
npm install
npm run dev            # معاينة في المتصفح
npm run build          # بناء الويب
npx cap sync android   # نسخ الويب داخل مشروع أندرويد
cd android && ./gradlew assembleRelease   # يخرج APK في android/app/build/outputs/apk/release/
```
التقنيات: Vite + React + TypeScript، Capacitor 8، Anthropic SDK (Claude Opus 5 / Sonnet 5 / Haiku 4.5) مع أدوات البحث في الويب وإنشاء/قراءة الملفات.

---

## English
Majlis AI is an Android app that works like a WhatsApp group between you and a team of AI agents. Each agent is a specialist you define (name, title, field, skills, personality, robot face, web search, thinking depth, model). A "judge" agent analyses everyone's replies and makes the final decision. You can upload images/PDF/text files, agents can generate reports (.md/.csv/.html) you can view and share, address a specific agent, or run **Council mode** for a structured verdict with confidence, per-agent scores, action plan and risks.

Get the APK from the repo's Releases page, install it, and enter your Anthropic API key on first launch.
