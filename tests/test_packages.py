import pytest
from car_app_manager.adb.packages import PackageManager, parse_dumpsys_package, parse_stat_sizes
from car_app_manager.adb.protection import ProtectedPackageError, is_protected, matches_protected_prefix

DUMPSYS = """Packages:
  Package [com.example.app] (abc):
    userId=10123
    codePath=/data/app/com.example.app-1
    versionCode=42 minSdk=21 targetSdk=29
    versionName=1.2.3
    firstInstallTime=2024-01-01 10:00:00
    lastUpdateTime=2024-02-01 10:00:00
"""


def test_protection_rules():
    assert matches_protected_prefix("com.chery.launcher")
    assert matches_protected_prefix("com.jetour.settings")
    assert matches_protected_prefix("com.qualcomm.qti.x")
    assert matches_protected_prefix("android.ext.services")
    assert matches_protected_prefix("com.android.systemui")
    assert not matches_protected_prefix("com.androidx.fake")  # prefix must be exactly com.android.
    assert not matches_protected_prefix("com.spotify.music")
    assert is_protected("com.some.oem.app", {"com.some.oem.app"})
    assert not is_protected("com.spotify.music", {"com.some.oem.app"})


def test_parse_dumpsys():
    d = parse_dumpsys_package(DUMPSYS)
    assert d["versionName"] == "1.2.3" and d["versionCode"] == "42"
    assert d["firstInstallTime"] == "2024-01-01"


def test_parse_stat_sizes():
    s = parse_stat_sizes("1234 /data/app/a/base.apk\n99 /data/app/b/split_config.arm64_v8a.apk\nbad line\n")
    assert s == {"/data/app/a/base.apk": 1234, "/data/app/b/split_config.arm64_v8a.apk": 99}


def test_list_user_apps(runner, fake):
    fake.when("pm list packages -s", out="package:com.android.systemui\npackage:com.chery.hmi\n")
    fake.when("pm list packages -3", out="package:com.spotify.music\npackage:org.videolan.vlc\n")
    fake.when("dumpsys package com.spotify.music", out=DUMPSYS.replace("com.example.app", "com.spotify.music"))
    fake.when("dumpsys package org.videolan.vlc", out="versionName=3.5\nversionCode=350")
    fake.when("pm path com.spotify.music", out="package:/data/app/spot/base.apk\npackage:/data/app/spot/split_config.arm64_v8a.apk\n")
    fake.when("pm path org.videolan.vlc", out="package:/data/app/vlc/base.apk\n")
    fake.when("stat -c", out="1000 /data/app/spot/base.apk\n500 /data/app/spot/split_config.arm64_v8a.apk\n2000 /data/app/vlc/base.apk\n")
    pm = PackageManager(runner)
    apps = pm.list_user_apps()
    assert [a.package for a in apps] == ["com.spotify.music", "org.videolan.vlc"]
    assert apps[0].version_name == "1.2.3" and apps[0].size_bytes == 1500 and not apps[0].protected
    assert apps[1].version_code == 350 and apps[1].size_bytes == 2000


def test_uninstall_refuses_protected(runner, fake):
    fake.when("pm list packages -s", out="package:com.vendor.thing\n")
    pm = PackageManager(runner)
    with pytest.raises(ProtectedPackageError):
        pm.uninstall("com.chery.hmi")
    with pytest.raises(ProtectedPackageError):
        pm.uninstall("com.vendor.thing")  # system app even without vendor prefix
    with pytest.raises(ProtectedPackageError):
        pm.clear_data("com.android.settings")
    with pytest.raises(ProtectedPackageError):
        pm.force_stop("com.jetour.x")
    assert not fake.called("uninstall") and not fake.called("pm clear") and not fake.called("force-stop")


def test_uninstall_user_app(runner, fake):
    fake.when("pm list packages -s", out="")
    fake.when("uninstall com.spotify.music", out="Success\n")
    r = PackageManager(runner).uninstall("com.spotify.music")
    assert r.ok and fake.calls[-1][-2:] == ["uninstall", "com.spotify.music"]


def test_uninstall_failure_explained(runner, fake):
    fake.when("pm list packages -s", out="")
    fake.when("uninstall com.x", out="Failure [DELETE_FAILED_DEVICE_POLICY_MANAGER]\n")
    r = PackageManager(runner).uninstall("com.x")
    assert not r.ok and r.extra["explained"].code == "DELETE_FAILED_DEVICE_POLICY_MANAGER"


def test_launch_prefers_resolved_activity(runner, fake):
    fake.when("resolve-activity", out="com.x/.MainActivity\n")
    PackageManager(runner).launch("com.x")
    assert fake.calls[-1][-1] == "am start -n com.x/.MainActivity"


def test_launch_falls_back_to_monkey(runner, fake):
    fake.when("resolve-activity", out="No activity found\n")
    PackageManager(runner).launch("com.x")
    assert "monkey -p com.x" in fake.calls[-1][-1]


def test_export_apk(runner, fake, tmp_path):
    fake.when("pm path com.x", out="package:/data/app/x/base.apk\n")

    def executor(args, timeout):
        fake.calls.append(list(args))
        if args[3] == "pull":
            open(args[5], "wb").write(b"apk")
            return 0, "1 file pulled", ""
        return fake(args, timeout)
    runner._executor = executor
    files = PackageManager(runner).export_apk("com.x", tmp_path)
    assert len(files) == 1 and files[0].name == "com.x.apk" and files[0].read_bytes() == b"apk"
