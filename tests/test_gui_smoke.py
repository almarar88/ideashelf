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


def test_screen_page_screenshot_and_logcat(gui, tmp_path):
    app, ctx, win = gui
    t0 = time.time()
    while (not ctx.device_info) and time.time() - t0 < 15:
        _pump(app, 100)
    win.nav.setCurrentRow(3)
    page = win.pages["screen"]
    page.ed_shot_dir.setText(str(tmp_path / "shots"))
    page._capture()
    t0 = time.time()
    while page._last_shot is None and time.time() - t0 < 15:
        _pump(app, 100)
    assert page._last_shot and page._last_shot.exists() and page.preview.pixmap() and not page.preview.pixmap().isNull()

    page.cmb_pkg.setEditText("com.spotify.music")
    page.cmb_level.setCurrentIndex(3)  # W
    page._start_logcat()
    t0 = time.time()
    while len(page.log_lines) < 30 and time.time() - t0 < 15:
        _pump(app, 100)
    assert len(page.log_lines) == 30
    shown = page.lc_view.toPlainText().strip().splitlines()
    assert len(shown) == 20 and all(" I " not in l for l in shown)  # I lines filtered out at level W
    page.ed_filter.setText("line 1")
    _pump(app, 300)
    assert all("line 1" in l for l in page.lc_view.toPlainText().strip().splitlines())
    page._stop_logcat()
    t0 = time.time()
    while page.streamer is not None and time.time() - t0 < 10:
        _pump(app, 100)
    assert page.streamer is None and page.btn_lc_start.isEnabled()
    assert any(r.action == "logcat start" and "--pid=4242" in r.command for r in ctx.db.actions())
    # scrcpy: not installed in the test environment -> start disabled, status warns
    assert not page.btn_start.isEnabled()


def test_catalog_tab_and_vt_column(gui, tmp_path, monkeypatch):
    app, ctx, win = gui
    win.nav.setCurrentRow(2)
    page = win.pages["install"]
    tab = page.catalog_tab
    assert tab.table.rowCount() >= 5
    page.tabs.setCurrentIndex(1)
    _pump(app, 150)
    tab.table.setCurrentCell(0, 0)  # selectRow() is a no-op in RTL before the viewport is laid out
    _pump(app, 100)
    first_id = tab._selected_id()
    tab._toggle_tested()
    assert tab.catalog.get(first_id).tested_on_t2 and tab.table.item(0, 3).text() == "✔"
    # VirusTotal disabled -> manual check shows the hint, no lookup
    ctx.settings.virustotal_enabled = False
    page._vt_check_selected()
    assert "VirusTotal" in page.status.text()
    # enabled with a fake key and a fake lookup -> column filled
    from car_app_manager.security import secrets
    from car_app_manager.ui.pages import install_page as ip
    monkeypatch.setattr(secrets, "_backend_ok", lambda: False)
    secrets.set_secret("virustotal", "FAKE")
    monkeypatch.setattr(ip, "get_secret", lambda name: "FAKE")
    monkeypatch.setattr(ip, "vt_lookup", lambda sha, key: ip.VTResult(sha, "found", malicious=3, harmless=10, undetected=1))
    ctx.settings.virustotal_enabled = True
    bogus = tmp_path / "x.apk"; bogus.write_bytes(b"zzz")
    page.add_paths([str(bogus)])
    item = page.items[-1]
    t0 = time.time()
    while (item.state == "checking" or item.vt is None) and time.time() - t0 < 30:
        _pump(app, 100)
    assert item.vt and item.vt.malicious == 3
    row = page.table.rowCount() - 1
    assert "3" in page.table.item(row, 6).text()
    assert any(r.action == "virustotal lookup" for r in ctx.db.actions())
