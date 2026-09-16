"""Runtime-switchable Arabic / English strings."""
from __future__ import annotations

from typing import Callable

LANGS = ("ar", "en")

S: dict[str, tuple[str, str]] = {
    # generic
    "app.title": ("مدير تطبيقات السيارة", "Car App Manager"),
    "ok": ("موافق", "OK"),
    "cancel": ("إلغاء", "Cancel"),
    "yes": ("نعم", "Yes"),
    "no": ("لا", "No"),
    "close": ("إغلاق", "Close"),
    "refresh": ("تحديث", "Refresh"),
    "browse": ("استعراض…", "Browse…"),
    "search": ("بحث…", "Search…"),
    "error": ("خطأ", "Error"),
    "warning": ("تنبيه", "Warning"),
    "success": ("نجاح", "Success"),
    "done": ("تم", "Done"),
    "working": ("جارٍ العمل…", "Working…"),
    "confirm": ("تأكيد", "Confirm"),
    "language": ("اللغة", "Language"),
    "lang.switch": ("English", "العربية"),
    "coming": ("هذه الميزة ستُضاف في مرحلة لاحقة.", "This feature arrives in a later phase."),
    "no_device": ("لا يوجد جهاز محدد. اذهب إلى صفحة الجهاز.", "No device selected. Go to the Device page."),
    "device_not_ready": ("الجهاز غير جاهز (غير مصرّح أو غير متصل).", "Device is not ready (unauthorized or offline)."),
    "bytes.mb": ("م.ب", "MB"),
    "bytes.gb": ("ج.ب", "GB"),
    # nav
    "nav.device": ("الجهاز", "Device"),
    "nav.apps": ("التطبيقات", "Apps"),
    "nav.install": ("التثبيت", "Install"),
    "nav.screen": ("الشاشة", "Screen"),
    "nav.backup": ("النسخ الاحتياطي", "Backup"),
    "nav.logs": ("السجلات", "Logs"),
    "nav.ai": ("المساعد الذكي", "AI Assistant"),
    "nav.settings": ("الإعدادات", "Settings"),
    # status bar
    "status.adb": ("ADB", "ADB"),
    "status.adb_missing": ("adb غير موجود", "adb not found"),
    "status.no_device": ("لا يوجد جهاز", "No device"),
    "status.connected": ("متصل", "Connected"),
    "status.unauthorized": ("غير مصرّح", "Unauthorized"),
    "status.offline": ("غير متصل", "Offline"),
    # device page
    "device.title": ("الجهاز", "Device"),
    "device.select": ("الجهاز المتصل:", "Connected device:"),
    "device.auto": ("تحديث تلقائي", "Auto-refresh"),
    "device.state": ("الحالة", "State"),
    "device.model": ("الطراز", "Model"),
    "device.manufacturer": ("الشركة", "Manufacturer"),
    "device.android": ("إصدار أندرويد", "Android version"),
    "device.sdk": ("مستوى API", "API level"),
    "device.abi": ("المعمارية (ABI)", "ABI"),
    "device.storage": ("التخزين (/data)", "Storage (/data)"),
    "device.wifi_ip": ("عنوان Wi-Fi", "Wi-Fi address"),
    "device.build": ("رقم البناء", "Build"),
    "device.serial": ("الرقم التسلسلي", "Serial"),
    "device.connection": ("نوع الاتصال", "Connection"),
    "device.usb": ("USB", "USB"),
    "device.wifi": ("Wi-Fi", "Wi-Fi"),
    "device.free_of": ("{free} متاح من {total}", "{free} free of {total}"),
    "device.wifi_group": ("الاتصال اللاسلكي (ADB عبر Wi-Fi)", "Wireless ADB (Wi-Fi)"),
    "device.address": ("العنوان IP:المنفذ", "IP:port"),
    "device.connect": ("اتصال", "Connect"),
    "device.disconnect": ("قطع الاتصال", "Disconnect"),
    "device.known": ("الأجهزة المعروفة (نقرة مزدوجة للاتصال)", "Known devices (double-click to connect)"),
    "device.forget": ("نسيان الجهاز", "Forget device"),
    "device.tcpip": ("تفعيل ADB اللاسلكي على جهاز USB (المنفذ 5555)", "Enable wireless ADB on the USB device (port 5555)"),
    "device.tcpip_help": ("يعمل فقط على جهاز مصرّح له ومتصل عبر USB. بعد التفعيل افصل الكابل واستخدم عنوان Wi-Fi.",
                          "Works only on an authorized device connected over USB. Afterwards unplug and connect via the Wi-Fi address."),
    "device.restart_adb": ("إعادة تشغيل خادم ADB", "Restart ADB server"),
    "device.none_found": ("لم يتم العثور على أجهزة. وصّل السيارة عبر USB أو اتصل عبر Wi-Fi.",
                          "No devices found. Connect the car via USB or over Wi-Fi."),
    "device.unauthorized_help": ("الجهاز غير مصرّح له. وافق على طلب «السماح بتصحيح USB» على شاشة السيارة.",
                                 "Device unauthorized. Accept the “Allow USB debugging” prompt on the car screen."),
    "device.offline_help": ("الجهاز غير متصل (offline). أعد توصيل الكابل أو أعد تشغيل خادم ADB.",
                            "Device is offline. Reconnect the cable or restart the ADB server."),
    "device.multiple_help": ("يوجد أكثر من جهاز. اختر الجهاز المطلوب من القائمة.", "Multiple devices found. Select the one to use."),
    "device.connect_failed": ("فشل الاتصال: {msg}", "Connection failed: {msg}"),
    "device.connected_ok": ("تم الاتصال بـ {addr}", "Connected to {addr}"),
    # apps page
    "apps.title": ("التطبيقات المثبّتة من قبل المستخدم", "User-installed apps"),
    "apps.col.name": ("الاسم", "Name"),
    "apps.col.package": ("الحزمة", "Package"),
    "apps.col.version": ("الإصدار", "Version"),
    "apps.col.size": ("الحجم", "Size"),
    "apps.col.flags": ("ملاحظات", "Notes"),
    "apps.flag.protected": ("محمي (نظام/سيارة)", "Protected (system/vehicle)"),
    "apps.flag.ours": ("ثُبّت بهذا البرنامج", "Installed by this program"),
    "apps.launch": ("تشغيل", "Launch"),
    "apps.force_stop": ("إيقاف إجباري", "Force stop"),
    "apps.clear": ("مسح البيانات", "Clear data"),
    "apps.uninstall": ("إلغاء التثبيت", "Uninstall"),
    "apps.export": ("تصدير APK", "Export APK"),
    "apps.count": ("{n} تطبيق", "{n} apps"),
    "apps.loading": ("جارٍ قراءة التطبيقات… {cur}/{total}", "Reading apps… {cur}/{total}"),
    "apps.confirm.clear": ("سيتم مسح كل بيانات التطبيق «{app}». هل تريد المتابعة؟", "All data of “{app}” will be erased. Continue?"),
    "apps.confirm.uninstall": ("سيتم إلغاء تثبيت «{app}» من السيارة. هل تريد المتابعة؟", "“{app}” will be uninstalled from the car. Continue?"),
    "apps.confirm.force_stop": ("إيقاف «{app}» إجبارياً؟", "Force stop “{app}”?"),
    "apps.protected_msg": ("هذه حزمة نظام/سيارة محمية. القراءة فقط.", "This is a protected system/vehicle package. Read-only."),
    "apps.export_dir": ("اختر مجلد التصدير", "Choose export folder"),
    "apps.exported": ("تم تصدير {n} ملف إلى {dir}", "Exported {n} file(s) to {dir}"),
    "apps.launched": ("تم إرسال أمر التشغيل.", "Launch command sent."),
    "apps.action_ok": ("تم: {action}", "Done: {action}"),
    "apps.action_fail": ("فشل: {action}\n{msg}", "Failed: {action}\n{msg}"),
    # install page
    "install.title": ("تثبيت تطبيقات", "Install apps"),
    "install.drop": ("اسحب ملفات APK / APKS / XAPK هنا أو اضغط «إضافة ملفات»", "Drop APK / APKS / XAPK files here or click “Add files”"),
    "install.add": ("إضافة ملفات…", "Add files…"),
    "install.add_folder": ("إضافة مجلد…", "Add folder…"),
    "install.remove": ("إزالة المحدد", "Remove selected"),
    "install.clear": ("مسح القائمة", "Clear list"),
    "install.reinstall": ("إعادة التثبيت إذا كان موجوداً (-r)", "Reinstall if present (-r)"),
    "install.downgrade": ("السماح بالرجوع لنسخة أقدم (-d)", "Allow downgrade (-d)"),
    "install.grant": ("منح كل الأذونات تلقائياً (-g)", "Grant all runtime permissions (-g)"),
    "install.run": ("تثبيت الكل", "Install all"),
    "install.run_selected": ("تثبيت المحدد", "Install selected"),
    "install.col.file": ("الملف", "File"),
    "install.col.package": ("الحزمة", "Package"),
    "install.col.version": ("الإصدار", "Version"),
    "install.col.sdk": ("minSdk", "minSdk"),
    "install.col.abi": ("ABI", "ABI"),
    "install.col.perms": ("أذونات حساسة", "Dangerous perms"),
    "install.col.status": ("الحالة", "Status"),
    "install.status.checking": ("جارٍ الفحص…", "Checking…"),
    "install.status.ok": ("جاهز", "Ready"),
    "install.status.warn": ("تحذيرات", "Warnings"),
    "install.status.error": ("غير متوافق", "Incompatible"),
    "install.status.installing": ("جارٍ التثبيت…", "Installing…"),
    "install.status.installed": ("تم التثبيت", "Installed"),
    "install.status.failed": ("فشل", "Failed"),
    "install.details": ("التفاصيل", "Details"),
    "install.sha256": ("SHA-256", "SHA-256"),
    "install.permissions": ("الأذونات المطلوبة", "Requested permissions"),
    "install.checks": ("نتائج الفحص", "Checks"),
    "install.components": ("المكونات", "Components"),
    "install.installed_version": ("المثبّت حالياً", "Currently installed"),
    "install.not_installed": ("غير مثبّت", "Not installed"),
    "install.confirm_errors": ("بعض الملفات غير متوافقة مع الجهاز. هل تريد محاولة التثبيت رغم ذلك؟",
                               "Some files are incompatible with the device. Try installing anyway?"),
    "install.summary": ("اكتمل: {ok} نجاح، {fail} فشل", "Finished: {ok} succeeded, {fail} failed"),
    "install.label": ("الاسم", "Label"),
    "install.size": ("الحجم", "Size"),
    "install.target": ("targetSdk", "targetSdk"),
    "install.bundle_note": ("حزمة مقسّمة: سيتم اختيار الأجزاء المناسبة للجهاز تلقائياً.", "Split bundle: matching parts are selected automatically."),
    # backup page
    "backup.title": ("النسخ الاحتياطي والاستعادة", "Backup & restore"),
    "backup.folder": ("مجلد النسخ:", "Backups folder:"),
    "backup.create": ("إنشاء نسخة احتياطية…", "Create backup…"),
    "backup.list": ("النسخ المتوفرة", "Available backups"),
    "backup.contents": ("محتويات النسخة", "Backup contents"),
    "backup.restore": ("استعادة المحدد", "Restore selected"),
    "backup.select_all": ("تحديد الكل", "Select all"),
    "backup.select_none": ("إلغاء التحديد", "Select none"),
    "backup.choose_apps": ("اختر التطبيقات المراد نسخها", "Choose apps to back up"),
    "backup.progress": ("نسخ {cur}/{total}: {pkg}", "Backing up {cur}/{total}: {pkg}"),
    "backup.done": ("تم إنشاء النسخة: {name} ({n} تطبيق)", "Backup created: {name} ({n} apps)"),
    "backup.restore_progress": ("استعادة {cur}/{total}: {pkg}", "Restoring {cur}/{total}: {pkg}"),
    "backup.restore_done": ("اكتملت الاستعادة: {ok} نجاح، {fail} فشل", "Restore finished: {ok} succeeded, {fail} failed"),
    "backup.open_folder": ("فتح المجلد", "Open folder"),
    "backup.none": ("لا توجد نسخ احتياطية بعد.", "No backups yet."),
    "backup.confirm_restore": ("سيتم تثبيت {n} تطبيق من النسخة الاحتياطية (مع إعادة التثبيت). متابعة؟",
                               "{n} app(s) will be installed from the backup (reinstall). Continue?"),
    "backup.col.created": ("التاريخ", "Created"),
    "backup.col.device": ("الجهاز", "Device"),
    "backup.col.apps": ("التطبيقات", "Apps"),
    # restore to original
    "orig.button": ("استعادة الوضع الأصلي", "Restore to original"),
    "orig.help": ("يلغي تثبيت التطبيقات التي ثبّتها هذا البرنامج فقط (المسجّلة محلياً). لا يمس تطبيقات النظام أو ما ثبّته غيرك.",
                  "Uninstalls ONLY apps this program installed (tracked locally). Never touches system apps or apps installed elsewhere."),
    "orig.none": ("لا توجد تطبيقات مسجّلة كمثبّتة بواسطة هذا البرنامج.", "No apps are tracked as installed by this program."),
    "orig.step1": ("الخطوة 1 من 2: سيتم إلغاء تثبيت {n} تطبيق:\n\n{list}\n\nهل تريد المتابعة؟",
                   "Step 1 of 2: {n} app(s) will be uninstalled:\n\n{list}\n\nContinue?"),
    "orig.step2": ("الخطوة 2 من 2: هذا الإجراء لا يمكن التراجع عنه.\nاكتب كلمة {word} للتأكيد:",
                   "Step 2 of 2: this cannot be undone.\nType {word} to confirm:"),
    "orig.word": ("استعادة", "RESTORE"),
    "orig.done": ("اكتملت الاستعادة: {ok} أُزيل، {fail} فشل", "Restore finished: {ok} removed, {fail} failed"),
    # logs page
    "logs.title": ("سجل العمليات", "Action log"),
    "logs.col.time": ("الوقت", "Time"),
    "logs.col.action": ("العملية", "Action"),
    "logs.col.result": ("النتيجة", "Result"),
    "logs.col.device": ("الجهاز", "Device"),
    "logs.export": ("تصدير إلى ملف…", "Export to file…"),
    "logs.clear": ("مسح السجل", "Clear log"),
    "logs.confirm_clear": ("مسح كل سجل العمليات؟", "Clear the entire action log?"),
    "logs.exported": ("تم التصدير إلى {path}", "Exported to {path}"),
    "logs.command": ("الأمر", "Command"),
    "logs.rc": ("رمز الخروج", "Exit code"),
    # settings
    "settings.title": ("الإعدادات", "Settings"),
    "settings.general": ("عام", "General"),
    "settings.adb": ("أداة ADB", "ADB tool"),
    "settings.adb_path": ("مسار adb.exe:", "adb.exe path:"),
    "settings.adb_download": ("تنزيل Platform-Tools من Google", "Download Platform-Tools from Google"),
    "settings.adb_test": ("اختبار", "Test"),
    "settings.adb_ok": ("يعمل: {v}", "Working: {v}"),
    "settings.adb_bad": ("adb لا يعمل من هذا المسار.", "adb does not run from this path."),
    "settings.adb_downloading": ("جارٍ التنزيل… {pct}%", "Downloading… {pct}%"),
    "settings.adb_downloaded": ("تم تنزيل adb إلى {path}", "adb downloaded to {path}"),
    "settings.adb_download_failed": ("فشل التنزيل: {msg}", "Download failed: {msg}"),
    "settings.refresh": ("فترة التحديث التلقائي (ثوانٍ):", "Auto-refresh interval (seconds):"),
    "settings.backups": ("مجلد النسخ الاحتياطية:", "Backups folder:"),
    "settings.confirm": ("طلب تأكيد قبل كل عملية حذف/مسح", "Ask for confirmation before destructive actions"),
    "settings.save": ("حفظ", "Save"),
    "settings.saved": ("تم الحفظ.", "Saved."),
    "settings.data_dir": ("مجلد بيانات البرنامج:", "App data folder:"),
    "settings.safety": ("حدود الأمان", "Safety boundaries"),
    "settings.safety_text": ("هذا البرنامج لا يقوم أبداً بـ: فتح/تجاوز تصريح ADB، تفليش النظام، الروت، الوصول إلى CAN، أو تعديل تطبيقات النظام والسيارة. الحزم المحمية للقراءة فقط.",
                             "This program never: unlocks/bypasses ADB authorization, flashes firmware, roots, touches CAN bus, or modifies system/vehicle apps. Protected packages are read-only."),
    # first run
    "firstrun.title": ("الإعداد الأول", "First-run setup"),
    "firstrun.text": ("لم يتم العثور على adb. يمكن تنزيل Android Platform-Tools الرسمية من Google (حوالي 7 م.ب) أو تحديد ملف adb.exe موجود.",
                      "adb was not found. Download the official Android Platform-Tools from Google (~7 MB) or point to an existing adb.exe."),
    "firstrun.download": ("تنزيل الآن", "Download now"),
    "firstrun.browse": ("تحديد adb.exe…", "Locate adb.exe…"),
    "firstrun.later": ("لاحقاً", "Later"),
    # screen page (phase 2)
    "screen.title": ("الشاشة والتحكم", "Screen & control"),
    "screen.tab.mirror": ("عرض الشاشة (scrcpy)", "Mirror (scrcpy)"),
    "screen.tab.shot": ("لقطة شاشة", "Screenshot"),
    "screen.tab.logcat": ("Logcat مباشر", "Live logcat"),
    "scrcpy.status": ("scrcpy:", "scrcpy:"),
    "scrcpy.missing": ("scrcpy غير موجود. حمّله من GitHub (الإصدار الرسمي، رخصة Apache-2.0) أو حدد scrcpy.exe.",
                       "scrcpy not found. Download it from GitHub (official release, Apache-2.0) or locate scrcpy.exe."),
    "scrcpy.found": ("scrcpy جاهز: {path}", "scrcpy ready: {path}"),
    "scrcpy.download": ("تنزيل scrcpy من GitHub", "Download scrcpy from GitHub"),
    "scrcpy.downloading": ("جارٍ تنزيل scrcpy… {pct}%", "Downloading scrcpy… {pct}%"),
    "scrcpy.download_failed": ("فشل تنزيل scrcpy: {msg}", "scrcpy download failed: {msg}"),
    "scrcpy.max_size": ("أقصى عرض (بكسل):", "Max size (px):"),
    "scrcpy.bitrate": ("معدل البت (Mbps):", "Bit rate (Mbps):"),
    "scrcpy.fps": ("أقصى إطارات/ث:", "Max FPS:"),
    "scrcpy.top": ("النافذة دائماً في المقدمة", "Always on top"),
    "scrcpy.no_audio": ("بدون صوت (أندرويد 10 لا يدعم نقل الصوت)", "No audio (Android 10 cannot forward audio)"),
    "scrcpy.record": ("تسجيل إلى ملف MP4", "Record to MP4 file"),
    "scrcpy.record_dir": ("مجلد التسجيلات:", "Recordings folder:"),
    "scrcpy.start": ("بدء العرض", "Start mirroring"),
    "scrcpy.stop": ("إيقاف", "Stop"),
    "scrcpy.running": ("scrcpy يعمل (نافذة منفصلة). أغلق النافذة أو اضغط إيقاف.", "scrcpy is running in its own window. Close it or press Stop."),
    "scrcpy.exited": ("انتهى scrcpy (رمز {rc}).\n{log}", "scrcpy exited (code {rc}).\n{log}"),
    "scrcpy.help": ("يفتح scrcpy نافذة تعرض شاشة السيارة ويسمح بالتحكم بالفأرة ولوحة المفاتيح. لا تستخدمه أثناء القيادة.",
                    "scrcpy opens a window mirroring the car screen with mouse/keyboard control. Never use it while driving."),
    "shot.capture": ("التقاط لقطة", "Capture"),
    "shot.folder": ("مجلد الحفظ:", "Save folder:"),
    "shot.saved": ("تم الحفظ: {path}", "Saved: {path}"),
    "shot.open": ("فتح المجلد", "Open folder"),
    "shot.copy": ("نسخ إلى الحافظة", "Copy to clipboard"),
    "shot.copied": ("نُسخت الصورة إلى الحافظة.", "Image copied to the clipboard."),
    "logcat.package": ("الحزمة:", "Package:"),
    "logcat.all": ("(الكل)", "(all)"),
    "logcat.level": ("المستوى:", "Level:"),
    "logcat.filter": ("تصفية نصية…", "Text filter…"),
    "logcat.start": ("بدء", "Start"),
    "logcat.stop": ("إيقاف", "Stop"),
    "logcat.clear": ("مسح", "Clear"),
    "logcat.clear_device": ("مسح سجل الجهاز (logcat -c)", "Clear device buffer (logcat -c)"),
    "logcat.save": ("حفظ إلى ملف…", "Save to file…"),
    "logcat.saved": ("تم حفظ {n} سطر إلى {path}", "Saved {n} lines to {path}"),
    "logcat.no_pid": ("التطبيق {pkg} لا يعمل حالياً؛ شغّله أولاً أو اختر (الكل).", "{pkg} is not running; launch it first or choose (all)."),
    "logcat.running": ("جارٍ الاستقبال… {n} سطر", "Streaming… {n} lines"),
    "logcat.stopped": ("متوقف. {n} سطر", "Stopped. {n} lines"),
    "logcat.autoscroll": ("تمرير تلقائي", "Auto-scroll"),
    # wireless wizard
    "wiz.title": ("مساعد الاتصال اللاسلكي", "Wireless ADB helper"),
    "wiz.button": ("مساعد الاتصال اللاسلكي…", "Wireless helper…"),
    "wiz.intro": ("سيقوم المساعد بالخطوات التالية تلقائياً:\n1. التأكد من وجود جهاز مصرّح له عبر USB.\n2. قراءة عنوان Wi-Fi للسيارة.\n3. تشغيل وضع TCP/IP على المنفذ 5555 (adb tcpip).\n4. الاتصال بالعنوان وحفظه في الأجهزة المعروفة.\n\nبعد النجاح يمكنك فصل الكابل. يجب أن يكون الحاسوب والسيارة على نفس شبكة Wi-Fi.",
                  "The helper will automatically:\n1. Check for an authorized USB device.\n2. Read the car's Wi-Fi address.\n3. Switch it to TCP/IP on port 5555 (adb tcpip).\n4. Connect to that address and remember it.\n\nAfterwards you may unplug the cable. PC and car must be on the same Wi-Fi network."),
    "wiz.run": ("ابدأ", "Start"),
    "wiz.step_usb": ("الخطوة 1: جهاز USB مصرّح له", "Step 1: authorized USB device"),
    "wiz.step_ip": ("الخطوة 2: عنوان Wi-Fi", "Step 2: Wi-Fi address"),
    "wiz.step_tcpip": ("الخطوة 3: تفعيل TCP/IP 5555", "Step 3: enable TCP/IP 5555"),
    "wiz.step_connect": ("الخطوة 4: الاتصال", "Step 4: connect"),
    "wiz.no_usb": ("لا يوجد جهاز USB مصرّح له. وصّل الكابل ووافق على طلب التصحيح.", "No authorized USB device. Plug the cable and accept the debugging prompt."),
    "wiz.no_ip": ("تعذّر قراءة عنوان Wi-Fi. تأكد أن السيارة متصلة بشبكة Wi-Fi، أو أدخل العنوان يدوياً:", "Could not read the Wi-Fi address. Make sure the car is on Wi-Fi, or enter it manually:"),
    "wiz.success": ("تم الاتصال لاسلكياً بـ {addr}. يمكنك فصل الكابل الآن.", "Wireless connection to {addr} established. You may unplug the cable."),
    "wiz.fail": ("فشل الاتصال: {msg}", "Connection failed: {msg}"),
    # settings additions
    "settings.scrcpy_path": ("مسار scrcpy.exe:", "scrcpy.exe path:"),
    "settings.shots_dir": ("مجلد لقطات الشاشة:", "Screenshots folder:"),
    # ai placeholder
    "ai.title": ("المساعد الذكي", "AI Assistant"),
}


