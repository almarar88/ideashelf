"""Action logging: SQLite (for the Logs page) + rotating text file + in-process listeners."""
from __future__ import annotations

import logging
import threading
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Callable, Optional

from .adb.runner import AdbResult
from .config import logs_dir
from .db import Database, ActionRow

_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def setup_file_logging(level: int = logging.INFO) -> Path:
    path = logs_dir() / "car_app_manager.log"
    root = logging.getLogger()
    if not any(isinstance(h, RotatingFileHandler) for h in root.handlers):
        h = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
        h.setFormatter(logging.Formatter(_LOG_FORMAT))
        root.addHandler(h)
    root.setLevel(level)
    return path


class ActionLogger:
    """Receives every AdbResult and every app-level action and persists them."""

    def __init__(self, db: Database):
        self.db = db
        self._listeners: list[Callable[[ActionRow], None]] = []
        self._lock = threading.Lock()
        self._py = logging.getLogger("actions")

    def add_listener(self, fn: Callable[[ActionRow], None]) -> None:
        with self._lock:
            self._listeners.append(fn)

    def remove_listener(self, fn: Callable[[ActionRow], None]) -> None:
        with self._lock:
            if fn in self._listeners:
                self._listeners.remove(fn)

    def on_adb_result(self, r: AdbResult) -> None:
        self.record(r.action or "adb", r.command, r.returncode, r.stdout, r.stderr, r.device, r.duration)

    def record(self, action: str, command: str, returncode: int = 0, stdout: str = "", stderr: str = "",
               device: str = "", duration: float = 0.0, success: Optional[bool] = None) -> ActionRow:
        row_id = self.db.log_action(action, command, returncode, stdout, stderr, device, duration, success)
        ok = (returncode == 0) if success is None else success
        self._py.info("%s | %s | rc=%s ok=%s", action, command, returncode, ok)
        from datetime import datetime
        row = ActionRow(row_id, datetime.now().isoformat(timespec="seconds"), action, command, returncode, ok,
                        stdout, stderr, device, duration)
        with self._lock:
            listeners = list(self._listeners)
        for fn in listeners:
            try:
                fn(row)
            except Exception:  # pragma: no cover
                pass
        return row

    def note(self, action: str, detail: str = "", success: bool = True, device: str = "") -> ActionRow:
        """Log an app-level event that is not an adb command (e.g. user confirmed uninstall)."""
        return self.record(action, detail, 0 if success else 1, "", "", device, 0.0, success)

    def export(self, path: str | Path, limit: int = 100000) -> Path:
        rows = self.db.actions(limit=limit)
        p = Path(path)
        with open(p, "w", encoding="utf-8") as f:
            for r in reversed(rows):
                f.write(f"[{r.ts}] {'OK ' if r.success else 'ERR'} {r.action}\n  $ {r.command}\n")
                if r.stdout.strip():
                    f.write("  stdout: " + r.stdout.strip().replace("\n", "\n          ") + "\n")
                if r.stderr.strip():
                    f.write("  stderr: " + r.stderr.strip().replace("\n", "\n          ") + "\n")
        return p
