# Car App Manager — مدير تطبيقات السيارة

Windows desktop tool for managing **user apps** on an Android car head unit (built and tested against the Jetour T2 / Snapdragon 8155 in mind) over **ADB**.
It assumes ADB debugging is **already enabled and authorized** on the head unit. It never tries to unlock, bypass or generate ADB keys, never flashes firmware, never roots, never touches the CAN bus, and never modifies system/vehicle packages.

أداة سطح مكتب لويندوز لإدارة **تطبيقات المستخدم** على شاشة السيارة (أندرويد، Jetour T2 / Snapdragon 8155) عبر **ADB**.
يفترض البرنامج أن تصحيح ADB **مفعّل ومصرّح له مسبقاً**. لا يحاول أبداً فتح أو تجاوز تصريح ADB، ولا يفلّش النظام، ولا يعمل روت، ولا يصل إلى CAN، ولا يعدّل حزم النظام/السيارة.

---

## English

### Features (Phase 1)
- **Device**: USB and Wi-Fi (`adb connect ip:port`) detection, model / Android version / API / ABI / storage, auto-refresh, known devices, restart ADB server, `adb tcpip 5555` helper.
- **Install**: drag & drop single or batch `.apk`, and split bundles `.apks` / `.xapk` / `.apkm` (installed with `install-multiple`, OBB files pushed). Pre-install checks: minSdk vs device API, ABI compatibility, requested permissions with dangerous ones highlighted, package/version, update / same version / downgrade detection, SHA-256.
- **Apps**: user-installed apps with package, version, size. Launch, force stop, clear data, uninstall, export APK (base + splits). System and vehicle packages (`pm list packages -s` plus prefixes `com.chery`, `com.jetour`, `com.qualcomm`, `android.`, `com.android.`) are **read-only**.
- **Backup / restore**: export app list + APKs to a dated folder; restore selectively.
- **Restore to original**: uninstalls **only** apps this program installed (tracked in a local SQLite DB; apps that existed before are excluded). Two-step confirmation (dialog + typed keyword).
- **Logs**: every adb command with timestamp, command line, exit code, stdout/stderr. Export to a text file.
- **Settings**: language (Arabic default / English, switchable live), adb location, auto-refresh interval, backups folder.
- Dark minimal theme, full RTL Arabic. All device work runs in background threads.

### Features (Phase 2)
- **Screen → Mirror**: launches scrcpy (downloaded on demand from the official GitHub release, Apache-2.0) with sensible defaults, window title, optional MP4 recording. Mouse/keyboard control of the head unit. Never use while driving.
- **Screen → Screenshot**: capture, preview, copy to clipboard, timestamped PNG files.
- **Screen → Live logcat**: filter by package and level, free-text filter, colour by level, save to file, clear device buffer.
- **Device → Wireless helper**: guided USB → Wi-Fi switch (`adb tcpip 5555` + `adb connect`), remembers the address.

Phase 3 (app catalog, VirusTotal) and Phase 4 (Claude AI features) are planned; see `CHANGELOG.md`.

### Installation
**Option A – installer / portable exe** (when built with `build.bat`):
1. Run `installer_output\CarAppManager-Setup.exe`, or just run `dist\CarAppManager.exe` (portable, single file).
2. On first start the app looks for `adb.exe`. If none is found it offers to **download the official Android SDK Platform-Tools** from `https://dl.google.com/android/repository/platform-tools-latest-windows.zip` into `%LOCALAPPDATA%\CarAppManager\tools`, or you can point it to an existing `adb.exe`. Nothing is bundled.

**Option B – from source** (Python 3.11+):
```bat
git clone <this repo>
cd <repo>
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest -q
python src\run_app.py
```

**Building the exe and installer**: run `build.bat`. It creates a venv, installs dependencies, runs the tests, generates the icon, builds `dist\CarAppManager.exe` with PyInstaller (`--onefile --windowed`) and, if Inno Setup 6 (`ISCC.exe`) is installed, produces `installer_output\CarAppManager-Setup.exe`. If Inno Setup is missing the installer step is skipped with a message.

