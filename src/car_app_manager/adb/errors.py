"""Human readable (Arabic / English) explanations for adb and pm failures."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# code -> (arabic, english)
INSTALL_ERRORS: dict[str, tuple[str, str]] = {
    "INSTALL_FAILED_ALREADY_EXISTS": ("التطبيق مثبّت مسبقاً. استخدم إعادة التثبيت (-r).", "App already installed. Reinstall (-r) is required."),
    "INSTALL_FAILED_INVALID_APK": ("ملف APK غير صالح أو تالف.", "The APK file is invalid or corrupted."),
    "INSTALL_FAILED_INVALID_URI": ("مسار الملف غير صالح.", "Invalid file path."),
    "INSTALL_FAILED_INSUFFICIENT_STORAGE": ("لا توجد مساحة كافية على الجهاز.", "Not enough storage on the device."),
    "INSTALL_FAILED_DUPLICATE_PACKAGE": ("يوجد تطبيق بنفس اسم الحزمة.", "A package with the same name already exists."),
    "INSTALL_FAILED_NO_SHARED_USER": ("المستخدم المشترك المطلوب غير موجود.", "Requested shared user does not exist."),
    "INSTALL_FAILED_UPDATE_INCOMPATIBLE": ("التحديث غير متوافق: التوقيع مختلف عن النسخة المثبّتة. احذف التطبيق أولاً.", "Update incompatible: signature differs from the installed version. Uninstall it first."),
    "INSTALL_FAILED_SHARED_USER_INCOMPATIBLE": ("توقيع المستخدم المشترك غير متوافق.", "Shared user signature mismatch."),
    "INSTALL_FAILED_MISSING_SHARED_LIBRARY": ("مكتبة مشتركة مطلوبة غير موجودة على الجهاز.", "A required shared library is missing on the device."),
    "INSTALL_FAILED_REPLACE_COULDNT_DELETE": ("تعذّر حذف النسخة القديمة.", "Could not delete the old version."),
    "INSTALL_FAILED_DEXOPT": ("فشل تحسين الكود (dexopt). قد يكون التطبيق غير متوافق مع نسخة أندرويد.", "dexopt failed. The app may be incompatible with this Android version."),
    "INSTALL_FAILED_OLDER_SDK": ("التطبيق يتطلب نسخة أندرويد أحدث من نسخة الجهاز.", "The app requires a newer Android version than the device has."),
    "INSTALL_FAILED_NEWER_SDK": ("التطبيق يتطلب نسخة أندرويد أقدم (maxSdk).", "The app requires an older Android version (maxSdk)."),
    "INSTALL_FAILED_CONFLICTING_PROVIDER": ("تعارض مع مزود محتوى مثبّت.", "Conflicts with an installed content provider."),
    "INSTALL_FAILED_TEST_ONLY": ("التطبيق مبني للاختبار فقط (testOnly).", "The app is marked testOnly."),
    "INSTALL_FAILED_CPU_ABI_INCOMPATIBLE": ("التطبيق لا يدعم معمارية معالج الجهاز (ABI).", "The app does not support the device CPU architecture (ABI)."),
    "INSTALL_FAILED_NO_MATCHING_ABIS": ("لا توجد مكتبات متوافقة مع معمارية الجهاز.", "No native libraries match the device ABI."),
    "INSTALL_FAILED_MISSING_FEATURE": ("الجهاز يفتقد ميزة عتادية يتطلبها التطبيق.", "The device lacks a hardware feature the app requires."),
    "INSTALL_FAILED_CONTAINER_ERROR": ("خطأ في حاوية التثبيت.", "Install container error."),
    "INSTALL_FAILED_INVALID_INSTALL_LOCATION": ("موقع التثبيت غير صالح.", "Invalid install location."),
    "INSTALL_FAILED_MEDIA_UNAVAILABLE": ("وسيط التخزين غير متاح.", "Storage media unavailable."),
    "INSTALL_FAILED_VERIFICATION_TIMEOUT": ("انتهت مهلة التحقق من التطبيق.", "App verification timed out."),
    "INSTALL_FAILED_VERIFICATION_FAILURE": ("رفض نظام التحقق التطبيق (Play Protect أو ما يماثله).", "The verifier rejected the app (Play Protect or similar)."),
    "INSTALL_FAILED_PACKAGE_CHANGED": ("تغيّرت الحزمة أثناء التثبيت.", "Package changed during install."),
    "INSTALL_FAILED_UID_CHANGED": ("تغيّر معرف المستخدم للحزمة.", "Package UID changed."),
    "INSTALL_FAILED_VERSION_DOWNGRADE": ("النسخة أقدم من المثبّتة. فعّل السماح بالرجوع لنسخة أقدم (-d).", "Version is older than the installed one. Enable downgrade (-d)."),
    "INSTALL_FAILED_PERMISSION_MODEL_DOWNGRADE": ("نموذج الأذونات أقدم من المثبّت.", "Permission model downgrade."),
    "INSTALL_FAILED_SANDBOX_VERSION_DOWNGRADE": ("نسخة sandbox أقدم.", "Sandbox version downgrade."),
    "INSTALL_FAILED_MISSING_SPLIT": ("ملفات split ناقصة. استخدم حزمة .apks/.xapk كاملة.", "Missing split APKs. Use a complete .apks/.xapk bundle."),
    "INSTALL_FAILED_ABORTED": ("أُلغي التثبيت.", "Install aborted."),
    "INSTALL_FAILED_USER_RESTRICTED": ("تثبيت التطبيقات مقيّد على هذا الجهاز/المستخدم.", "App installation is restricted for this user/device."),
    "INSTALL_FAILED_INTERNAL_ERROR": ("خطأ داخلي في النظام.", "Internal system error."),
    "INSTALL_FAILED_BAD_DEX_METADATA": ("بيانات DEX تالفة.", "Bad DEX metadata."),
    "INSTALL_FAILED_BAD_SIGNATURE": ("توقيع التطبيق غير صالح.", "Bad app signature."),
    "INSTALL_FAILED_PROCESS_NOT_DEFINED": ("عملية غير معرفة في الحزمة.", "Process not defined."),
    "INSTALL_PARSE_FAILED_NOT_APK": ("الملف ليس APK.", "The file is not an APK."),
    "INSTALL_PARSE_FAILED_BAD_MANIFEST": ("ملف AndroidManifest تالف.", "Bad AndroidManifest."),
    "INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION": ("خطأ غير متوقع عند تحليل الحزمة.", "Unexpected error while parsing the package."),
    "INSTALL_PARSE_FAILED_NO_CERTIFICATES": ("التطبيق غير موقّع.", "The APK is not signed."),
    "INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES": ("شهادات التوقيع غير متسقة.", "Inconsistent signing certificates."),
    "INSTALL_PARSE_FAILED_CERTIFICATE_ENCODING": ("ترميز الشهادة غير صالح.", "Bad certificate encoding."),
    "INSTALL_PARSE_FAILED_BAD_PACKAGE_NAME": ("اسم الحزمة غير صالح.", "Bad package name."),
    "INSTALL_PARSE_FAILED_BAD_SHARED_USER_ID": ("معرف المستخدم المشترك غير صالح.", "Bad shared user id."),
    "INSTALL_PARSE_FAILED_MANIFEST_MALFORMED": ("ملف Manifest مشوّه.", "Malformed manifest."),
    "INSTALL_PARSE_FAILED_MANIFEST_EMPTY": ("ملف Manifest فارغ.", "Empty manifest."),
    "INSTALL_FAILED_NO_CERTIFICATES": ("التطبيق غير موقّع.", "The APK is not signed."),
    "INSTALL_FAILED_INCOMPATIBLE_SIGNATURE": ("التوقيع غير متوافق.", "Incompatible signature."),
    "DELETE_FAILED_INTERNAL_ERROR": ("خطأ داخلي عند الحذف.", "Internal error while uninstalling."),
    "DELETE_FAILED_DEVICE_POLICY_MANAGER": ("سياسة الجهاز تمنع حذف هذا التطبيق.", "Device policy prevents uninstalling this app."),
    "DELETE_FAILED_USER_RESTRICTED": ("الحذف مقيّد لهذا المستخدم.", "Uninstall is restricted for this user."),
    "DELETE_FAILED_OWNER_BLOCKED": ("مالك الجهاز يمنع الحذف.", "Device owner blocks uninstall."),
    "DELETE_FAILED_ABORTED": ("أُلغي الحذف.", "Uninstall aborted."),
}

DEVICE_ERRORS: dict[str, tuple[str, str]] = {
    "no_device": ("لا يوجد جهاز متصل. تأكد من الكابل أو الاتصال اللاسلكي.", "No device connected. Check the USB cable or Wi-Fi connection."),
    "unauthorized": ("الجهاز غير مصرّح له. وافق على طلب تصحيح USB على شاشة السيارة.", "Device unauthorized. Accept the USB debugging prompt on the car screen."),
    "offline": ("الجهاز غير متصل (offline). أعد توصيل الكابل أو أعد تشغيل ADB.", "Device is offline. Reconnect the cable or restart ADB."),
    "multiple": ("يوجد أكثر من جهاز متصل. اختر الجهاز من صفحة الجهاز.", "More than one device connected. Select one on the Device page."),
    "adb_missing": ("لم يتم العثور على adb. حمّله من الإعدادات.", "adb not found. Download it from Settings."),
    "protected": ("هذه حزمة نظام/سيارة محمية. لا يمكن تعديلها.", "This is a protected system/vehicle package. It cannot be modified."),
    "timeout": ("انتهت مهلة الأمر.", "The command timed out."),
    "no_permissions": ("لا توجد صلاحيات للوصول للجهاز عبر USB (تعريف/سواقة).", "No permission to access the device over USB (driver)."),
}

_FAILURE_RE = re.compile(r"((?:INSTALL|DELETE)_(?:PARSE_)?FAILED_[A-Z_]+)")

# Errors where retrying with another install method cannot help.
DEFINITIVE_INSTALL_CODES: frozenset[str] = frozenset({
    "INSTALL_FAILED_OLDER_SDK", "INSTALL_FAILED_NEWER_SDK", "INSTALL_FAILED_NO_MATCHING_ABIS",
    "INSTALL_FAILED_CPU_ABI_INCOMPATIBLE", "INSTALL_FAILED_UPDATE_INCOMPATIBLE", "INSTALL_FAILED_VERSION_DOWNGRADE",
    "INSTALL_FAILED_INSUFFICIENT_STORAGE", "INSTALL_FAILED_MISSING_SHARED_LIBRARY", "INSTALL_FAILED_MISSING_SPLIT",
    "INSTALL_FAILED_INVALID_APK", "INSTALL_FAILED_DUPLICATE_PACKAGE", "INSTALL_FAILED_CONFLICTING_PROVIDER",
    "INSTALL_FAILED_SHARED_USER_INCOMPATIBLE", "INSTALL_FAILED_BAD_SIGNATURE", "INSTALL_FAILED_NO_CERTIFICATES",
    "INSTALL_FAILED_MISSING_FEATURE", "INSTALL_FAILED_TEST_ONLY", "INSTALL_FAILED_INCOMPATIBLE_SIGNATURE",
    "INSTALL_PARSE_FAILED_NOT_APK", "INSTALL_PARSE_FAILED_BAD_MANIFEST", "INSTALL_PARSE_FAILED_NO_CERTIFICATES",
    "INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES", "INSTALL_PARSE_FAILED_CERTIFICATE_ENCODING",
    "INSTALL_PARSE_FAILED_BAD_PACKAGE_NAME", "INSTALL_PARSE_FAILED_MANIFEST_MALFORMED", "INSTALL_PARSE_FAILED_MANIFEST_EMPTY",
})

# Practical next steps per error (ar, en). Shown in the failure dialog.
HINTS: dict[str, tuple[str, str]] = {
    "INSTALL_FAILED_USER_RESTRICTED": (
        "انظر إلى شاشة السيارة فوراً: بعض الشاشات تعرض نافذة «السماح بالتثبيت» يجب الموافقة عليها خلال ثوانٍ. إن لم تظهر، جرّب وضع التوافق (push + pm install) من خيارات التثبيت، ثم شغّل «تشخيص» من صفحة الجهاز.",
        "Look at the car screen now: some units show an “allow install” prompt that must be accepted within seconds. If none appears, try compatibility mode (push + pm install) in the install options, then run Diagnostics on the Device page."),
    "INSTALL_FAILED_VERIFICATION_FAILURE": (
        "نظام السيارة يتحقق من التطبيقات القادمة عبر ADB ويرفضها. من صفحة الجهاز ← تشخيص يمكنك تعطيل هذا التحقق مؤقتاً (إعداد نظام قابل للإرجاع)، ثم أعد المحاولة.",
        "The unit verifies apps installed over ADB and rejected this one. On the Device page → Diagnostics you can temporarily disable that verification (a reversible system setting), then retry."),
    "INSTALL_FAILED_VERIFICATION_TIMEOUT": (
        "انتهت مهلة التحقق. تأكد أن السيارة متصلة بالإنترنت أو عطّل التحقق من صفحة التشخيص وأعد المحاولة.",
        "Verification timed out. Make sure the car has internet, or disable verification from Diagnostics and retry."),
    "INSTALL_FAILED_INTERNAL_ERROR": (
        "خطأ داخلي في نظام السيارة. جرّب وضع التوافق، وإن استمر أعد تشغيل الشاشة ثم حاول مرة أخرى.",
        "Internal error in the car's system. Try compatibility mode; if it persists, reboot the head unit and retry."),
    "INSTALL_FAILED_ABORTED": (
        "أُلغي التثبيت من جهة السيارة (غالباً نافذة تأكيد رُفضت أو أُغلقت). أعد المحاولة وراقب شاشة السيارة، أو استخدم وضع التوافق.",
        "The car side aborted the install (usually a confirmation dialog that was dismissed). Retry while watching the car screen, or use compatibility mode."),
    "INSTALL_FAILED_INSUFFICIENT_STORAGE": (
        "حرّر مساحة على الشاشة (احذف تطبيقات أو ملفات) ثم أعد المحاولة.",
        "Free up space on the unit (remove apps or files) and retry."),
    "INSTALL_FAILED_OLDER_SDK": (
        "ابحث عن إصدار أقدم من التطبيق يدعم أندرويد 10 (API 29) أو أقل.",
        "Find an older build of the app that supports Android 10 (API 29) or lower."),
    "INSTALL_FAILED_NO_MATCHING_ABIS": (
        "هذا الملف لا يحوي مكتبات arm64-v8a/armeabi-v7a. نزّل نسخة arm64 من المصدر الرسمي.",
        "This file has no arm64-v8a/armeabi-v7a libraries. Download the arm64 build from the official source."),
    "INSTALL_FAILED_UPDATE_INCOMPATIBLE": (
        "النسخة المثبّتة موقّعة بمفتاح مختلف. ألغِ تثبيت التطبيق من صفحة التطبيقات (ستُحذف بياناته) ثم ثبّت من جديد.",
        "The installed copy is signed with a different key. Uninstall it from the Apps page (its data will be lost) and install again."),
    "INSTALL_FAILED_VERSION_DOWNGRADE": (
        "فعّل خيار «السماح بالرجوع لنسخة أقدم (-d)» في خيارات التثبيت.",
        "Enable “Allow downgrade (-d)” in the install options."),
    "INSTALL_FAILED_MISSING_SPLIT": (
        "ثبّت الحزمة الكاملة (.apks/.xapk) بدل ملف split واحد.",
        "Install the complete bundle (.apks/.xapk) instead of a single split."),
    "INSTALL_FAILED_INVALID_APK": (
        "الملف تالف أو ليس APK. أعد تنزيله وتحقق من بصمة SHA-256.",
        "The file is corrupt or not an APK. Re-download it and check the SHA-256."),
    "INSTALL_FAILED_TEST_ONLY": (
        "فعّل خيار «السماح بحزم الاختبار (-t)».",
        "Enable “Allow test packages (-t)”."),
    "NOT_FOUND_AFTER_INSTALL": (
        "أبلغ النظام بالنجاح لكن الحزمة غير موجودة بعد التثبيت. غالباً تطبيق حماية في السيارة يحذف التطبيقات المثبّتة خارجياً. شغّل التشخيص وأرسل التقرير.",
        "The system reported success but the package is not present afterwards. A protection app on the unit is probably removing sideloaded apps. Run Diagnostics and share the report."),
    "PUSH_FAILED": (
        "تعذّر نسخ الملف إلى الشاشة. تحقق من المساحة والاتصال (الكابل / Wi-Fi) وأعد المحاولة.",
        "Could not copy the file to the unit. Check storage and the connection (cable / Wi-Fi) and retry."),
    "no_device": ("وصّل السيارة (USB أو Wi-Fi) واختر الجهاز من صفحة الجهاز.", "Connect the car (USB or Wi-Fi) and select it on the Device page."),
    "unauthorized": ("وافق على طلب تصحيح USB الظاهر على شاشة السيارة ثم أعد المحاولة.", "Accept the USB debugging prompt on the car screen and retry."),
    "offline": ("افصل الكابل وأعد توصيله أو أعد تشغيل خادم ADB من صفحة الجهاز.", "Unplug/replug the cable or restart the ADB server from the Device page."),
    "timeout": ("انتهت المهلة. لملفات كبيرة استخدم USB بدل Wi-Fi، وراقب شاشة السيارة لأي نافذة تأكيد.", "Timed out. For large files use USB instead of Wi-Fi and watch the car screen for a confirmation prompt."),
}
GENERIC_HINT = (
    "لم يُتعرَّف على سبب محدد. انسخ المخرجات أدناه وشغّل «تشخيص» من صفحة الجهاز ثم صدّر التقرير. جرّب أيضاً وضع التوافق من خيارات التثبيت.",
    "No specific cause recognized. Copy the output below, run Diagnostics on the Device page and export the report. Also try compatibility mode in the install options.")


def hint_for(code: str, lang: str) -> str:
    pair = HINTS.get(code, GENERIC_HINT)
    return pair[0] if lang == "ar" else pair[1]


@dataclass
class ExplainedError:
    code: str
    ar: str
    en: str
    raw: str = ""

    def text(self, lang: str) -> str:
        return self.ar if lang == "ar" else self.en

    def hint(self, lang: str) -> str:
        return hint_for(self.code, lang)

    @property
    def definitive(self) -> bool:
        return self.code in DEFINITIVE_INSTALL_CODES


def parse_failure(output: str) -> Optional[ExplainedError]:
    """Find an INSTALL_FAILED_* / DELETE_FAILED_* code in adb output."""
    if not output:
        return None
    m = _FAILURE_RE.search(output)
    if m:
        code = m.group(1)
        ar, en = INSTALL_ERRORS.get(code, ("فشل التثبيت: " + code, "Install failed: " + code))
        return ExplainedError(code, ar, en, output.strip())
    return classify_device_error(output)


def classify_device_error(output: str) -> Optional[ExplainedError]:
    low = output.lower()
    key = None
    if "no devices/emulators found" in low or "device not found" in low or "no devices found" in low:
        key = "no_device"
    elif "unauthorized" in low:
        key = "unauthorized"
    elif "device offline" in low:
        key = "offline"
    elif "more than one device" in low:
        key = "multiple"
    elif "no permissions" in low or "insufficient permissions" in low:
        key = "no_permissions"
    elif "timed out" in low:
        key = "timeout"
    elif "executable not found" in low:
        key = "adb_missing"
    if key:
        ar, en = DEVICE_ERRORS[key]
        return ExplainedError(key, ar, en, output.strip())
    return None


def explain(output: str, lang: str = "en") -> str:
    e = parse_failure(output)
    if e:
        return e.text(lang)
    return output.strip()
