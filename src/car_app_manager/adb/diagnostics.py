"""Device diagnostics: explains WHY installs fail on a given head unit and offers reversible fixes."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from .device import parse_df, parse_getprop
from .runner import AdbRunner

_SESSION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class DiagItem:
    key: str
    level: str  # ok | warn | error | info
    ar: str
    en: str
    raw: str = ""

    def text(self, lang: str) -> str:
        return self.ar if lang == "ar" else self.en


@dataclass
class DiagReport:
    items: list[DiagItem] = field(default_factory=list)

    def add(self, key: str, level: str, ar: str, en: str, raw: str = "") -> None:
        self.items.append(DiagItem(key, level, ar, en, raw))

    @property
    def worst(self) -> str:
        if any(i.level == "error" for i in self.items):
            return "error"
        if any(i.level == "warn" for i in self.items):
            return "warn"
        return "ok"

    def to_text(self, lang: str) -> str:
        lines = []
        for i in self.items:
            mark = {"ok": "OK  ", "warn": "WARN", "error": "ERR ", "info": "INFO"}[i.level]
            lines.append(f"[{mark}] {i.key}: {i.text(lang)}")
            if i.raw.strip():
                lines.append("       " + i.raw.strip().replace("\n", "\n       "))
        return "\n".join(lines)


VERIFIER_KEYS = ("verifier_verify_adb_installs", "package_verifier_enable")


def run_diagnostics(runner: AdbRunner, adb_path: str, progress: Optional[Callable[[str], None]] = None) -> DiagReport:
    rep = DiagReport()

    def step(name: str):
        if progress:
            progress(name)

    step("adb")
    r = runner.run("version", use_serial=False, timeout=15, action="diag adb version")
    if r.ok:
        rep.add("adb", "ok", "adb يعمل: " + r.stdout.strip().splitlines()[0], "adb works: " + r.stdout.strip().splitlines()[0])
    else:
        rep.add("adb", "error", "adb لا يعمل من المسار: " + adb_path, "adb does not run from: " + adb_path, r.output)
        return rep

    step("device")
    r = runner.shell("echo ok", timeout=20, action="diag shell")
    if not r.ok or "ok" not in r.stdout:
        rep.add("shell", "error", "لا يمكن تنفيذ أوامر على الجهاز (غير متصل أو غير مصرّح).",
                "Cannot run commands on the device (not connected or unauthorized).", r.output)
        return rep
    rep.add("shell", "ok", "الجهاز يستجيب لأوامر shell.", "Device answers shell commands.")

    step("props")
    props: dict[str, str] = {}
    r = runner.shell("getprop", timeout=20, action="diag getprop")
    if r.ok:
        props = parse_getprop(r.stdout)
        rep.add("build", "info",
                f"{props.get('ro.product.model', '?')} — Android {props.get('ro.build.version.release', '?')} (API {props.get('ro.build.version.sdk', '?')}), "
                f"ABI: {props.get('ro.product.cpu.abilist', '?')}, build: {props.get('ro.build.type', '?')}",
                f"{props.get('ro.product.model', '?')} — Android {props.get('ro.build.version.release', '?')} (API {props.get('ro.build.version.sdk', '?')}), "
                f"ABI: {props.get('ro.product.cpu.abilist', '?')}, build: {props.get('ro.build.type', '?')}")

    step("storage")
    r = runner.shell("df -k /data", timeout=20, action="diag df")
    total, free = parse_df(r.stdout) if r.ok else (0, 0)
    if total:
        mb = free // (1024 * 1024)
        rep.add("storage", "warn" if mb < 500 else "ok", f"المساحة الحرة في /data: {mb} م.ب", f"Free space in /data: {mb} MB")

    step("users")
    r = runner.shell("pm list users", timeout=20, action="diag users")
    if r.ok and r.stdout.strip():
        users = re.findall(r"UserInfo\{(\d+):([^:]*):", r.stdout)
        cur = runner.shell("am get-current-user", timeout=15, action="diag current user")
        cur_id = cur.stdout.strip() if cur.ok else "?"
        level = "warn" if (len(users) > 1 and cur_id not in ("0", "?")) else "info"
        rep.add("users", level, f"المستخدمون: {', '.join(f'{i} ({n})' for i, n in users)}; الحالي: {cur_id}",
                f"Users: {', '.join(f'{i} ({n})' for i, n in users)}; current: {cur_id}", r.stdout.strip())

    step("verifier")
    for key in VERIFIER_KEYS:
        r = runner.shell(f"settings get global {key}", timeout=15, action=f"diag {key}")
        val = r.stdout.strip() if r.ok else "?"
        on = val not in ("0", "null", "")
        rep.add(key, "info" if not on else "warn",
                f"{key} = {val}" + (" (التحقق من تثبيتات ADB مفعّل؛ قد يرفض تطبيقات غير معروفة)" if on else ""),
                f"{key} = {val}" + (" (verification of ADB installs is on; may reject unknown apps)" if on else ""))

    step("tmp")
    r = runner.shell("touch /data/local/tmp/cam_diag && rm -f /data/local/tmp/cam_diag && echo writable", timeout=20, action="diag tmp")
    ok = r.ok and "writable" in r.stdout
    rep.add("tmp", "ok" if ok else "warn", "/data/local/tmp قابل للكتابة (وضع التوافق متاح)." if ok else "/data/local/tmp غير قابل للكتابة؛ سيُستخدم /sdcard/Download.",
            "/data/local/tmp is writable (compatibility mode available)." if ok else "/data/local/tmp not writable; /sdcard/Download will be used.", r.output if not ok else "")

    step("pm session")
    r = runner.shell("pm install-create -r -t", timeout=30, action="diag install-create")
    m = _SESSION_RE.search(r.output)
    if r.ok and m:
        runner.shell(f"pm install-abandon {m.group(1)}", timeout=30, action="diag install-abandon")
        rep.add("pm_session", "ok", "مدير الحزم يقبل جلسات التثبيت.", "Package manager accepts install sessions.")
    else:
        rep.add("pm_session", "error", "مدير الحزم رفض إنشاء جلسة تثبيت. هذا هو سبب فشل التثبيت غالباً.",
                "Package manager refused to create an install session. This is likely why installs fail.", r.output)

    step("cmd package")
    r = runner.shell("cmd package help", timeout=20, action="diag cmd package")
    ok = r.ok and ("install" in r.stdout)
    rep.add("cmd_package", "ok" if ok else "warn", "أمر cmd package متاح (التثبيت المتدفق مدعوم)." if ok else "cmd package غير متاح؛ سيعتمد البرنامج على وضع التوافق.",
            "cmd package available (streamed install supported)." if ok else "cmd package unavailable; the tool will rely on compatibility mode.", "" if ok else r.output)

    step("features")
    r = runner.run("features", timeout=15, action="diag features")
    if r.ok:
        feats = ",".join(f.strip() for f in r.stdout.split())
        rep.add("features", "info", "ميزات ADB: " + feats, "ADB features: " + feats)

    step("protection apps")
    r = runner.shell("pm list packages", timeout=60, action="diag packages")
    if r.ok:
        sus = [l.split(":", 1)[-1] for l in r.stdout.splitlines() if any(k in l.lower() for k in ("guard", "protect", "installmonitor", "appmonitor", "whitelist", "secur", "safe"))]
        if sus:
            rep.add("guards", "warn", "حزم قد تراقب أو تحذف التطبيقات المثبّتة خارجياً: " + ", ".join(sus[:8]),
                    "Packages that may monitor or remove sideloaded apps: " + ", ".join(sus[:8]))
    return rep


def set_adb_verification(runner: AdbRunner, enabled: bool) -> list[str]:
    """Reversible: toggles the two global settings that make the system verify ADB installs. Returns outputs."""
    outs = []
    for key in VERIFIER_KEYS:
        r = runner.shell(f"settings put global {key} {1 if enabled else 0}", timeout=15, action=f"settings {key}={1 if enabled else 0}")
        outs.append(f"{key}: {r.output or ('ok' if r.ok else 'failed')}")
    return outs
