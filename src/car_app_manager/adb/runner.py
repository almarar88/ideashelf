"""Thin subprocess wrapper around adb.exe. Every call returns an AdbResult and is logged."""
from __future__ import annotations

import subprocess
import sys
import time
from dataclasses import dataclass, field
from typing import Callable, Optional, Sequence

Executor = Callable[[Sequence[str], float], tuple[int, str, str]]

RC_ADB_NOT_FOUND = -1
RC_TIMEOUT = -2


@dataclass
class AdbResult:
    args: list[str]
    returncode: int
    stdout: str = ""
    stderr: str = ""
    duration: float = 0.0
    action: str = ""
    device: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.returncode == 0

    @property
    def command(self) -> str:
        return " ".join(_quote(a) for a in self.args)

    @property
    def output(self) -> str:
        return (self.stdout + ("\n" + self.stderr if self.stderr else "")).strip()


def _quote(a: str) -> str:
    return f'"{a}"' if (" " in a or not a) else a


def _default_executor(args: Sequence[str], timeout: float) -> tuple[int, str, str]:
    kwargs: dict = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        kwargs["startupinfo"] = si
    proc = subprocess.run(
        list(args),
        capture_output=True,
        timeout=timeout,
        stdin=subprocess.DEVNULL,
        **kwargs,
    )
    return (
        proc.returncode,
        proc.stdout.decode("utf-8", errors="replace"),
        proc.stderr.decode("utf-8", errors="replace"),
    )


class AdbRunner:
    """Runs adb commands. `serial` selects the target device (-s)."""

    def __init__(
        self,
        adb_path: str,
        executor: Optional[Executor] = None,
        on_result: Optional[Callable[[AdbResult], None]] = None,
    ):
        self.adb_path = adb_path
        self.serial: Optional[str] = None
        self._executor = executor or _default_executor
        self._on_result = on_result

    def run(
        self,
        *args: str,
        serial: Optional[str] = None,
        timeout: float = 60.0,
        action: str = "",
        use_serial: bool = True,
    ) -> AdbResult:
        target = serial if serial is not None else self.serial
        full = [self.adb_path]
        if target and use_serial:
            full += ["-s", target]
        full += list(args)
        t0 = time.monotonic()
        try:
            rc, out, err = self._executor(full, timeout)
        except FileNotFoundError:
            rc, out, err = RC_ADB_NOT_FOUND, "", f"adb executable not found: {self.adb_path}"
        except subprocess.TimeoutExpired:
            rc, out, err = RC_TIMEOUT, "", f"adb timed out after {timeout:.0f}s"
        except OSError as e:  # pragma: no cover - defensive
            rc, out, err = RC_ADB_NOT_FOUND, "", str(e)
        res = AdbResult(
            args=full,
            returncode=rc,
            stdout=out,
            stderr=err,
            duration=time.monotonic() - t0,
            action=action,
            device=target or "",
        )
        if self._on_result:
            try:
                self._on_result(res)
            except Exception:  # never let logging break a command
                pass
        return res

    def shell(self, cmd: str, action: str = "", timeout: float = 60.0, serial: Optional[str] = None) -> AdbResult:
        return self.run("shell", cmd, action=action, timeout=timeout, serial=serial)

    def version(self) -> Optional[str]:
        r = self.run("version", use_serial=False, timeout=15, action="adb version")
        if r.ok:
            first = r.stdout.strip().splitlines()[0] if r.stdout.strip() else ""
            return first
        return None
