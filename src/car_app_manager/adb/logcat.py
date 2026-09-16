"""Streaming logcat reader (QThread) with package / level / text filters."""
from __future__ import annotations

import queue
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional

from PySide6.QtCore import QThread, Signal

LEVELS = ("V", "D", "I", "W", "E", "F")
LEVEL_RANK = {l: i for i, l in enumerate(LEVELS)}

# threadtime: 09-16 18:00:01.123  1234  1234 I ActivityManager: text
_LINE_RE = re.compile(r"^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.*?):\s(.*)$")


@dataclass
class LogLine:
    raw: str
    time: str = ""
    pid: int = 0
    tid: int = 0
    level: str = "I"
    tag: str = ""
    message: str = ""

    @property
    def parsed(self) -> bool:
        return bool(self.time)


def parse_line(line: str) -> LogLine:
    line = line.rstrip("\r\n")
    m = _LINE_RE.match(line)
    if not m:
        return LogLine(raw=line)
    return LogLine(raw=line, time=m.group(1), pid=int(m.group(2)), tid=int(m.group(3)), level=m.group(4),
                   tag=m.group(5).strip(), message=m.group(6))


def level_passes(level: str, minimum: str) -> bool:
    return LEVEL_RANK.get(level, 0) >= LEVEL_RANK.get(minimum, 0)


def build_logcat_args(adb_path: str, serial: Optional[str], pid: Optional[int] = None, min_level: str = "V",
                      clear_first: bool = False) -> list[str]:
    args = [adb_path]
    if serial:
        args += ["-s", serial]
    args += ["logcat", "-v", "threadtime"]
    if pid:
        args += [f"--pid={pid}"]
    if min_level and min_level != "V":
        args += [f"*:{min_level}"]
    return args


def find_pid(runner, package: str) -> Optional[int]:
    r = runner.shell(f"pidof {package}", action="pidof", timeout=15)
    if r.ok and r.stdout.strip():
        try:
            return int(r.stdout.split()[0])
        except ValueError:
            return None
    # fallback for older `pidof`
    r = runner.shell(f"ps -A | grep {package}", action="ps", timeout=15)
    if r.ok:
        for line in r.stdout.splitlines():
            parts = line.split()
            if len(parts) > 8 and parts[-1] == package and parts[1].isdigit():
                return int(parts[1])
    return None


class LogcatStreamer(QThread):
    """Runs `adb logcat`; lines are queued and fetched with drain() from the GUI thread. Stop with stop()."""

    finished_with = Signal(str)  # message (empty on clean stop)

    def __init__(self, args: list[str], parent=None):
        super().__init__(parent)
        self.args = args
        self._proc: Optional[subprocess.Popen] = None
        self._stop = False
        self._queue: "queue.Queue[str]" = queue.Queue()

    def drain(self, limit: int = 5000) -> list[str]:
        out: list[str] = []
        try:
            while len(out) < limit:
                out.append(self._queue.get_nowait())
        except queue.Empty:
            pass
        return out

    def run(self) -> None:
        kwargs: dict = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            self._proc = subprocess.Popen(self.args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                          stdin=subprocess.DEVNULL, bufsize=0, **kwargs)
        except OSError as e:
            self.finished_with.emit(str(e))
            return
        assert self._proc.stdout is not None
        try:
            for raw in iter(self._proc.stdout.readline, b""):
                if self._stop:
                    break
                self._queue.put(raw.decode("utf-8", "replace").rstrip("\r\n"))
        except (ValueError, OSError):
            pass  # pipe closed by stop()
        finally:
            self._terminate()
        self.finished_with.emit("" if self._stop else "logcat ended")

    def _terminate(self) -> None:
        p = self._proc
        if p and p.poll() is None:
            kill_process_tree(p)

    def stop(self) -> None:
        self._stop = True
        self._terminate()
        p = self._proc
        if p and p.stdout:
            try:
                p.stdout.close()  # unblocks readline() in the reader thread
            except Exception:
                pass


def kill_process_tree(p: subprocess.Popen) -> None:
    """Terminate a child and everything it spawned (a .bat/cmd wrapper on Windows keeps the pipe open)."""
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True, timeout=10,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        else:
            p.terminate()
        p.wait(timeout=3)
    except Exception:
        try:
            p.kill()
            p.wait(timeout=3)
        except Exception:
            pass
