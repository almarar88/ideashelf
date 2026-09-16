"""Local SQLite database: action log, apps installed by this program, known devices."""
from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    action TEXT NOT NULL,
    command TEXT NOT NULL,
    returncode INTEGER NOT NULL,
    success INTEGER NOT NULL,
    stdout TEXT NOT NULL DEFAULT '',
    stderr TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_actions_ts ON actions(ts);
CREATE TABLE IF NOT EXISTS installed_apps (
    package TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    version_name TEXT NOT NULL DEFAULT '',
    version_code INTEGER NOT NULL DEFAULT 0,
    source_path TEXT NOT NULL DEFAULT '',
    sha256 TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    installed_at TEXT NOT NULL,
    preexisting INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS known_devices (
    serial TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    model TEXT NOT NULL,
    feature TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL
);
"""


@dataclass
class ActionRow:
    id: int
    ts: str
    action: str
    command: str
    returncode: int
    success: bool
    stdout: str
    stderr: str
    device: str
    duration: float


@dataclass
class TrackedApp:
    package: str
    label: str
    version_name: str
    version_code: int
    source_path: str
    sha256: str
    device: str
    installed_at: str
    preexisting: bool


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Database:
    def __init__(self, path: str | Path = ":memory:"):
        self.path = str(path)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # ---- actions -------------------------------------------------------------
    def log_action(self, action: str, command: str, returncode: int, stdout: str = "", stderr: str = "",
                   device: str = "", duration: float = 0.0, success: Optional[bool] = None) -> int:
        ok = (returncode == 0) if success is None else success
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO actions(ts, action, command, returncode, success, stdout, stderr, device, duration)"
                " VALUES (?,?,?,?,?,?,?,?,?)",
                (_now(), action, command, returncode, 1 if ok else 0, stdout[:200000], stderr[:200000], device, duration),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def actions(self, limit: int = 500, search: str = "") -> list[ActionRow]:
        q = "SELECT * FROM actions"
        params: tuple = ()
        if search:
            q += " WHERE action LIKE ? OR command LIKE ? OR stdout LIKE ? OR stderr LIKE ?"
            s = f"%{search}%"
            params = (s, s, s, s)
        q += " ORDER BY id DESC LIMIT ?"
        with self._lock:
            rows = self._conn.execute(q, params + (limit,)).fetchall()
        return [ActionRow(r["id"], r["ts"], r["action"], r["command"], r["returncode"], bool(r["success"]),
                          r["stdout"], r["stderr"], r["device"], r["duration"]) for r in rows]

    def clear_actions(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM actions")
            self._conn.commit()

    # ---- installed apps tracking --------------------------------------------
    def track_install(self, package: str, label: str = "", version_name: str = "", version_code: int = 0,
                      source_path: str = "", sha256: str = "", device: str = "", preexisting: bool = False) -> None:
        with self._lock:
            existing = self._conn.execute("SELECT preexisting FROM installed_apps WHERE package=?", (package,)).fetchone()
            # once known as "not preexisting" it stays so (we installed the first copy)
            pre = preexisting if existing is None else (bool(existing["preexisting"]) and preexisting)
            self._conn.execute(
                "INSERT INTO installed_apps(package, label, version_name, version_code, source_path, sha256, device, installed_at, preexisting)"
                " VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(package) DO UPDATE SET label=excluded.label,"
                " version_name=excluded.version_name, version_code=excluded.version_code, source_path=excluded.source_path,"
                " sha256=excluded.sha256, device=excluded.device, installed_at=excluded.installed_at, preexisting=excluded.preexisting",
                (package, label, version_name, version_code, source_path, sha256, device, _now(), 1 if pre else 0),
            )
            self._conn.commit()

    def untrack(self, package: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM installed_apps WHERE package=?", (package,))
            self._conn.commit()

    def tracked_apps(self, only_removable: bool = False) -> list[TrackedApp]:
        q = "SELECT * FROM installed_apps"
        if only_removable:
            q += " WHERE preexisting=0"
        q += " ORDER BY installed_at DESC"
        with self._lock:
            rows = self._conn.execute(q).fetchall()
        return [TrackedApp(r["package"], r["label"], r["version_name"], r["version_code"], r["source_path"],
                           r["sha256"], r["device"], r["installed_at"], bool(r["preexisting"])) for r in rows]

    def tracked_packages(self) -> set[str]:
        with self._lock:
            return {r["package"] for r in self._conn.execute("SELECT package FROM installed_apps").fetchall()}

    # ---- known devices ---------------------------------------------------------
    def remember_device(self, serial: str, name: str = "", address: str = "") -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO known_devices(serial, name, address, last_seen) VALUES (?,?,?,?)"
                " ON CONFLICT(serial) DO UPDATE SET name=CASE WHEN excluded.name='' THEN known_devices.name ELSE excluded.name END,"
                " address=CASE WHEN excluded.address='' THEN known_devices.address ELSE excluded.address END, last_seen=excluded.last_seen",
                (serial, name, address, _now()),
            )
            self._conn.commit()

    def known_devices(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM known_devices ORDER BY last_seen DESC").fetchall()
        return [dict(r) for r in rows]

    def forget_device(self, serial: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM known_devices WHERE serial=?", (serial,))
            self._conn.commit()

    # ---- ai usage ----------------------------------------------------------------
    def add_ai_usage(self, model: str, feature: str, input_tokens: int, output_tokens: int, cost_usd: float) -> None:
        with self._lock:
            self._conn.execute("INSERT INTO ai_usage(ts, model, feature, input_tokens, output_tokens, cost_usd) VALUES (?,?,?,?,?,?)",
                               (_now(), model, feature, input_tokens, output_tokens, cost_usd))
            self._conn.commit()

    def ai_usage_month(self, year: int, month: int) -> tuple[int, int, float]:
        prefix = f"{year:04d}-{month:02d}"
        with self._lock:
            r = self._conn.execute(
                "SELECT COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0), COALESCE(SUM(cost_usd),0) FROM ai_usage WHERE ts LIKE ?",
                (prefix + "%",)).fetchone()
        return int(r[0]), int(r[1]), float(r[2])
