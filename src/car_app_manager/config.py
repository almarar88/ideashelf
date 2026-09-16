"""Paths and persistent settings (JSON). No secrets are stored here."""
from __future__ import annotations

import json
import os
import sys
import threading
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

APP_DIR_NAME = "CarAppManager"


def data_dir() -> Path:
    """%LOCALAPPDATA%\\CarAppManager on Windows, XDG data dir elsewhere."""
    override = os.environ.get("CAR_APP_MANAGER_HOME")
    if override:
        base = Path(override)
    elif sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / APP_DIR_NAME
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP_DIR_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base


def tools_dir() -> Path:
    p = data_dir() / "tools"
    p.mkdir(parents=True, exist_ok=True)
    return p


def logs_dir() -> Path:
    p = data_dir() / "logs"
    p.mkdir(parents=True, exist_ok=True)
    return p


def default_backups_dir() -> Path:
    p = data_dir() / "backups"
    p.mkdir(parents=True, exist_ok=True)
    return p


def db_path() -> Path:
    return data_dir() / "car_app_manager.sqlite3"


def settings_path() -> Path:
    return data_dir() / "settings.json"


@dataclass
class Settings:
    language: str = "ar"
    adb_path: str = ""
    scrcpy_path: str = ""
    screenshots_dir: str = ""
    scrcpy_max_size: int = 1280
    scrcpy_bitrate: int = 8
    scrcpy_fps: int = 30
    scrcpy_always_on_top: bool = False
    scrcpy_no_audio: bool = True
    auto_refresh_seconds: int = 5
    backups_dir: str = ""
    last_wifi_address: str = ""
    known_devices: list[dict[str, Any]] = field(default_factory=list)
    confirm_destructive: bool = True
    # AI (phase 4) - the API key itself is NEVER stored here; it lives in keyring.
    ai_cheap_model: str = "claude-haiku-4-5-20251001"
    ai_smart_model: str = "claude-sonnet-5"
    ai_monthly_cap_usd: float = 5.0
    ai_max_tokens_per_request: int = 2048
    virustotal_enabled: bool = False
    window_geometry: str = ""

    _lock = threading.Lock()  # class-level; not a dataclass field

    @classmethod
    def load(cls, path: Path | None = None) -> "Settings":
        path = path or settings_path()
        s = cls()
        if path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                for k, v in raw.items():
                    if k.startswith("_"):
                        continue
                    if hasattr(s, k):
                        setattr(s, k, v)
            except (OSError, ValueError):
                pass
        if not s.backups_dir:
            s.backups_dir = str(default_backups_dir())
        if not s.screenshots_dir:
            s.screenshots_dir = str(data_dir() / "screenshots")
        return s

    def save(self, path: Path | None = None) -> None:
        path = path or settings_path()
        with self._lock:
            d = {f.name: getattr(self, f.name) for f in fields(self) if not f.name.startswith("_")}
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, path)

    def remember_device(self, serial: str, name: str, address: str = "") -> None:
        for d in self.known_devices:
            if d.get("serial") == serial or (address and d.get("address") == address):
                d["name"] = name or d.get("name", "")
                if address:
                    d["address"] = address
                return
        self.known_devices.append({"serial": serial, "name": name, "address": address})
