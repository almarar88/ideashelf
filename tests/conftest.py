import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from car_app_manager.adb.runner import AdbRunner  # noqa: E402


class FakeAdb:
    """Scriptable adb executor. Map a substring of the command line to (rc, stdout, stderr)."""

    def __init__(self):
        self.responses: list[tuple[str, tuple[int, str, str]]] = []
        self.calls: list[list[str]] = []
        self.default = (0, "", "")

    def when(self, needle: str, rc: int = 0, out: str = "", err: str = ""):
        self.responses.append((needle, (rc, out, err)))
        return self

    def __call__(self, args, timeout):
        self.calls.append(list(args))
        line = " ".join(args)
        for needle, resp in self.responses:
            if needle in line:
                return resp
        return self.default

    def called(self, needle: str) -> bool:
        return any(needle in " ".join(c) for c in self.calls)


@pytest.fixture
def fake():
    return FakeAdb()


@pytest.fixture
def runner(fake):
    r = AdbRunner("adb", executor=fake)
    r.serial = "TESTSERIAL"
    return r


@pytest.fixture
def tmp_home(tmp_path, monkeypatch):
    monkeypatch.setenv("CAR_APP_MANAGER_HOME", str(tmp_path / "home"))
    return tmp_path / "home"