### First connection
1. Make sure ADB debugging is already enabled and authorized on the head unit (done with your separate tool).
2. **USB**: plug the cable into the head unit's USB port, open the app, go to **Device**. If the state is *Unauthorized*, accept the "Allow USB debugging" prompt on the car screen and press Refresh.
3. **Wi-Fi**: with the device connected over USB and authorized, press *Enable wireless ADB on the USB device (port 5555)*, unplug, then enter the car's Wi-Fi IP (shown on the Device page) as `ip:5555` and press *Connect*. Both the PC and the car must be on the same network. Connected addresses are remembered.
4. Go to **Apps** to list user apps, or **Install** to drop APK files.

### Safety warnings — please read
- **Warranty**: installing third-party software on the head unit may void the vehicle's infotainment warranty. You use this tool at your own risk.
- **OTA updates** from the manufacturer may re-lock ADB, remove installed apps, or change behaviour. Keep a backup (Backup page) before updating the car.
- **Never watch video or interact with apps while driving.** Installed apps are for the passenger and for the parked vehicle only. Follow local law.
- **Only install APKs from trusted sources.** The app shows SHA-256 and dangerous permissions for every file; verify them. Unsigned or unknown APKs can compromise the head unit.
- The tool never modifies system or vehicle packages. Don't try to work around that with other tools; a broken system app can disable the screen, cameras or sensors.
- Clearing app data / uninstalling cannot be undone. Every destructive action asks for confirmation and is written to the log.

