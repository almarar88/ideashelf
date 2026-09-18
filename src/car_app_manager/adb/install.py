"""APK / split bundle installation with automatic fallbacks and clear error reporting.

Methods, tried in order under "auto":
  1. streamed  - `adb install` / `adb install-multiple` (fast, needs a working `cmd package` on the unit)
  2. legacy    - `adb push` to /data/local/tmp then `pm install` (single) or a `pm install-create/write/commit`
                 session (splits). Works on many OEM head units where streamed installs fail.
After a reported success the package is verified with `pm path` when the package name is known.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from ..apk.bundle import BUNDLE_EXTENSIONS, extract_bundle, select_splits
from .errors import ExplainedError, parse_failure
from .runner import AdbRunner, AdbResult

METHODS = ("auto", "streamed", "legacy")
TMP_DIRS = ("/data/local/tmp", "/sdcard/Download")
_SESSION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class InstallOptions:
    reinstall: bool = True
    downgrade: bool = False
    grant_permissions: bool = False
    allow_test: bool = True
    method: str = "auto"
    verify: bool = True

    def pm_flags(self) -> list[str]:
        f: list[str] = []
        if self.reinstall:
            f.append("-r")
        if self.downgrade:
            f.append("-d")
        if self.grant_permissions:
            f.append("-g")
        if self.allow_test:
            f.append("-t")
        return f


@dataclass
class Attempt:
    method: str
    result: AdbResult
    note: str = ""

    @property
    def summary(self) -> str:
        return f"[{self.method}] $ {self.result.command}\n{self.result.output}".strip()


@dataclass
class InstallResult:
    success: bool
    path: str
    package: str = ""
    error: Optional[ExplainedError] = None
    raw: str = ""
    results: list[AdbResult] = field(default_factory=list)
    used_files: list[str] = field(default_factory=list)
    attempts: list[Attempt] = field(default_factory=list)
    method_used: str = ""
    verified: bool = False

    def message(self, lang: str) -> str:
        if self.success:
            m = "تم التثبيت بنجاح" if lang == "ar" else "Installed successfully"
            if self.method_used == "legacy":
                m += " (وضع التوافق)" if lang == "ar" else " (compatibility mode)"
            return m
        if self.error:
            return self.error.text(lang)
        return self.raw.strip() or ("فشل التثبيت" if lang == "ar" else "Install failed")

    def hint(self, lang: str) -> str:
        from .errors import hint_for
        return hint_for(self.error.code if self.error else "", lang)

    def transcript(self) -> str:
        return "\n\n".join(a.summary for a in self.attempts) or self.raw


def _looks_successful(r: AdbResult) -> bool:
    out = r.output
    if "Failure" in out or "FAILED" in out or "failed to" in out.lower():
        return False
    if "Success" in out:
        return True
    return r.ok and "error" not in out.lower()


class Installer:
    def __init__(self, runner: AdbRunner, device_abis: Optional[list[str]] = None, pm=None):
        self.runner = runner
        self.device_abis = device_abis or []
        self.pm = pm  # optional PackageManager for post-install verification

    # ---------------------------------------------------------------- public API
    def install(self, path: str | os.PathLike, reinstall: bool = True, downgrade: bool = False, grant_permissions: bool = False,
                package: str = "", progress: Optional[Callable[[str], None]] = None,
                options: Optional[InstallOptions] = None) -> InstallResult:
        opts = options or InstallOptions(reinstall=reinstall, downgrade=downgrade, grant_permissions=grant_permissions)
        p = Path(path)
        if p.suffix.lower() in BUNDLE_EXTENSIONS:
            res = self.install_bundle(p, package=package, progress=progress, options=opts)
        else:
            res = self.install_apk(p, package=package, options=opts)
        return res

    def install_apk(self, path: Path, reinstall=True, downgrade=False, grant_permissions=False, package="",
                    options: Optional[InstallOptions] = None) -> InstallResult:
        opts = options or InstallOptions(reinstall=reinstall, downgrade=downgrade, grant_permissions=grant_permissions)
        res = InstallResult(success=False, path=str(path), package=package, used_files=[str(path)])
        if opts.method in ("auto", "streamed"):
            self._streamed_single(path, opts, res)
            if res.success or (opts.method == "streamed") or (res.error and res.error.definitive):
                return self._verify(res, opts)
        self._legacy_single(path, opts, res)
        return self._verify(res, opts)

    def install_multiple(self, apks: list[Path], reinstall=True, downgrade=False, grant_permissions=False, package="", label="",
                         options: Optional[InstallOptions] = None) -> InstallResult:
        opts = options or InstallOptions(reinstall=reinstall, downgrade=downgrade, grant_permissions=grant_permissions)
        res = InstallResult(success=False, path=label or (str(apks[0]) if apks else ""), package=package, used_files=[str(a) for a in apks])
        if opts.method in ("auto", "streamed"):
            self._streamed_multi(apks, opts, res, label or package)
            if res.success or opts.method == "streamed" or (res.error and res.error.definitive):
                return self._verify(res, opts)
        self._legacy_session(apks, opts, res)
        return self._verify(res, opts)

    def install_bundle(self, path: Path, reinstall=True, downgrade=False, grant_permissions=False, package="",
                       progress: Optional[Callable[[str], None]] = None, options: Optional[InstallOptions] = None) -> InstallResult:
        opts = options or InstallOptions(reinstall=reinstall, downgrade=downgrade, grant_permissions=grant_permissions)
        try:
            bc = extract_bundle(path)
        except Exception as e:
            return InstallResult(False, str(path), package, ExplainedError(
                "BAD_BUNDLE", f"تعذّر فك الحزمة: {e}", f"Could not extract bundle: {e}"), raw=str(e))
        try:
            if not bc.apks:
                return InstallResult(False, str(path), package, ExplainedError(
                    "EMPTY_BUNDLE", "الحزمة لا تحتوي ملفات APK.", "The bundle contains no APK files."))
            chosen = select_splits(bc.apks, self.device_abis)
            if progress:
                progress(", ".join(a.name for a in chosen))
            pkg = package or bc.package
            if len(chosen) == 1:
                res = self.install_apk(chosen[0], package=pkg, options=opts)
            else:
                res = self.install_multiple(chosen, package=pkg, label=path.name, options=opts)
            res.path = str(path)
            if res.success and bc.obb_files and pkg:
                for local, rel in bc.obb_files:
                    if progress:
                        progress(f"OBB {rel}")
                    dest = "/sdcard/" + rel if not rel.startswith("/") else rel
                    self.runner.shell(f"mkdir -p {os.path.dirname(dest)}", action="mkdir obb", timeout=30)
                    pr = self.runner.run("push", str(local), dest, action=f"push obb {pkg}", timeout=1800)
                    res.results.append(pr)
                    res.attempts.append(Attempt("obb", pr))
            return res
        finally:
            bc.cleanup()

    # ---------------------------------------------------------------- streamed
    def _streamed_single(self, path: Path, opts: InstallOptions, res: InstallResult) -> None:
        args = ["install"] + opts.pm_flags() + [str(path)]
        r = self.runner.run(*args, action=f"install {path.name}", timeout=900)
        self._record(res, "streamed", r)

    def _streamed_multi(self, apks: list[Path], opts: InstallOptions, res: InstallResult, label: str) -> None:
        args = ["install-multiple"] + opts.pm_flags() + [str(a) for a in apks]
        r = self.runner.run(*args, action=f"install-multiple {label}", timeout=1200)
        self._record(res, "streamed", r)

    # ---------------------------------------------------------------- legacy (push + pm)
    def _push(self, local: Path, res: InstallResult, sub: str = "") -> Optional[str]:
        """Push a file to a temp dir on the device; returns the remote path or None."""
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", local.name)
        for base in TMP_DIRS:
            remote_dir = f"{base}/{sub}".rstrip("/") if sub else base
            if sub:
                self.runner.shell(f"mkdir -p {remote_dir}", action="mkdir tmp", timeout=30)
            remote = f"{remote_dir}/cam_{safe}"
            r = self.runner.run("push", str(local), remote, action=f"push {local.name}", timeout=1800)
            res.results.append(r)
            if r.ok and "error" not in r.output.lower():
                return remote
            res.attempts.append(Attempt("push", r, f"push to {base} failed"))
        return None

    def _legacy_single(self, path: Path, opts: InstallOptions, res: InstallResult) -> None:
        remote = self._push(path, res)
        if not remote:
            res.error = res.error or ExplainedError("PUSH_FAILED", "تعذّر نسخ الملف إلى الجهاز.", "Could not push the file to the device.")
            res.raw = res.transcript()
            return
        cmd = "pm install " + " ".join(opts.pm_flags()) + f" {remote}"
        r = self.runner.shell(cmd, action=f"pm install {path.name}", timeout=900)
        self._record(res, "legacy", r)
        self.runner.shell(f"rm -f {remote}", action="rm tmp", timeout=30)

    def _legacy_session(self, apks: list[Path], opts: InstallOptions, res: InstallResult) -> None:
        sub = "cam_split"
        remotes: list[tuple[str, Path]] = []
        for a in apks:
            remote = self._push(a, res, sub)
            if not remote:
                res.error = res.error or ExplainedError("PUSH_FAILED", "تعذّر نسخ الملفات إلى الجهاز.", "Could not push the files to the device.")
                res.raw = res.transcript()
                return
            remotes.append((remote, a))
        total = sum(a.stat().st_size for _r, a in remotes)
        r = self.runner.shell("pm install-create " + " ".join(opts.pm_flags()) + f" -S {total}", action="pm install-create", timeout=60)
        res.results.append(r)
        m = _SESSION_RE.search(r.output)
        if not r.ok or not m:
            self._record(res, "legacy", r)
            return
        session = m.group(1)
        ok = True
        for i, (remote, local) in enumerate(remotes):
            size = local.stat().st_size
            r = self.runner.shell(f"pm install-write -S {size} {session} {i}_{re.sub(r'[^A-Za-z0-9._-]', '_', local.name)} {remote}",
                                  action="pm install-write", timeout=900)
            res.results.append(r)
            res.attempts.append(Attempt("legacy", r))
            if not r.ok or "Success" not in r.output:
                ok = False
                break
        if ok:
            r = self.runner.shell(f"pm install-commit {session}", action="pm install-commit", timeout=900)
            self._record(res, "legacy", r)
        else:
            self.runner.shell(f"pm install-abandon {session}", action="pm install-abandon", timeout=60)
            res.error = res.error or parse_failure(res.transcript())
            res.raw = res.transcript()
        for base in TMP_DIRS:
            self.runner.shell(f"rm -rf {base}/{sub}", action="rm tmp", timeout=60)

    # ---------------------------------------------------------------- bookkeeping
    def _record(self, res: InstallResult, method: str, r: AdbResult) -> None:
        res.results.append(r)
        res.attempts.append(Attempt(method, r))
        if _looks_successful(r):
            res.success, res.method_used, res.error = True, method, None
        else:
            res.success = False
            res.error = parse_failure(r.output) or res.error
        res.raw = res.transcript()

    def _verify(self, res: InstallResult, opts: InstallOptions) -> InstallResult:
        if not res.success or not opts.verify or not res.package:
            return res
        r = self.runner.shell(f"pm path {res.package}", action="verify install", timeout=30)
        res.results.append(r)
        if r.ok and "package:" in r.stdout:
            res.verified = True
        else:
            res.success = False
            res.error = ExplainedError("NOT_FOUND_AFTER_INSTALL",
                                       "أبلغ النظام بالنجاح لكن التطبيق غير موجود على الجهاز.",
                                       "The system reported success but the app is not present on the device.", r.output)
            res.attempts.append(Attempt("verify", r, "package missing after install"))
            res.raw = res.transcript()
        return res
