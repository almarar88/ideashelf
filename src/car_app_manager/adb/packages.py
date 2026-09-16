"""Package listing and per-app actions. Protected packages are refused here, not only in the UI."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from .errors import parse_failure
from .protection import assert_modifiable, is_protected
from .runner import AdbRunner, AdbResult


@dataclass
class AppInfo:
    package: str
    label: str = ""
    version_name: str = ""
    version_code: int = 0
    apk_paths: list[str] = field(default_factory=list)
    size_bytes: int = 0
    is_system: bool = False
    protected: bool = False
    first_install: str = ""
    last_update: str = ""
    installed_by_us: bool = False

    @property
    def display_name(self) -> str:
        return self.label or self.package


def parse_package_list(output: str) -> list[str]:
    pkgs = []
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("package:"):
            pkgs.append(line[len("package:"):].strip())
    return pkgs


def parse_pm_path(output: str) -> list[str]:
    return parse_package_list(output)


def parse_dumpsys_package(output: str) -> dict[str, str]:
    info: dict[str, str] = {}
    for key in ("versionName", "versionCode", "firstInstallTime", "lastUpdateTime", "codePath", "primaryCpuAbi", "userId"):
        m = re.search(rf"^\s*{key}=(\S+)", output, re.MULTILINE)
        if m:
            info[key] = m.group(1)
    m = re.search(r"versionCode=(\d+)", output)
    if m:
        info["versionCode"] = m.group(1)
    return info


def parse_stat_sizes(output: str) -> dict[str, int]:
    """Parse `stat -c '%s %n' f1 f2` output -> {path: size}."""
    sizes: dict[str, int] = {}
    for line in output.splitlines():
        parts = line.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].isdigit():
            sizes[parts[1]] = int(parts[0])
    return sizes


class PackageManager:
    def __init__(self, runner: AdbRunner):
        self.runner = runner
        self._system_cache: Optional[set[str]] = None

    # ---- listing -------------------------------------------------------------
    def list_system_packages(self, refresh: bool = False) -> set[str]:
        if self._system_cache is None or refresh:
            r = self.runner.shell("pm list packages -s", action="list system packages", timeout=60)
            self._system_cache = set(parse_package_list(r.stdout)) if r.ok else set()
        return self._system_cache

    def list_user_packages(self) -> list[str]:
        r = self.runner.shell("pm list packages -3", action="list user packages", timeout=60)
        return sorted(parse_package_list(r.stdout)) if r.ok else []

    def is_installed(self, package: str) -> bool:
        r = self.runner.shell(f"pm path {package}", action="pm path", timeout=30)
        return r.ok and bool(parse_pm_path(r.stdout))

    def get_installed_version(self, package: str) -> Optional[tuple[str, int]]:
        r = self.runner.shell(f"dumpsys package {package}", action="dumpsys package", timeout=30)
        if not r.ok:
            return None
        d = parse_dumpsys_package(r.stdout)
        if "versionCode" not in d and "versionName" not in d:
            return None
        try:
            vc = int(d.get("versionCode", "0"))
        except ValueError:
            vc = 0
        return d.get("versionName", ""), vc

    def get_app_info(self, package: str, system_packages: Optional[set[str]] = None) -> AppInfo:
        sys_pkgs = system_packages if system_packages is not None else self.list_system_packages()
        app = AppInfo(package=package, is_system=package in sys_pkgs, protected=is_protected(package, sys_pkgs))
        r = self.runner.shell(f"dumpsys package {package}", action="dumpsys package", timeout=30)
        if r.ok:
            d = parse_dumpsys_package(r.stdout)
            app.version_name = d.get("versionName", "")
            try:
                app.version_code = int(d.get("versionCode", "0"))
            except ValueError:
                app.version_code = 0
            app.first_install = d.get("firstInstallTime", "")
            app.last_update = d.get("lastUpdateTime", "")
        r = self.runner.shell(f"pm path {package}", action="pm path", timeout=30)
        if r.ok:
            app.apk_paths = parse_pm_path(r.stdout)
        return app

    def list_user_apps(self, progress: Optional[Callable[[int, int, str], None]] = None) -> list[AppInfo]:
        sys_pkgs = self.list_system_packages(refresh=True)
        pkgs = self.list_user_packages()
        apps: list[AppInfo] = []
        for i, pkg in enumerate(pkgs):
            if progress:
                progress(i, len(pkgs), pkg)
            apps.append(self.get_app_info(pkg, sys_pkgs))
        self.fill_sizes(apps)
        return apps

    def fill_sizes(self, apps: list[AppInfo]) -> None:
        paths = [p for a in apps for p in a.apk_paths]
        if not paths:
            return
        sizes: dict[str, int] = {}
        # keep command lines reasonable
        for i in range(0, len(paths), 40):
            chunk = paths[i:i + 40]
            r = self.runner.shell("stat -c '%s %n' " + " ".join(chunk), action="apk sizes", timeout=60)
            if r.ok:
                sizes.update(parse_stat_sizes(r.stdout))
        for a in apps:
            a.size_bytes = sum(sizes.get(p, 0) for p in a.apk_paths)

    # ---- actions -------------------------------------------------------------
    def launch(self, package: str) -> AdbResult:
        r = self.runner.shell(f"cmd package resolve-activity --brief {package}", action="resolve activity", timeout=20)
        component = ""
        if r.ok:
            lines = [l.strip() for l in r.stdout.splitlines() if "/" in l and not l.strip().startswith("priority")]
            if lines:
                component = lines[-1]
        if component and component != "No activity found":
            return self.runner.shell(f"am start -n {component}", action=f"launch {package}", timeout=30)
        return self.runner.shell(
            f"monkey -p {package} -c android.intent.category.LAUNCHER 1", action=f"launch {package}", timeout=30
        )

    def force_stop(self, package: str) -> AdbResult:
        assert_modifiable(package, self.list_system_packages())
        return self.runner.shell(f"am force-stop {package}", action=f"force-stop {package}", timeout=30)

    def clear_data(self, package: str) -> AdbResult:
        assert_modifiable(package, self.list_system_packages())
        return self.runner.shell(f"pm clear {package}", action=f"clear data {package}", timeout=60)

    def uninstall(self, package: str, keep_data: bool = False) -> AdbResult:
        assert_modifiable(package, self.list_system_packages())
        args = ["uninstall"] + (["-k"] if keep_data else []) + [package]
        r = self.runner.run(*args, action=f"uninstall {package}", timeout=120)
        if r.ok and "Success" not in r.stdout:
            r.returncode = 1
        if not r.ok:
            e = parse_failure(r.output)
            if e:
                r.extra["explained"] = e
        return r

    def export_apk(self, package: str, dest_dir: str | os.PathLike, apk_paths: Optional[list[str]] = None) -> list[Path]:
        """Pull every APK (base + splits) of a package into dest_dir/<package>/."""
        paths = apk_paths or []
        if not paths:
            r = self.runner.shell(f"pm path {package}", action="pm path", timeout=30)
            paths = parse_pm_path(r.stdout) if r.ok else []
        out_dir = Path(dest_dir) / package
        out_dir.mkdir(parents=True, exist_ok=True)
        pulled: list[Path] = []
        for p in paths:
            name = Path(p).name
            if name == "base.apk" and len(paths) == 1:
                name = f"{package}.apk"
            target = out_dir / name
            r = self.runner.run("pull", p, str(target), action=f"pull {package}", timeout=600)
            if r.ok and target.exists():
                pulled.append(target)
        return pulled