### Troubleshooting
| Symptom | What to do |
|---|---|
| *adb not found* in the status bar | Settings → Download Platform-Tools, or browse to an existing `adb.exe`. |
| No device listed | Check the cable/port (some units only expose ADB on one USB port). Try *Restart ADB server*. For Wi-Fi, confirm the IP and that port 5555 is enabled. |
| *Unauthorized* | Accept the prompt on the car screen. If it never appears, ADB authorization was not completed by your setup tool. This program will not bypass it. |
| *Offline* | Unplug/replug, restart the ADB server, or reboot the head unit. |
| More than one device | Select the correct one in the Device page dropdown. |
| `INSTALL_FAILED_OLDER_SDK` | The APK requires a newer Android than the head unit (usually Android 10, API 29). Find an older build. |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | The APK only ships x86 libraries; the T2 is arm64-v8a / armeabi-v7a. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app was signed with a different key. Uninstall it first (Apps page). |
| `INSTALL_FAILED_MISSING_SPLIT` | Use the complete `.apks`/`.xapk` bundle instead of a single split. |
| Install "succeeds" but the app is missing from the launcher | Some head-unit launchers only show whitelisted apps. Use *Launch* from the Apps page. |
| App list is slow | Each app needs a few adb calls; the UI stays responsive, wait for the progress bar. |
| Where are logs / settings? | `%LOCALAPPDATA%\CarAppManager` (`settings.json`, `car_app_manager.sqlite3`, `logs\`, `backups\`, `tools\`). |

### Project layout
```
src/car_app_manager/       application package
  adb/                     runner, device, packages, install, errors, protection (blocklist)
  apk/                     inspector (androguard), bundle (.apks/.xapk)
  tools/                   platform-tools download / lookup
  ui/                      PySide6 main window and pages
  backup.py db.py logs.py config.py i18n.py workers.py app.py main.py
src/run_app.py             PyInstaller entry
tests/                     pytest suite (mocked adb + headless GUI smoke test)
assets/                    icon generator + icon
installer/                 Inno Setup script
build.bat  CarAppManager.spec  requirements.txt  CHANGELOG.md
```

---

## العربية

### المزايا (المرحلة 2)
- **الشاشة ← عرض الشاشة**: تشغيل scrcpy (يُنزَّل عند الطلب من إصدار GitHub الرسمي، رخصة Apache-2.0) بإعدادات مناسبة وعنوان نافذة وتسجيل MP4 اختياري. تحكم بالفأرة ولوحة المفاتيح. لا تستخدمه أثناء القيادة.
- **الشاشة ← لقطة شاشة**: التقاط ومعاينة ونسخ إلى الحافظة وحفظ PNG مؤرّخ.
- **الشاشة ← Logcat مباشر**: تصفية حسب الحزمة والمستوى ونص حر، تلوين حسب المستوى، حفظ إلى ملف، مسح سجل الجهاز.
- **الجهاز ← مساعد الاتصال اللاسلكي**: تبديل موجّه من USB إلى Wi-Fi (`adb tcpip 5555` ثم `adb connect`) مع حفظ العنوان.

### المزايا (المرحلة 1)
- **الجهاز**: اكتشاف عبر USB و Wi-Fi (`adb connect ip:port`)، عرض الطراز وإصدار أندرويد ومستوى API والمعمارية والتخزين، تحديث تلقائي، الأجهزة المعروفة، إعادة تشغيل خادم ADB، مساعد `adb tcpip 5555`.
- **التثبيت**: سحب وإفلات ملف واحد أو عدة ملفات `.apk`، وحزم مقسّمة `.apks` / `.xapk` / `.apkm` (تُثبّت عبر `install-multiple` مع دفع ملفات OBB). فحوصات قبل التثبيت: minSdk مقابل API الجهاز، توافق المعمارية، الأذونات المطلوبة مع إبراز الحساسة منها، اسم الحزمة والإصدار، اكتشاف التحديث / نفس النسخة / الرجوع لنسخة أقدم، وبصمة SHA-256.
- **التطبيقات**: قائمة تطبيقات المستخدم مع الحزمة والإصدار والحجم. تشغيل، إيقاف إجباري، مسح البيانات، إلغاء التثبيت، تصدير APK. حزم النظام والسيارة (`pm list packages -s` والبادئات `com.chery` و`com.jetour` و`com.qualcomm` و`android.` و`com.android.`) **للقراءة فقط**.
- **النسخ الاحتياطي / الاستعادة**: تصدير قائمة التطبيقات وملفات APK إلى مجلد مؤرّخ، واستعادة انتقائية.
- **استعادة الوضع الأصلي**: يلغي تثبيت التطبيقات التي ثبّتها هذا البرنامج **فقط** (مسجّلة في قاعدة SQLite محلية؛ التطبيقات التي كانت موجودة قبلاً مستثناة). تأكيد على خطوتين (حوار + كتابة كلمة التأكيد).
- **السجلات**: كل أمر adb مع الوقت وسطر الأمر ورمز الخروج والمخرجات. تصدير إلى ملف نصي.
- **الإعدادات**: اللغة (العربية افتراضياً / الإنجليزية، تبديل فوري)، مسار adb، فترة التحديث، مجلد النسخ.
- سمة داكنة بسيطة، دعم كامل للعربية من اليمين لليسار. كل عمليات الجهاز تعمل في الخلفية.

### التثبيت
**الخيار أ – المثبّت أو الملف التنفيذي المحمول** (بعد البناء بـ `build.bat`):
1. شغّل `installer_output\CarAppManager-Setup.exe`، أو شغّل مباشرة `dist\CarAppManager.exe` (ملف واحد محمول).
2. عند أول تشغيل يبحث البرنامج عن `adb.exe`. إن لم يجده يعرض **تنزيل Android SDK Platform-Tools الرسمية** من Google إلى `%LOCALAPPDATA%\CarAppManager\tools`، أو يمكنك تحديد `adb.exe` موجود لديك. لا شيء مضمّن داخل البرنامج.

**الخيار ب – من المصدر** (Python 3.11 أو أحدث): انظر الأوامر في القسم الإنجليزي أعلاه (`pip install -r requirements.txt` ثم `python src\run_app.py`).

**بناء الملف التنفيذي والمثبّت**: شغّل `build.bat`. ينشئ بيئة افتراضية، يثبّت الاعتماديات، يشغّل الاختبارات، يولّد الأيقونة، يبني `dist\CarAppManager.exe` عبر PyInstaller، وإن وُجد Inno Setup 6 ينتج `installer_output\CarAppManager-Setup.exe`، وإلا يتخطى هذه الخطوة برسالة.

### خطوات أول اتصال
1. تأكد أن تصحيح ADB مفعّل ومصرّح له على الشاشة (بالأداة المنفصلة).
2. **USB**: وصّل الكابل بمنفذ USB في الشاشة، افتح البرنامج، اذهب إلى **الجهاز**. إن ظهرت الحالة *غير مصرّح* وافق على طلب «السماح بتصحيح USB» على شاشة السيارة ثم اضغط تحديث.
3. **Wi-Fi**: والجهاز متصل عبر USB ومصرّح له اضغط *تفعيل ADB اللاسلكي على جهاز USB (المنفذ 5555)*، افصل الكابل، ثم أدخل عنوان Wi-Fi الخاص بالسيارة (يظهر في صفحة الجهاز) بصيغة `ip:5555` واضغط *اتصال*. يجب أن يكون الحاسوب والسيارة على نفس الشبكة. تُحفظ العناوين المتصلة.
4. اذهب إلى **التطبيقات** لعرض تطبيقات المستخدم، أو **التثبيت** لإفلات ملفات APK.

### تحذيرات السلامة — يرجى القراءة
- **الضمان**: تثبيت برامج خارجية على شاشة السيارة قد يُلغي ضمان نظام الترفيه. الاستخدام على مسؤوليتك.
- **تحديثات OTA** من الشركة قد تعيد قفل ADB أو تحذف التطبيقات المثبّتة أو تغيّر السلوك. احتفظ بنسخة احتياطية قبل تحديث السيارة.
- **لا تشاهد الفيديو ولا تتفاعل مع التطبيقات أثناء القيادة.** التطبيقات للركاب وللسيارة المتوقفة فقط. التزم بالقوانين المحلية.
- **ثبّت فقط ملفات APK من مصادر موثوقة.** يعرض البرنامج SHA-256 والأذونات الحساسة لكل ملف؛ تحقق منها. الملفات غير الموقّعة أو مجهولة المصدر قد تعرّض الشاشة للخطر.
- البرنامج لا يعدّل حزم النظام أو السيارة أبداً. لا تحاول تجاوز ذلك بأدوات أخرى؛ تعطّل تطبيق نظامي قد يوقف الشاشة أو الكاميرات أو الحساسات.
- مسح البيانات وإلغاء التثبيت لا يمكن التراجع عنهما. كل عملية حذف تطلب تأكيداً وتُسجَّل في السجل.

### حل المشكلات
| العرض | الإجراء |
|---|---|
| *adb غير موجود* في شريط الحالة | الإعدادات ← تنزيل Platform-Tools، أو حدد `adb.exe` موجود. |
| لا يظهر أي جهاز | تحقق من الكابل/المنفذ (بعض الشاشات تتيح ADB على منفذ USB واحد فقط). جرّب *إعادة تشغيل خادم ADB*. للاتصال اللاسلكي تأكد من العنوان وأن المنفذ 5555 مفعّل. |
| *غير مصرّح* | وافق على الطلب على شاشة السيارة. إن لم يظهر فالتصريح لم يكتمل بأداة الإعداد. هذا البرنامج لن يتجاوزه. |
| *غير متصل (offline)* | افصل وأعد التوصيل، أعد تشغيل خادم ADB، أو أعد تشغيل الشاشة. |
| أكثر من جهاز | اختر الجهاز الصحيح من قائمة صفحة الجهاز. |
| `INSTALL_FAILED_OLDER_SDK` | التطبيق يتطلب أندرويد أحدث من الشاشة (غالباً أندرويد 10، API 29). ابحث عن إصدار أقدم. |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | التطبيق يحوي مكتبات x86 فقط؛ الشاشة arm64-v8a / armeabi-v7a. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | التطبيق المثبّت موقّع بمفتاح مختلف. ألغِ تثبيته أولاً من صفحة التطبيقات. |
| `INSTALL_FAILED_MISSING_SPLIT` | استخدم حزمة `.apks`/`.xapk` كاملة بدل جزء واحد. |
| نجح التثبيت لكن التطبيق لا يظهر في المشغّل | بعض مشغّلات الشاشات تعرض تطبيقات محددة فقط. استخدم زر *تشغيل* من صفحة التطبيقات. |
| قائمة التطبيقات بطيئة | كل تطبيق يحتاج عدة أوامر adb؛ الواجهة تبقى مستجيبة، انتظر شريط التقدم. |
| أين السجلات والإعدادات؟ | `%LOCALAPPDATA%\CarAppManager` (`settings.json`، `car_app_manager.sqlite3`، `logs\`، `backups\`، `tools\`). |

---

## Licence notes
- Android SDK Platform-Tools are downloaded from Google and subject to the Android SDK licence.
- scrcpy (Phase 2) is Apache-2.0 and is downloaded from its official GitHub releases on demand.
