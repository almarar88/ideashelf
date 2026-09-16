"""APK / split bundle installation with clear error reporting."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from ..apk.bundle import BUNDLE_EXTENSIONS, extract_bundle, select_splits
from .errors import ExplainedError, parse_failure
from .runner import AdbRunner, AdbResult


@dataclass
class InstallResult:
    success: bool
    path: str
    package: str = ""
    error: Optional[ExplainedError] = None
    raw: str = ""
    results: list[AdbResult] = field(default_factory=list)
    used_files: list[str] = field(default_factory=list)

    def message(self, lang: str) -> str:
        if self.success:
            return "تم التثبيت بنجاح" if lang == "ar" else "Installed successfully"
        if self.error:
            return self.error.text(lang)
        return self.raw.strip() or ("فشل التثبيت" if lang == "ar" else "Install failed")


class Installer:
    def __init__(self, runner: AdbRunner, device_abis: Optional[list[str]] = None):
        self.runner = runner
        self.device_abis = device_abis or []

    def _flags(self, reinstall: bool, downgrade: bool, grant_permissions: bool) -> list[str]:
        f: list[str] = []
        if reinstall:
            f.append("-r")
        if downgrade:
            f.append("-d")
        if grant_permissions:
            f.append("-g")
        return f

    def install(
        self,
        path: str | os.PathLike,
        reinstall: bool = True,
        downgrade: bool = False,
        grant_permissions: bool = False,
        package: str = "",
        progress: Optional[Callable[[str], None]] = None,
    ) -> InstallResult:
        p = Path(path)
        if p.suffix.lower() in BUNDLE_EXTENSIONS:
            return self.install_bundle(p, reinstall, downgrade, grant_permissions, package, progress)
        return self.install_apk(p, reinstall, downgrade, grant_permissions, package)

    def install_apk(self, path: Path, reinstall=True, downgrade=False, grant_permissions=False, package="") -> InstallResult:
        args = ["install"] + self._flags(reinstall, downgrade, grant_permissions) + [str(path)]
        r = self.runner.run(*args, action=f"install {path.name}", timeout=900)
        return self._to_result(r, str(path), package, [str(path)])

    def install_multiple(self, apks: list[Path], reinstall=True, downgrade=False, grant_permissions=False,
                         package="", label="") -> InstallResult:
        args = ["install-multiple"] + self._flags(reinstall, downgrade, grant_permissions) + [str(a) for a in apks]
        r = self.runner.run(*args, action=f"install-multiple {label or package}", timeout=1200)
        return self._to_result(r, label, package, [str(a) for a in apks])

    def install_bundle(self, path: Path, reinstall=True, downgrade=False, grant_permissions=False, package="",
                       progress: Optional[Callable[[str], None]] = None) -> InstallResult:
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
                res = self.install_apk(chosen[0], reinstall, downgrade, grant_permissions, pkg)
                res.path = str(path)
            else:
                res = self.install_multiple(chosen, reinstall, downgrade, grant_permissions, pkg, label=path.name)
                res.path = str(path)
            if res.success and bc.obb_files and pkg:
                for local, rel in bc.obb_files:
                    if progress:
                        progress(f"OBB {rel}")
                    dest = "/sdcard/" + rel if not rel.startswith("/") else rel
                    self.runner.shell(f"mkdir -p {os.path.dirname(dest)}", action="mkdir obb", timeout=30)
                    pr = self.runner.run("push", str(local), dest, action=f"push obb {pkg}", timeout=1800)
                    res.results.append(pr)
            return res
        finally:
            bc.cleanup()

    @staticmethod
    def _to_result(r: AdbResult, path: str, package: str, used: list[str]) -> InstallResult:
        out = r.output
        success = r.ok and ("Success" in out or "Performing" in out and "Failure" not in out)
        if r.ok and "Success" not in out and "Failure" not in out and "FAILED" not in out and "error" not in out.lower():
            success = True  # newer adb prints nothing on success in some modes
        res = InstallResult(success=success, path=path, package=package, raw=out, results=[r], used_files=used)
        if not success:
            res.error = parse_failure(out)
        return res
