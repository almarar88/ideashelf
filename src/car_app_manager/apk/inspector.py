"""Static APK inspection (androguard) + compatibility checks against the device."""
from __future__ import annotations

import hashlib
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

# Android "dangerous" protection-level permissions (runtime permissions).
DANGEROUS_PERMISSIONS: frozenset[str] = frozenset({
    "android.permission.READ_CALENDAR", "android.permission.WRITE_CALENDAR",
    "android.permission.CAMERA",
    "android.permission.READ_CONTACTS", "android.permission.WRITE_CONTACTS", "android.permission.GET_ACCOUNTS",
    "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_PHONE_STATE", "android.permission.READ_PHONE_NUMBERS", "android.permission.CALL_PHONE",
    "android.permission.ANSWER_PHONE_CALLS", "android.permission.READ_CALL_LOG", "android.permission.WRITE_CALL_LOG",
    "android.permission.ADD_VOICEMAIL", "android.permission.USE_SIP", "android.permission.PROCESS_OUTGOING_CALLS",
    "android.permission.BODY_SENSORS", "android.permission.ACTIVITY_RECOGNITION",
    "android.permission.SEND_SMS", "android.permission.RECEIVE_SMS", "android.permission.READ_SMS",
    "android.permission.RECEIVE_WAP_PUSH", "android.permission.RECEIVE_MMS",
    "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.MANAGE_EXTERNAL_STORAGE", "android.permission.ACCESS_MEDIA_LOCATION",
    "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO", "android.permission.READ_MEDIA_AUDIO",
    "android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_ADVERTISE",
    "android.permission.NEARBY_WIFI_DEVICES", "android.permission.POST_NOTIFICATIONS", "android.permission.UWB_RANGING",
    "android.permission.SYSTEM_ALERT_WINDOW", "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.BIND_DEVICE_ADMIN", "android.permission.BIND_ACCESSIBILITY_SERVICE",
})

ABI_SPLIT_NAMES = {"armeabi_v7a": "armeabi-v7a", "arm64_v8a": "arm64-v8a", "x86": "x86", "x86_64": "x86_64",
                   "armeabi-v7a": "armeabi-v7a", "arm64-v8a": "arm64-v8a"}


@dataclass
class ApkInfo:
    path: str
    size: int = 0
    sha256: str = ""
    package: str = ""
    label: str = ""
    version_name: str = ""
    version_code: int = 0
    min_sdk: int = 0
    target_sdk: int = 0
    max_sdk: int = 0
    permissions: list[str] = field(default_factory=list)
    native_abis: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    receivers: list[str] = field(default_factory=list)
    activities: list[str] = field(default_factory=list)
    providers: list[str] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    is_split: bool = False
    split_name: str = ""
    signed: bool = True
    parse_error: str = ""

    @property
    def dangerous_permissions(self) -> list[str]:
        return [p for p in self.permissions if p in DANGEROUS_PERMISSIONS]

    @property
    def name(self) -> str:
        return os.path.basename(self.path)


@dataclass
class Check:
    level: str  # ok | warn | error
    key: str
    ar: str
    en: str

    def text(self, lang: str) -> str:
        return self.ar if lang == "ar" else self.en


