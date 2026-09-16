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


@dataclass
class ExplainedError:
    code: str
    ar: str
    en: str
    raw: str = ""

    def text(self, lang: str) -> str:
        return self.ar if lang == "ar" else self.en


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
