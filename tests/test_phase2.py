import json
from pathlib import Path

import pytest

from car_app_manager.adb.logcat import build_logcat_args, find_pid, level_passes, parse_line
from car_app_manager.adb.screen import take_screenshot, PNG_MAGIC
from car_app_manager.adb.runner import AdbRunner
from car_app_manager.tools.scrcpy import build_scrcpy_command, pick_windows_asset


def test_parse_logcat_line():
    ll = parse_line("09-16 18:00:01.123  1234  1300 W ActivityManager: Slow operation: 120ms\n")
    assert ll.parsed and ll.level == "W" and ll.pid == 1234 and ll.tag == "ActivityManager"
    assert ll.message.startswith("Slow operation")
    assert not parse_line("--------- beginning of main").parsed


def test_level_filter():
    assert level_passes("E", "W") and level_passes("W", "W") and not level_passes("I", "W")
    assert level_passes("V", "V")


def test_logcat_args():
    assert build_logcat_args("adb", "S1", 42, "W") == ["adb", "-s", "S1", "logcat", "-v", "threadtime", "--pid=42", "*:W"]
    assert build_logcat_args("adb", None, None, "V") == ["adb", "logcat", "-v", "threadtime"]


def test_find_pid(runner, fake):
    fake.when("pidof com.x", out="4321\n")
    assert find_pid(runner, "com.x") == 4321
    fake.when("pidof com.y", out="")
    fake.when("ps -A", out="u0_a12  777  1  100 200 x y z S com.y\n")
    assert find_pid(runner, "com.y") == 777


def test_screenshot(tmp_path, monkeypatch):
    r = AdbRunner("adb")
    r.serial = "S"
    calls = []

    def raw(*args, **kw):
        calls.append(args)
        return 0, PNG_MAGIC + b"data", ""
    monkeypatch.setattr(r, "run_raw", raw)
    out = take_screenshot(r, tmp_path / "shots")
    assert out.exists() and out.read_bytes().startswith(PNG_MAGIC) and out.suffix == ".png"
    assert calls[0] == ("exec-out", "screencap", "-p")


def test_screenshot_fixes_crlf(tmp_path, monkeypatch):
    r = AdbRunner("adb")
    monkeypatch.setattr(r, "run_raw", lambda *a, **k: (0, PNG_MAGIC.replace(b"\n", b"\r\n") + b"x", ""))
    assert take_screenshot(r, tmp_path).read_bytes().startswith(PNG_MAGIC)


def test_screenshot_failure(tmp_path, monkeypatch):
    r = AdbRunner("adb")
    monkeypatch.setattr(r, "run_raw", lambda *a, **k: (1, b"", "error: device offline"))
    with pytest.raises(RuntimeError, match="offline"):
        take_screenshot(r, tmp_path)


def test_pick_scrcpy_asset():
    rel = {"tag_name": "v3.3.1", "assets": [
        {"name": "scrcpy-linux-x86_64-v3.3.1.tar.gz", "browser_download_url": "u1"},
        {"name": "scrcpy-win32-v3.3.1.zip", "browser_download_url": "u2"},
        {"name": "scrcpy-win64-v3.3.1.zip", "browser_download_url": "u3"},
    ]}
    assert pick_windows_asset(rel) == ("scrcpy-win64-v3.3.1.zip", "u3")
    with pytest.raises(RuntimeError):
        pick_windows_asset({"assets": []})


def test_scrcpy_command():
    cmd = build_scrcpy_command("C:/t/scrcpy.exe", "S1", "Car", 1280, 8, 30, True, True, "C:/r/x.mp4")
    assert cmd[:3] == ["C:/t/scrcpy.exe", "--serial", "S1"]
    assert "--window-title" in cmd and "--max-size" in cmd and "--video-bit-rate" in cmd and "8M" in cmd
    assert "--always-on-top" in cmd and "--no-audio" in cmd and cmd[-2:] == ["--record", "C:/r/x.mp4"]
    plain = build_scrcpy_command("scrcpy", None, no_audio=False, always_on_top=False)
    assert "--serial" not in plain and "--no-audio" not in plain and "--record" not in plain
