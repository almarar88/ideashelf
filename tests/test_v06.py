import json
import zipfile
from pathlib import Path

from car_app_manager.adb.packages import PackageManager, parse_packages_dump, parse_packages_with_paths
from car_app_manager.main import apk_args
from car_app_manager.updates import parse_release
from car_app_manager.support import write_support_bundle
from car_app_manager.db import Database
from car_app_manager.logs import ActionLogger

DUMP = """  Package [com.spotify.music] (1a2b):
    userId=10123
    versionCode=8890 minSdk=21 targetSdk=29
    versionName=8.8.90
    firstInstallTime=2024-01-01 10:00:00
    lastUpdateTime=2024-02-01 10:00:00
  Package [org.videolan.vlc] (3c4d):
    versionCode=350 minSdk=17 targetSdk=29
    versionName=3.5.4
    firstInstallTime=2024-03-01 10:00:00
"""


def test_parse_dump_and_paths():
    d = parse_packages_dump(DUMP)
    assert d["com.spotify.music"]["versionName"] == "8.8.90" and d["com.spotify.music"]["versionCode"] == "8890"
    assert d["org.videolan.vlc"]["firstInstallTime"] == "2024-03-01"
    p = parse_packages_with_paths("package:/data/app/spot-1/base.apk=com.spotify.music\npackage:/data/app/vlc-2/base.apk=org.videolan.vlc\n")
    assert p == {"com.spotify.music": "/data/app/spot-1/base.apk", "org.videolan.vlc": "/data/app/vlc-2/base.apk"}


def test_fast_listing_uses_two_calls_and_falls_back(runner, fake):
    fake.when("pm list packages -s", out="package:com.android.settings\n")
    fake.when("pm list packages -3 -f", out="package:/data/app/spot-1/base.apk=com.spotify.music\npackage:/data/app/vlc-2/base.apk=org.videolan.vlc\n")
    fake.when("pm list packages -3", out="package:com.spotify.music\npackage:org.videolan.vlc\npackage:com.chery.usercfg\n")
    fake.when("dumpsys package packages", out=DUMP)
    fake.when("dumpsys package com.chery.usercfg", out="versionName=1.0\nversionCode=1\n")
    fake.when("pm path com.chery.usercfg", out="package:/data/app/cfg/base.apk\n")
    fake.when("stat -c", out="10 /data/app/spot-1/base.apk\n20 /data/app/vlc-2/base.apk\n30 /data/app/cfg/base.apk\n")
    apps = {a.package: a for a in PackageManager(runner).list_user_apps()}
    assert apps["com.spotify.music"].version_name == "8.8.90" and apps["com.spotify.music"].size_bytes == 10
    assert apps["org.videolan.vlc"].version_code == 350
    assert apps["com.chery.usercfg"].version_name == "1.0" and apps["com.chery.usercfg"].protected  # fell back per-app
    dumpsys_calls = [c for c in fake.calls if "dumpsys package" in " ".join(c)]
    assert len(dumpsys_calls) == 2  # one summary + one fallback, not one per app


def test_apk_args(tmp_path):
    a = tmp_path / "x.apk"; a.write_bytes(b"1")
    b = tmp_path / "y.xapk"; b.write_bytes(b"1")
    assert apk_args([str(a), "--flag", str(b), str(tmp_path / "missing.apk"), "notes.txt"]) == [str(a), str(b)]


def test_parse_release():
    data = {"body": "Automatic build from 0123456789abcdef0123456789abcdef01234567 on branch x", "html_url": "u",
            "assets": [{"updated_at": "2026-09-18T06:09:48Z"}]}
    u = parse_release(data, "0123456789abcdef0123456789abcdef01234567")
    assert not u.available and u.published.startswith("2026-09-18")
    u2 = parse_release(data, "ffffffffffff0000")
    assert u2.available and u2.url == "u"
    assert not parse_release({"body": "no sha here"}, "abc").available


def test_support_bundle(tmp_path, monkeypatch):
    monkeypatch.setenv("CAR_APP_MANAGER_HOME", str(tmp_path / "home"))
    db = Database(); logger = ActionLogger(db)
    logger.note("hello", "world")
    out = write_support_bundle(tmp_path / "b.zip", logger, "DIAG", {"model": "T2"})
    with zipfile.ZipFile(out) as z:
        names = set(z.namelist())
        assert {"info.json", "actions.txt", "diagnostics.txt"} <= names
        info = json.loads(z.read("info.json"))
        assert info["device"]["model"] == "T2" and "app_version" in info
        assert b"hello" in z.read("actions.txt")