def sha256_file(path: str | os.PathLike, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def _native_abis_from_files(files: list[str]) -> list[str]:
    abis = set()
    for f in files:
        if f.startswith("lib/"):
            parts = f.split("/")
            if len(parts) >= 3:
                abis.add(parts[1])
    return sorted(abis)


APK_SIG_BLOCK_MAGIC = b"APK Sig Block 42"


def is_signed_zip(z: "zipfile.ZipFile", raw: bytes) -> bool:
    """v1: META-INF/*.RSA|DSA|EC ; v2/v3: 'APK Sig Block 42' just before the central directory."""
    for n in z.namelist():
        if n.upper().startswith("META-INF/") and n.upper().endswith((".RSA", ".DSA", ".EC")):
            return True
    # the signing block ends 16 bytes before the central directory start; search the tail region
    return APK_SIG_BLOCK_MAGIC in raw


def inspect_apk(path: str | os.PathLike) -> ApkInfo:
    """Dependency-free inspection (own AXML parser). androguard is used only opportunistically for the label."""
    import zipfile
    from .axml import parse_manifest

    p = Path(path)
    info = ApkInfo(path=str(p), size=p.stat().st_size if p.exists() else 0)
    try:
        info.sha256 = sha256_file(p)
    except OSError as e:
        info.parse_error = str(e)
        return info
    try:
        with zipfile.ZipFile(p) as z:
            names = z.namelist()
            manifest = parse_manifest(z.read("AndroidManifest.xml"))
            info.native_abis = _native_abis_from_files(names)
            # signature: look at the last 64 KB before the central directory for the v2/v3 block magic
            with open(p, "rb") as f:
                f.seek(max(0, info.size - 2 * 1024 * 1024))
                tail = f.read()
            info.signed = is_signed_zip(z, tail)
    except KeyError:
        info.parse_error = "AndroidManifest.xml missing (not an APK)"
        return info
    except (zipfile.BadZipFile, OSError, ValueError) as e:
        info.parse_error = f"{type(e).__name__}: {e}"
        log.warning("APK parse failed for %s: %s", p, info.parse_error)
        return info
    info.package = manifest.package
    info.label = manifest.label
    info.version_name = manifest.version_name
    info.version_code = manifest.version_code
    info.min_sdk, info.target_sdk, info.max_sdk = manifest.min_sdk, manifest.target_sdk, manifest.max_sdk
    info.permissions = sorted(set(manifest.permissions))
    info.services, info.receivers = manifest.services, manifest.receivers
    info.activities, info.providers = manifest.activities, manifest.providers
    info.features = manifest.features
    if manifest.split:
        info.is_split, info.split_name = True, manifest.split
    if not info.label:
        info.label = _label_via_androguard(p)
    return info


def _label_via_androguard(p: Path) -> str:
    """Best effort only: resolving a @string label needs resources.arsc, which androguard can read."""
    try:
        try:
            from loguru import logger as _loguru
            _loguru.disable("androguard")
        except Exception:
            pass
        from androguard.core.apk import APK
        return str(APK(str(p)).get_app_name() or "")
    except Exception as e:  # noqa: BLE001 - optional feature
        log.info("label lookup via androguard unavailable: %s", e)
        return ""


def _to_int(v) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def abi_compatible(apk_abis: list[str], device_abis: list[str]) -> bool:
    """No native libs => compatible. Otherwise at least one shared ABI."""
    if not apk_abis:
        return True
    if not device_abis:
        return True  # unknown device -> don't block
    return bool(set(apk_abis) & set(device_abis))


def check_compatibility(
    info: ApkInfo,
    device_sdk: int,
    device_abis: list[str],
    installed_version: Optional[tuple[str, int]] = None,
) -> list[Check]:
    checks: list[Check] = []
    if info.parse_error:
        checks.append(Check("warn", "parse", "تعذّر قراءة الحزمة بالكامل: " + info.parse_error,
                            "Could not fully parse the APK: " + info.parse_error))
        return checks
    if not info.package:
        checks.append(Check("error", "no_package", "لا يوجد اسم حزمة في الملف.", "No package name found."))
    if device_sdk and info.min_sdk and info.min_sdk > device_sdk:
        checks.append(Check("error", "min_sdk",
                            f"يتطلب API {info.min_sdk} والجهاز على API {device_sdk}.",
                            f"Requires API {info.min_sdk}; device is API {device_sdk}."))
    else:
        checks.append(Check("ok", "min_sdk", f"الحد الأدنى API {info.min_sdk or '?'} متوافق.",
                            f"minSdk {info.min_sdk or '?'} is compatible."))
    if device_sdk and info.max_sdk and info.max_sdk < device_sdk:
        checks.append(Check("error", "max_sdk", f"الحد الأقصى API {info.max_sdk} أقل من الجهاز.",
                            f"maxSdk {info.max_sdk} is below the device API."))
    if info.native_abis:
        if abi_compatible(info.native_abis, device_abis):
            checks.append(Check("ok", "abi", "المكتبات الأصلية متوافقة: " + ", ".join(info.native_abis),
                                "Native libraries compatible: " + ", ".join(info.native_abis)))
        else:
            checks.append(Check("error", "abi",
                                f"لا تتوافق المعمارية ({', '.join(info.native_abis)}) مع الجهاز ({', '.join(device_abis)}).",
                                f"ABI mismatch: APK has {', '.join(info.native_abis)}, device supports {', '.join(device_abis)}."))
    else:
        checks.append(Check("ok", "abi", "لا توجد مكتبات أصلية (يعمل على أي معمارية).", "No native libraries (any ABI)."))
    d = info.dangerous_permissions
    if d:
        checks.append(Check("warn", "permissions", f"{len(d)} أذونات حساسة: " + ", ".join(x.rsplit('.', 1)[-1] for x in d),
                            f"{len(d)} dangerous permissions: " + ", ".join(x.rsplit('.', 1)[-1] for x in d)))
    else:
        checks.append(Check("ok", "permissions", "لا توجد أذونات حساسة.", "No dangerous permissions."))
    if not info.signed:
        checks.append(Check("error", "signature", "الحزمة غير موقّعة.", "APK is not signed."))
    if installed_version is not None:
        iv_name, iv_code = installed_version
        if info.version_code > iv_code:
            checks.append(Check("warn", "update", f"تحديث: المثبّت {iv_name} ({iv_code}) ← الجديد {info.version_name} ({info.version_code}).",
                                f"Update: installed {iv_name} ({iv_code}) -> new {info.version_name} ({info.version_code})."))
        elif info.version_code == iv_code:
            checks.append(Check("warn", "same_version", f"نفس النسخة مثبّتة ({iv_name}). سيُعاد التثبيت.",
                                f"Same version already installed ({iv_name}). It will be reinstalled."))
        else:
            checks.append(Check("warn", "downgrade", f"النسخة أقدم من المثبّتة ({iv_name} / {iv_code}). يلزم السماح بالرجوع.",
                                f"Older than installed ({iv_name} / {iv_code}). Downgrade must be allowed."))
    return checks


def worst_level(checks: list[Check]) -> str:
    if any(c.level == "error" for c in checks):
        return "error"
    if any(c.level == "warn" for c in checks):
        return "warn"
    return "ok"


SPLIT_ABI_RE = re.compile(r"(?:^|[._-])(?:config\.)?(armeabi_v7a|arm64_v8a|x86_64|x86|armeabi-v7a|arm64-v8a)(?:\.apk)?$")
