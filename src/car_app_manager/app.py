"""Application context shared by all pages (settings, db, adb layer, current device)."""
from __future__ import annotations

import logging
from typing import Optional

from PySide6.QtCore import QObject, Signal

from .adb.device import Device, DeviceInfo, DeviceManager
from .adb.install import Installer
from .adb.packages import PackageManager
from .adb.runner import AdbRunner
from .config import Settings, db_path
from .db import Database
from .i18n import i18n, set_language
from .logs import ActionLogger, setup_file_logging
from .tools.platform_tools import find_adb
from .ai.client import AIService

log = logging.getLogger(__name__)


class AppContext(QObject):
    devices_changed = Signal(list)          # list[Device]
    device_changed = Signal(object)         # Device | None
    device_info_changed = Signal(object)    # DeviceInfo | None
    adb_changed = Signal(str)               # adb path
    language_changed = Signal(str)
    notify = Signal(str, str)               # (level, message) for status bar
    apps_loaded = Signal(list)              # list[str] packages (for logcat filter etc.)

    def __init__(self, settings: Optional[Settings] = None, db: Optional[Database] = None):
        super().__init__()
        setup_file_logging()
        self.settings = settings or Settings.load()
        self.db = db or Database(db_path())
        self.logger = ActionLogger(self.db)
        self.adb_path: str = find_adb(self.settings.adb_path) or ""
        self.runner = AdbRunner(self.adb_path or "adb", on_result=self.logger.on_adb_result)
        self.devices = DeviceManager(self.runner)
        self.pm = PackageManager(self.runner)
        self.current_device: Optional[Device] = None
        self.device_info: Optional[DeviceInfo] = None
        self.known_devices: list[Device] = []
        self.ai = AIService(self.settings, self.db)
        set_language(self.settings.language)
        i18n().on_change(self._on_lang)

    # ---- adb ----------------------------------------------------------------------
    def set_adb_path(self, path: str, persist: bool = True) -> None:
        self.adb_path = path
        self.runner.adb_path = path or "adb"
        if persist:
            self.settings.adb_path = path
            self.settings.save()
        self.adb_changed.emit(path)

    @property
    def adb_available(self) -> bool:
        return bool(self.adb_path)

    # ---- device ----------------------------------------------------------------------
    def set_devices(self, devices: list[Device]) -> None:
        self.known_devices = devices
        self.devices_changed.emit(devices)
        # keep current selection if still present, else auto-select the single ready device
        if self.current_device:
            match = next((d for d in devices if d.serial == self.current_device.serial), None)
            if match:
                if match.state != self.current_device.state:
                    self.select_device(match)
                else:
                    self.current_device = match
                return
            self.select_device(None)
        ready = [d for d in devices if d.is_ready]
        if len(ready) >= 1:
            self.select_device(ready[0])
        elif devices:
            self.select_device(devices[0])

    def select_device(self, device: Optional[Device]) -> None:
        self.current_device = device
        self.runner.serial = device.serial if device else None
        self.pm._system_cache = None
        self.device_info = None
        self.device_changed.emit(device)
        if device and device.is_ready:
            self.db.remember_device(device.serial, device.model, device.serial if device.is_wifi else "")

    def set_device_info(self, info: Optional[DeviceInfo]) -> None:
        self.device_info = info
        self.device_info_changed.emit(info)

    @property
    def device_ready(self) -> bool:
        return bool(self.current_device and self.current_device.is_ready)

    def installer(self) -> Installer:
        abis = self.device_info.abis if self.device_info else []
        return Installer(self.runner, abis)

    # ---- language --------------------------------------------------------------------
    def set_language(self, lang: str) -> None:
        set_language(lang)

    def _on_lang(self, lang: str) -> None:
        self.settings.language = lang
        self.settings.save()
        self.language_changed.emit(lang)
