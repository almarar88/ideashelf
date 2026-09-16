from pathlib import Path

from car_app_manager.db import Database
from car_app_manager.logs import ActionLogger
from car_app_manager.adb.runner import AdbRunner, AdbResult
from car_app_manager.adb.packages import PackageManager, AppInfo
from car_app_manager.adb.install import Installer
from car_app_manager import backup as bk
from car_app_manager.config import Settings


def test_track_install_and_restore_set():
    db = Database()
    db.track_install("com.a", version_name="1", preexisting=False)
    db.track_install("com.b", version_name="1", preexisting=True)  # was on device before us
    db.track_install("com.a", version_name="2", preexisting=True)  # update of our own install stays removable
    removable = {t.package for t in db.tracked_apps(only_removable=True)}
    assert removable == {"com.a"}
    assert db.tracked_packages() == {"com.a", "com.b"}
    db.untrack("com.a")
    assert db.tracked_packages() == {"com.b"}


def test_action_log_roundtrip_and_export(tmp_path):
    db = Database()
    logger = ActionLogger(db)
    seen = []
    logger.add_listener(seen.append)
    fake_calls = []
    r = AdbRunner("adb", executor=lambda a, t: (1, "out", "err"), on_result=logger.on_adb_result)
    r.run("shell", "pm clear com.x", action="clear data")
    logger.note("user confirmed", "uninstall com.y")
    rows = db.actions()
    assert len(rows) == 2 and rows[1].action == "clear data" and not rows[1].success and rows[1].stderr == "err"
    assert rows[0].success and rows[0].action == "user confirmed"
    assert len(seen) == 2
    out = logger.export(tmp_path / "log.txt")
    text = out.read_text(encoding="utf-8")
    assert "clear data" in text and "pm clear com.x" in text and "stderr: err" in text
    assert db.actions(search="com.y")[0].command == "uninstall com.y"


def test_known_devices():
    db = Database()
    db.remember_device("192.168.1.5:5555", "Car", "192.168.1.5:5555")
    db.remember_device("192.168.1.5:5555")  # no name -> keeps old one
    assert db.known_devices()[0]["name"] == "Car"
    db.forget_device("192.168.1.5:5555")
    assert db.known_devices() == []


def test_backup_and_restore(runner, fake, tmp_path):
    pulled = []

    def executor(args, timeout):
        fake.calls.append(list(args))
        if "pull" in args:
            Path(args[-1]).write_bytes(b"apk-" + Path(args[-2]).name.encode())
            pulled.append(args[-1])
            return 0, "pulled", ""
        if "install" in args:
            return 0, "Success", ""
        return 0, "", ""
    runner._executor = executor
    pm = PackageManager(runner)
    apps = [AppInfo("com.a", version_name="1", version_code=1, apk_paths=["/data/app/a/base.apk"]),
            AppInfo("com.b", version_name="2", version_code=2, apk_paths=["/data/app/b/base.apk", "/data/app/b/split_config.arm64_v8a.apk"])]
    b = bk.create_backup(pm, tmp_path, apps, device="SER", device_model="Jetour T2")
    assert (b.folder / "apps.json").exists() and b.folder.name.startswith("backup_")
    assert len(pulled) == 3
    loaded = bk.list_backups(tmp_path)
    assert len(loaded) == 1 and [e.package for e in loaded[0].entries] == ["com.a", "com.b"]
    assert loaded[0].entries[0].files == ["com.a/com.a.apk"]
    results = bk.restore(Installer(runner), loaded[0], ["com.b"])
    assert len(results) == 1 and results[0].success
    assert "install-multiple" in fake.calls[-1]


def test_settings_roundtrip(tmp_path):
    p = tmp_path / "settings.json"
    s = Settings()
    s.language = "en"
    s.remember_device("S1", "Car", "1.2.3.4:5555")
    s.save(p)
    s2 = Settings.load(p)
    assert s2.language == "en" and s2.known_devices[0]["name"] == "Car"
    assert "_lock" not in p.read_text()
