"""Headless GUI smoke test: real widgets, fake adb executable, offscreen platform."""
import os
import stat
import sys
import time
from pathlib import Path

import pytest

pytest.importorskip("PySide6")

FAKE = Path(__file__).parent / "fake_adb.py"


def _pump(app, ms):
    end = time.time() + ms / 1000
    while time.time() < end:
        app.processEvents()
        time.sleep(0.01)


@pytest.fixture
def gui(tmp_path, monkeypatch):
    monkeypatch.setenv("CAR_APP_MANAGER_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtCore import QThreadPool
    from car_app_manager.main import create_app
    from car_app_manager.app import AppContext
    from car_app_manager.ui.main_window import MainWindow

    app = create_app([])
    ctx = AppContext()
    # wrapper so the fake works without relying on the exec bit
    fake_exe = tmp_path / ("adb.bat" if sys.platform == "win32" else "adb")
    if sys.platform == "win32":
        fake_exe.write_text(f'@echo off\r\n"{sys.executable}" "{FAKE}" %*\r\n')
    else:
        fake_exe.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{FAKE}" "$@"\n')
        fake_exe.chmod(fake_exe.stat().st_mode | stat.S_IEXEC)
    ctx.set_adb_path(str(fake_exe))
    win = MainWindow(ctx)
    win.show()
    yield app, ctx, win
    win.close()
    QThreadPool.globalInstance().waitForDone(5000)


def test_device_detection_and_pages(gui):
    app, ctx, win = gui
    t0 = time.time()
    while (not ctx.device_info) and time.time() - t0 < 15:
        _pump(app, 100)
    assert ctx.current_device and ctx.current_device.is_ready
    assert ctx.device_info.sdk == 29 and "arm64-v8a" in ctx.device_info.abis
    assert "Jetour T2" in win.pages["device"].info_labels["model"].text()

    # apps page loads through the worker and marks the vendor-prefixed package as protected
    win.nav.setCurrentRow(1)
    t0 = time.time()
    while not win.pages["apps"].apps and time.time() - t0 < 15:
        _pump(app, 100)
    apps = {a.package: a for a in win.pages["apps"].apps}
    assert set(apps) == {"com.spotify.music", "org.videolan.vlc", "com.chery.usercfg"}
    assert apps["com.chery.usercfg"].protected and not apps["com.spotify.music"].protected

    # every page can be shown in both languages without raising
    for lang in ("en", "ar"):
        ctx.set_language(lang)
        for i in range(win.nav.count()):
            win.nav.setCurrentRow(i)
            _pump(app, 50)
    assert win.nav.item(0).text().endswith("الجهاز")


def test_install_page_inspects_dropped_file(gui, tmp_path):
    app, ctx, win = gui
    t0 = time.time()
    while (not ctx.device_info) and time.time() - t0 < 15:
        _pump(app, 100)
    bogus = tmp_path / "bogus.apk"
    bogus.write_bytes(b"definitely not an apk")
    page = win.pages["install"]
    page.add_paths([str(bogus), str(tmp_path)])  # folder is scanned, duplicate ignored
    assert len(page.items) == 1
    item = page.items[0]
    t0 = time.time()
    while item.state == "checking" and time.time() - t0 < 30:
        _pump(app, 100)
    assert item.state == "warn" and item.info.sha256 and item.info.parse_error
    assert page.table.rowCount() == 1


def test_logs_page_records_adb_calls(gui):
    app, ctx, win = gui
    _pump(app, 800)
    win.nav.setCurrentRow(5)
    _pump(app, 300)
    assert win.pages["logs"].table.rowCount() >= 3
    assert any("devices" in r.command for r in ctx.db.actions())
