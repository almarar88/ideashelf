# عَقْد — Pacto AI

تطبيق أندرويد يحوّل الاتفاق الشفهي أو رسالة الواتساب إلى **عقد رقمي موقّع، مبصوم زمنياً، ومضمون مالياً** — كل المعالجة اللغوية والتوقيع تتم داخل الجهاز.

Android app that turns a spoken deal or a chat message into a signed, hash-stamped, escrow-backed contract. Text understanding and signing happen on the device.

---

## التشغيل / Build

```bash
# يتطلب Android SDK 34 و JDK 17+
./gradlew :app:assembleDebug        # أو: gradle :app:assembleDebug
./gradlew :app:testDebugUnitTest    # 57 اختبار وحدة للمحركات
```

`minSdk 26` · `targetSdk 34` · Kotlin 2.0 · Jetpack Compose (Material 3) · بلا أي خادم خلفي.

---

## أين تقع كل ميزة في الكود

### 1) محرك الالتقاط والصياغة
| الميزة | الملف |
|---|---|
| تسجيل الجلسة المباشرة | `platform/audio/VoiceSessionRecorder.kt` |
| فصل المتحدثين (Split Mic) | `platform/audio/SpeakerSegmenter.kt` — تقطيع بالصمت والطاقة |
| تفريغ الكلام على الجهاز | `platform/speech/SpeechTranscriber.kt` (`EXTRA_PREFER_OFFLINE`) |
| استخراج البنود من اللغة العامية | `domain/engine/TermExtractor.kt` |
| معجم المصطلحات الدارجة | `domain/engine/DialectLexicon.kt` — عربون، سعي، خلو، سكراب، على الفحص، قطاعي، تسليم مفتاح… |
| صائد الثغرات | `domain/engine/LoopholeDetector.kt` |
| بطاقة الشروط الأربع + القارئ الصوتي | `ui/screens/DraftReviewScreen.kt` + `platform/speech/SummaryReader.kt` |
| الفقاعة العائمة فوق المحادثات | `platform/overlay/ChatOverlayService.kt` + استقبال `ACTION_SEND` و `ACTION_PROCESS_TEXT` في `MainActivity.kt` |

### 2) التوثيق المرئي والأصول
| الميزة | الملف |
|---|---|
| المسح الزمني وبصمة الصورة | `platform/vision/AssetCapture.kt` — SHA-256 للملف لحظة الالتقاط |
| مقارنة قبل / بعد + العيوب | `domain/model/Evidence.kt` (`BEFORE_STATE`, `AFTER_STATE`, `DEFECT`) و `ui/screens/EvidenceScreen.kt` |
| الأرقام التسلسلية | `platform/vision/SerialReader.kt` |
| خزنة الرهونات | `EvidenceKind.COLLATERAL_DOCUMENT` |

### 3) المال والضمان
| الميزة | الملف |
|---|---|
| محفظة الضمان ودفتر الحركات | `domain/model/Escrow.kt` + `domain/engine/EscrowEngine.kt` |
| الدفع المرحلي | `domain/model/Milestone.kt` — لا إفراج قبل تأكيد التسليم (وقبل التوثيق المصور عند اشتراطه) |
| العمولة (1%–1.5%) | `EscrowAccount.feeBasisPoints`، تُحتسب بنقاط أساس بأعداد صحيحة لا كسور عشرية |
| المحاسب الذكي وتوزيع المصاريف | `domain/engine/ExpenseAllocator.kt` — يقرأ بند المواد أولاً ثم العرف، ويعلن القاعدة التي طبّقها |

### 4) الهوية والسمعة والأمان
| الميزة | الملف |
|---|---|
| مسح الهوية عبر NFC | `platform/nfc/NfcIdentityReader.kt` |
| التوقيع الحيوي المرتبط بالعتاد | `core/crypto/KeystoreSigner.kt` (StrongBox → TEE → برمجي) + `platform/biometric/BiometricGate.kt` |
| إثبات عدم التعديل | `core/crypto/ContractHasher.kt` — صياغة قانونية ثابتة الترتيب ثم SHA-256 وختم زمني متسلسل |
| مؤشر الموثوقية | `domain/engine/TrustScoreCalculator.kt` |
| التعاقد دون إنترنت | `platform/bluetooth/OfflineHandshake.kt` — RFCOMM مباشر بين هاتفين |