class I18n:
    def __init__(self, lang: str = "ar"):
        self.lang = lang if lang in LANGS else "ar"
        self._listeners: list[Callable[[str], None]] = []

    def tr(self, key: str, **kw) -> str:
        pair = S.get(key)
        if pair is None:
            return key
        s = pair[0] if self.lang == "ar" else pair[1]
        if kw:
            try:
                s = s.format(**kw)
            except (KeyError, IndexError):
                pass
        return s

    def set_language(self, lang: str) -> None:
        if lang not in LANGS or lang == self.lang:
            return
        self.lang = lang
        for fn in list(self._listeners):
            fn(lang)

    def on_change(self, fn: Callable[[str], None]) -> None:
        self._listeners.append(fn)

    @property
    def rtl(self) -> bool:
        return self.lang == "ar"


_global = I18n("ar")


def tr(key: str, **kw) -> str:
    return _global.tr(key, **kw)


def i18n() -> I18n:
    return _global


def set_language(lang: str) -> None:
    _global.set_language(lang)


def current_lang() -> str:
    return _global.lang


def human_size(n: int) -> str:
    if n >= 1 << 30:
        return f"{n / (1 << 30):.2f} {tr('bytes.gb')}"
    if n >= 1 << 20:
        return f"{n / (1 << 20):.1f} {tr('bytes.mb')}"
    return f"{n / 1024:.0f} KB"
