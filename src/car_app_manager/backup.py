"""Backup (export list + APKs to a dated folder) and selective restore."""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from .adb.install import Installer, InstallResult
from .adb.packages import AppInfo, PackageManager
from .apk.inspector import sha256_file

MANIFEST_NAME = "apps.json"


@dataclass
class BackupEntry:
    package: str
    label: str = ""
    version_name: str = ""
    version_code: int = 0
    files: list[str] = field(default_factory=list)  # relative to backup folder
    size_bytes: int = 0
    sha256: dict[str, str] = field(default_factory=dict)  # relative file -> sha256


@dataclass
class Backup:
    folder: Path
    created: str
    device: str
    entries: list[BackupEntry]

    @property
    def name(self) -> str:
        return self.folder.name


def new_backup_folder(root: str | Path, device_model: str = "") -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    suffix = ("_" + "".join(c for c in device_model if c.isalnum() or c in "-_")) if device_model else ""
    p = Path(root) / f"backup_{stamp}{suffix}"
    p.mkdir(parents=True, exist_ok=False)
    return p


def create_backup(
    pm: PackageManager,
    root: str | Path,
    apps: list[AppInfo],
    device: str = "",
    device_model: str = "",
    progress: Optional[Callable[[int, int, str], None]] = None,
) -> Backup:
    folder = new_backup_folder(root, device_model)
    entries: list[BackupEntry] = []
    for i, app in enumerate(apps):
        if progress:
            progress(i, len(apps), app.package)
        pulled = pm.export_apk(app.package, folder, app.apk_paths)
        entries.append(BackupEntry(
            package=app.package, label=app.label, version_name=app.version_name, version_code=app.version_code,
            files=[p.relative_to(folder).as_posix() for p in pulled],
            size_bytes=sum(p.stat().st_size for p in pulled),
            sha256={p.relative_to(folder).as_posix(): sha256_file(p) for p in pulled},
        ))
    b = Backup(folder=folder, created=datetime.now().isoformat(timespec="seconds"), device=device, entries=entries)
    write_manifest(b)
    return b


def write_manifest(b: Backup) -> None:
    data = {"created": b.created, "device": b.device, "apps": [asdict(e) for e in b.entries]}
    (b.folder / MANIFEST_NAME).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_backup(folder: str | Path) -> Optional[Backup]:
    folder = Path(folder)
    mf = folder / MANIFEST_NAME
    if not mf.exists():
        return None
    try:
        data = json.loads(mf.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    entries = [BackupEntry(**{k: v for k, v in e.items() if k in BackupEntry.__dataclass_fields__}) for e in data.get("apps", [])]
    return Backup(folder=folder, created=str(data.get("created", "")), device=str(data.get("device", "")), entries=entries)


def list_backups(root: str | Path) -> list[Backup]:
    root = Path(root)
    if not root.exists():
        return []
    out = []
    for d in sorted(root.iterdir(), reverse=True):
        if d.is_dir():
            b = load_backup(d)
            if b:
                out.append(b)
    return out


def restore(
    installer: Installer,
    backup: Backup,
    packages: list[str],
    progress: Optional[Callable[[int, int, str], None]] = None,
) -> list[InstallResult]:
    results: list[InstallResult] = []
    wanted = set(packages)
    todo = [e for e in backup.entries if e.package in wanted]
    for i, e in enumerate(todo):
        if progress:
            progress(i, len(todo), e.package)
        files = [backup.folder / f for f in e.files if (backup.folder / f).exists()]
        if not files:
            from .adb.errors import ExplainedError
            results.append(InstallResult(False, e.package, e.package, ExplainedError(
                "MISSING_FILES", "ملفات APK غير موجودة في النسخة الاحتياطية.", "APK files missing from the backup.")))
            continue
        if len(files) == 1:
            r = installer.install_apk(files[0], reinstall=True, downgrade=True, package=e.package)
        else:
            r = installer.install_multiple(files, reinstall=True, downgrade=True, package=e.package, label=e.package)
        results.append(r)
    return results