### 5) التنفيذ والنزاع
| الميزة | الملف |
|---|---|
| التتبع الجغرافي للمراحل | `domain/engine/GeoFenceEvaluator.kt` + `platform/location/LocationProbe.kt` |
| منبه المهل والتقادم | `platform/deadline/DeadlineScheduler.kt` + `DeadlineReceiver` (يسجّل وقت وصول التنبيه) |
| الملحق الفوري | `domain/model/Evidence.kt` (`Addendum`) — لا يلزم إلا بقبول الطرفين |
| الإلغاء الودي | `domain/engine/SettlementCalculator.kt` |
| المحكّم الآلي | `domain/engine/ArbitrationEngine.kt` |
| الملف القضائي PDF | `platform/export/CourtFileExporter.kt` |

### النموذج الربحي
`data/AppSettings.kt`: خطة مجانية بحصة شهرية، اشتراك Pro، وعمولة ضمان قابلة للضبط بين 1% و1.5% تُطبَّق فعلياً في دفتر الحركات.

---

## التصميم

الهوية البصرية مأخوذة من المرجع المرفق: أرضية زيتونية بخطوط طوبوغرافية مرسومة برمجياً (`ui/components/TopoBackground.kt`)، بطاقات بيضاء بحواف 24dp، بطاقات داكنة للأدوات، شارات أولوية برتقالية/ذهبية/بيضاء، وشريط سفلي داكن بدائرة بيضاء للعنصر النشط (`ui/components/PactoBottomBar.kt`). الألوان في `ui/theme/Color.kt`. الواجهة عربية أولاً مع `values-en` كاملة ودعم RTL.

---

## ما هو حقيقي وما هو واجهة جاهزة للتوصيل

**يعمل فعلياً:** استخراج البنود والثغرات، دفتر الضمان وحساب العمولة، حساب التسوية، المحكّم الآلي، بصمة العقد والختم الزمني، مفاتيح Keystore والتوقيع الحيوي، التقاط الأدلة وبصمتها، جدولة المهل، الفقاعة العائمة، تبادل العقد عبر البلوتوث، تصدير PDF، الحساب الجغرافي، مؤشر الموثوقية.

**واجهة معرّفة بانتظار التوصيل، ومكتوبة كذلك في الكود صراحةً:**
- **الضمان المالي**: الدفتر كامل ومحكوم بقواعده، لكن لا توجد بوابة دفع موصولة — لا تنتقل أموال حقيقية حتى يُوصل مزود دفع مرخّص.
- **قراءة بيانات الجواز عبر NFC**: التطبيق يثبت حضور الشريحة ويأخذ بصمة معرّفها؛ قراءة مجموعات البيانات تحتاج مفتاح سطر MRZ ومكتبة رسمية (`readDataGroups`).
- **OCR للأرقام التسلسلية**: `SerialReader` واجهة، والمنفَّذ حالياً إدخال يدوي موثّق بالصورة وبصمتها.
- **فصل المتحدثين**: استدلال بالصمت والطاقة، لا نموذج diarization عصبي.
- **الصياغة اللغوية**: محرك قواعد حتمي (عربي أولاً)، مصمَّم ليكون خط الأساس الذي يُقاس عليه أي نموذج لغوي محلي يُركَّب لاحقاً.
- **التقرير التحكيمي** اقتراح تسوية لا حكم قضائي، والتطبيق يقول ذلك للمستخدم.

---

## الاختبارات

57 اختبار وحدة تغطي محركات القرار: تقريب العمولة، استخراج الأسعار والمهل من العامية (بما فيها الأرقام العربية-الهندية)، رفض الإفراج قبل التسليم، عدم تجاوز المستحق للمبلغ المجمّد، أثر التأخير والعيوب على التحكيم، ثبات بصمة العقد واستبعاد التواقيع منها.

```bash
gradle :app:testDebugUnitTest
```
