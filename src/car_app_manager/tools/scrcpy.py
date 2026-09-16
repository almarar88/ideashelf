"""scrcpy (Apache-2.0): locate, download the official Windows release from GitHub, launch."""
from __future__ import annotations

import json
import os
import re
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
from .platform_tools import download_file, extract_zip

RELEASES_API = "https://api.github.com/repos/Genymobile/scrcpy/releases/latest"
RELEASES_PAGE = "https://github.com/Genymobile/scrcpy/releases/latest"
SCRCPY_EXE = "scrcpy.exe" if sys.platform == "win32" else "scrcpy"
_WIN_ASSET_RE = re.compile(r"^scrcpy-win64-v[\w.\-]+\.zip$")


def managed_scrcpy_path() -> Path:
    return tools_dir() / "scrcpy" / SCRCPY_EXE


def find_scrcpy(preferred: str = "") -> Optional[str]:
    if preferred and Path(preferred).is_file():
        return str(Path(preferred))
    m = managed_scrcpy_path()
    if m.is_file():
        return str(m)
    return shutil.which("scrcpy")


def pick_windows_asset(release_json: dict) -> tuple[str, str]:
    """Return (name, browser_download_url) of the win64 zip in a GitHub release JSON."""
    for a in release_json.get("assets", []):
        name = str(a.get("name", ""))
        if _WIN_ASSET_RE.match(name):
            return name, str(a.get("browser_download_url", ""))
    raise RuntimeError("no scrcpy-win64 zip asset in the latest release")


def _fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "CarAppManager/1.0", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _asset_from_release_page() -> tuple[str, str]:
    """Fallback without the API: follow the /releases/latest redirect to learn the tag."""
    req = urllib.request.Request(RELEASES_PAGE, headers={"User-Agent": "CarAppManager/1.0"}, method="HEAD")
    with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as resp:
        final = resp.geturl()
    tag = final.rstrip("/").rsplit("/", 1)[-1]
    if not tag.startswith("v"):
        raise RuntimeError("could not determine the latest scrcpy version")
    name = f"scrcpy-win64-{tag}.zip"
    return name, f"https://github.com/Genymobile/scrcpy/releases/download/{tag}/{name}"


def download_scrcpy(progress: Optional[Callable[[int, int], None]] = None) -> str:
    try:
        name, url = pick_windows_asset(_fetch_json(RELEASES_API))
    except Exception:
        name, url = _asset_from_release_page()
    dest_root = tools_dir()
    with tempfile.TemporaryDirectory(prefix="cam_scrcpy_") as td:
        zpath = Path(td) / name
        download_file(url, zpath, progress)
        if not zipfile.is_zipfile(zpath):
            raise RuntimeError("Downloaded file is not a valid zip archive")
        staging = Path(td) / "x"
        staging.mkdir()
        extract_zip(zpath, staging)
        exe = next(staging.rglob("scrcpy.exe"), None) or next(staging.rglob("scrcpy"), None)
        if exe is None:
            raise RuntimeError("scrcpy executable not found inside the archive")
        target = dest_root / "scrcpy"
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        shutil.move(str(exe.parent), str(target))
    return str(target / exe.name)


def build_scrcpy_command(
    scrcpy_path: str,
    serial: Optional[str],
    window_title: str = "Car App Manager",
    max_size: int = 1280,
    bit_rate_mbps: int = 8,
    max_fps: int = 30,
    always_on_top: bool = False,
    no_audio: bool = True,
    record_file: str = "",
    stay_awake: bool = False,
) -> list[str]:
    cmd = [scrcpy_path]
    if serial:
        cmd += ["--serial", serial]
    cmd += ["--window-title", window_title]
    if max_size:
        cmd += ["--max-size", str(max_size)]
    if bit_rate_mbps:
        cmd += ["--video-bit-rate", f"{bit_rate_mbps}M"]
    if max_fps:
        cmd += ["--max-fps", str(max_fps)]
    if always_on_top:
        cmd.append("--always-on-top")
    if no_audio:
        cmd.append("--no-audio")
    if stay_awake:
        cmd.append("--stay-awake")
    if record_file:
        cmd += ["--record", record_file]
    return cmd


class ScrcpyProcess:
    """Owns one running scrcpy window."""

    def __init__(self, cmd: list[str], adb_path: str = ""):
        self.cmd = cmd
        self.adb_path = adb_path
        self.proc: Optional[subprocess.Popen] = None
        self.log_path: Optional[Path] = None

    def start(self, log_dir: Path) -> None:
        env = dict(os.environ)
        if self.adb_path:
            env["ADB"] = self.adb_path  # share our adb server instead of the bundled one
        log_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = log_dir / "scrcpy.log"
        kwargs: dict = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        log = open(self.log_path, "ab")
        self.proc = subprocess.Popen(self.cmd, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                     env=env, cwd=str(Path(self.cmd[0]).parent), **kwargs)

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    @property
    def returncode(self) -> Optional[int]:
        return self.proc.poll() if self.proc else None

    def stop(self) -> None:
        if self.running:
            assert self.proc
            from ..adb.logcat import kill_process_tree
            kill_process_tree(self.proc)

    def tail_log(self, n: int = 20) -> str:
        if not self.log_path or not self.log_path.exists():
            return ""
        try:
            lines = self.log_path.read_text("utf-8", "replace").splitlines()
            return "\n".join(lines[-n:])
        except OSError:
            return ""
