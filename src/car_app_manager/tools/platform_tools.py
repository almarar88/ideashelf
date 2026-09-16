"""Locate or download Android SDK Platform-Tools (adb). Nothing is bundled with the app."""
from __future__ import annotations

import os
import shutil
import ssl
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable, Optional

from ..config import tools_dir

PLATFORM_TOOLS_URL = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
if sys.platform == "darwin":  # dev convenience only; the product targets Windows
    PLATFORM_TOOLS_URL = "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
elif sys.platform.startswith("linux"):
    PLATFORM_TOOLS_URL = "https://dl.google.com/android/repository/platform-tools-latest-linux.zip"

ADB_EXE = "adb.exe" if sys.platform == "win32" else "adb"


def managed_adb_path() -> Path:
    return tools_dir() / "platform-tools" / ADB_EXE


def find_adb(preferred: str = "") -> Optional[str]:
    """Order: user-configured path, managed download, PATH."""
    if preferred and Path(preferred).is_file():
        return str(Path(preferred))
    m = managed_adb_path()
    if m.is_file():
        return str(m)
    w = shutil.which("adb")
    return w


def verify_adb(path: str) -> Optional[str]:
    """Return the version string if `adb version` works, else None."""
    try:
        kw = {}
        if sys.platform == "win32":
            kw["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        out = subprocess.run([path, "version"], capture_output=True, timeout=20, **kw)
        if out.returncode == 0:
            return out.stdout.decode("utf-8", "replace").strip().splitlines()[0]
    except (OSError, subprocess.SubprocessError):
        return None
    return None


def download_file(url: str, dest: Path, progress: Optional[Callable[[int, int], None]] = None) -> Path:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "CarAppManager/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp, open(dest, "wb") as f:
        total = int(resp.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = resp.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if progress:
                progress(done, total)
    return dest


def extract_zip(zip_path: Path, dest_dir: Path) -> None:
    with zipfile.ZipFile(zip_path) as z:
        for m in z.infolist():
            name = m.filename
            if name.startswith("/") or ".." in name.split("/"):
                continue
            z.extract(m, dest_dir)
            # restore exec bit on posix (dev convenience)
            if os.name == "posix":
                mode = (m.external_attr >> 16) & 0o777
                if mode:
                    try:
                        os.chmod(dest_dir / name, mode | 0o700)
                    except OSError:
                        pass


def download_platform_tools(progress: Optional[Callable[[int, int], None]] = None,
                            url: str = PLATFORM_TOOLS_URL) -> str:
    """Download the official zip, extract into the tools dir and verify `adb version`."""
    dest_root = tools_dir()
    with tempfile.TemporaryDirectory(prefix="cam_pt_") as td:
        zpath = Path(td) / "platform-tools.zip"
        download_file(url, zpath, progress)
        if not zipfile.is_zipfile(zpath):
            raise RuntimeError("Downloaded file is not a valid zip archive")
        staging = Path(td) / "extract"
        staging.mkdir()
        extract_zip(zpath, staging)
        src = staging / "platform-tools"
        if not (src / ADB_EXE).exists():
            raise RuntimeError("adb executable not found inside the downloaded archive")
        target = dest_root / "platform-tools"
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        shutil.move(str(src), str(target))
    adb = str(target / ADB_EXE)
    if not verify_adb(adb):
        raise RuntimeError("adb was extracted but failed to run (`adb version`)")
    return adb
