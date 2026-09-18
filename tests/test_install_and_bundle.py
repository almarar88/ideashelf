import zipfile
from pathlib import Path

from car_app_manager.adb.install import Installer
from car_app_manager.apk.bundle import extract_bundle, select_splits, split_abi, is_base_apk


def _mk_bundle(path: Path, names: list[str], manifest: str | None = None, extra: dict | None = None):
    with zipfile.ZipFile(path, "w") as z:
        for n in names:
            z.writestr(n, b"PK-fake-" + n.encode())
        if manifest is not None:
            z.writestr("manifest.json", manifest)
        for k, v in (extra or {}).items():
            z.writestr(k, v)


def test_split_helpers():
    assert split_abi("split_config.arm64_v8a.apk") == "arm64-v8a"
    assert split_abi("base-armeabi_v7a.apk") == "armeabi-v7a"
    assert split_abi("config.x86_64.apk") == "x86_64"
    assert split_abi("split_config.ar.apk") is None
    assert is_base_apk("base.apk") and is_base_apk("com.foo.apk") and not is_base_apk("split_config.xxhdpi.apk")


def test_select_splits_picks_device_abi(tmp_path):
    files = [tmp_path / n for n in ["base.apk", "split_config.arm64_v8a.apk", "split_config.armeabi_v7a.apk",
                                    "split_config.xxhdpi.apk", "split_config.ar.apk"]]
    chosen = [p.name for p in select_splits(files, ["arm64-v8a", "armeabi-v7a"])]
    assert chosen[0] == "base.apk"
    assert "split_config.arm64_v8a.apk" in chosen and "split_config.armeabi_v7a.apk" not in chosen
    assert "split_config.xxhdpi.apk" in chosen and "split_config.ar.apk" in chosen


def test_select_splits_universal(tmp_path):
    files = [tmp_path / "universal.apk", tmp_path / "toc.pb"]
    assert [p.name for p in select_splits(files, ["arm64-v8a"])] == ["universal.apk"]


def test_extract_xapk_with_obb(tmp_path):
    b = tmp_path / "game.xapk"
    _mk_bundle(b, ["com.game.apk", "config.arm64_v8a.apk"],
               manifest='{"package_name": "com.game", "expansions": [{"file": "Android/obb/com.game/main.1.com.game.obb", "install_path": "/sdcard/Android/obb/com.game/main.1.com.game.obb"}]}',
               extra={"Android/obb/com.game/main.1.com.game.obb": b"obb"})
    bc = extract_bundle(b, tmp_path)
    try:
        assert bc.package == "com.game"
        assert sorted(p.name for p in bc.apks) == ["com.game.apk", "config.arm64_v8a.apk"]
        assert bc.obb_files[0][1] == "Android/obb/com.game/main.1.com.game.obb"
    finally:
        bc.cleanup()
    assert not bc.root.exists()


def test_zip_slip_guard(tmp_path):
    b = tmp_path / "evil.apks"
    _mk_bundle(b, ["../../evil.apk", "splits/base-master.apk"])
    bc = extract_bundle(b, tmp_path)
    try:
        assert [p.name for p in bc.apks] == ["base-master.apk"]
        assert not (tmp_path.parent / "evil.apk").exists()
    finally:
        bc.cleanup()


def test_install_apk_success(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    fake.when("install", out="Performing Streamed Install\nSuccess\n")
    res = Installer(runner).install(apk)
    assert res.success and res.method_used == "streamed" and fake.calls[-1][3:] == ["install", "-r", "-t", str(apk)]


def test_install_apk_failure_parsed(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    fake.when("install", rc=1, err="adb: failed to install a.apk: Failure [INSTALL_FAILED_NO_MATCHING_ABIS: ...]")
    res = Installer(runner).install(apk, downgrade=True)
    assert not res.success and res.error.code == "INSTALL_FAILED_NO_MATCHING_ABIS"
    assert "-d" in fake.calls[-1]
    assert "ABI" in res.message("en") and "معمارية" in res.message("ar")


def test_install_bundle_uses_install_multiple_and_pushes_obb(runner, fake, tmp_path):
    b = tmp_path / "game.xapk"
    _mk_bundle(b, ["com.game.apk", "config.arm64_v8a.apk", "config.x86.apk"],
               manifest='{"package_name": "com.game", "expansions": [{"file": "Android/obb/com.game/main.obb", "install_path": "/sdcard/Android/obb/com.game/main.obb"}]}',
               extra={"Android/obb/com.game/main.obb": b"obb"})
    fake.when("install-multiple", out="Success\n")
    fake.when("push", out="1 file pushed")
    fake.when("pm path com.game", out="package:/data/app/com.game/base.apk\n")
    res = Installer(runner, device_abis=["arm64-v8a"]).install(b)
    assert res.success and res.package == "com.game"
    im = next(c for c in fake.calls if "install-multiple" in c)
    names = [Path(x).name for x in im[im.index("install-multiple") + 1:] if x.endswith(".apk")]
    assert names == ["com.game.apk", "config.arm64_v8a.apk"]
    push = next(c for c in fake.calls if "push" in c)
    assert push[-1] == "/sdcard/Android/obb/com.game/main.obb"


def test_install_bundle_empty(runner, fake, tmp_path):
    b = tmp_path / "empty.apks"
    _mk_bundle(b, [])
    res = Installer(runner).install(b)
    assert not res.success and res.error.code == "EMPTY_BUNDLE"


def test_install_falls_back_to_legacy(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x" * 10)
    fake.when("TESTSERIAL install -r -t", rc=1, err="adb: failed to install a.apk: Failure [INSTALL_FAILED_INTERNAL_ERROR]")
    fake.when("push", out="1 file pushed")
    fake.when("pm install -r -t /data/local/tmp/cam_a.apk", out="Success\n")
    fake.when("pm path com.a", out="package:/data/app/a/base.apk\n")
    res = Installer(runner).install(apk, package="com.a")
    assert res.success and res.method_used == "legacy" and res.verified
    assert [a.method for a in res.attempts] == ["streamed", "legacy"]
    assert any("rm -f /data/local/tmp/cam_a.apk" in " ".join(c) for c in fake.calls)
    assert "INSTALL_FAILED_INTERNAL_ERROR" in res.transcript() and "pm install" in res.transcript()


def test_definitive_error_does_not_retry(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    fake.when("install", rc=1, err="Failure [INSTALL_FAILED_OLDER_SDK]")
    res = Installer(runner).install(apk)
    assert not res.success and res.error.code == "INSTALL_FAILED_OLDER_SDK" and res.error.definitive
    assert not fake.called("push") and "API 29" in res.hint("en")


def test_legacy_push_falls_back_to_sdcard(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    fake.when("pm install -r -t /sdcard/Download/cam_a.apk", out="Success")
    fake.when("/data/local/tmp/cam_a.apk", rc=1, err="adb: error: failed to copy: remote couldn't create file: Permission denied")
    fake.when("push", out="1 file pushed")
    from car_app_manager.adb.install import InstallOptions
    res = Installer(runner).install(apk, options=InstallOptions(method="legacy"))
    assert res.success and res.method_used == "legacy"


def test_verify_detects_missing_package(runner, fake, tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    fake.when("install", out="Success\n")
    fake.when("pm path com.gone", out="")
    res = Installer(runner).install(apk, package="com.gone")
    assert not res.success and res.error.code == "NOT_FOUND_AFTER_INSTALL"
    assert "Diagnostics" in res.hint("en")


def test_legacy_session_for_splits(runner, fake, tmp_path):
    base = tmp_path / "base.apk"; base.write_bytes(b"b" * 5)
    split = tmp_path / "split_config.arm64_v8a.apk"; split.write_bytes(b"s" * 3)
    fake.when("install-multiple", rc=1, err="Failure [INSTALL_FAILED_INTERNAL_ERROR]")
    fake.when("push", out="1 file pushed")
    fake.when("pm install-create", out="Success: created install session [77]\n")
    fake.when("pm install-write", out="Success: streamed 5 bytes\n")
    fake.when("pm install-commit 77", out="Success\n")
    fake.when("pm path com.s", out="package:/data/app/s/base.apk\n")
    res = Installer(runner, ["arm64-v8a"]).install_multiple([base, split], package="com.s")
    assert res.success and res.method_used == "legacy"
    create = next(c for c in fake.calls if "pm install-create" in " ".join(c))
    assert "-S 8" in " ".join(create)
    writes = [c for c in fake.calls if "pm install-write" in " ".join(c)]
    assert len(writes) == 2 and "77" in " ".join(writes[0])
    assert any("rm -rf /data/local/tmp/cam_split" in " ".join(c) for c in fake.calls)


def test_legacy_session_abandons_on_write_failure(runner, fake, tmp_path):
    base = tmp_path / "base.apk"; base.write_bytes(b"b")
    split = tmp_path / "split_config.ar.apk"; split.write_bytes(b"s")
    fake.when("push", out="1 file pushed")
    fake.when("pm install-create", out="Success: created install session [5]\n")
    fake.when("pm install-write", rc=1, out="Error: Failure [INSTALL_FAILED_INVALID_APK]")
    from car_app_manager.adb.install import InstallOptions
    res = Installer(runner).install_multiple([base, split], package="com.s", options=InstallOptions(method="legacy"))
    assert not res.success and res.error.code == "INSTALL_FAILED_INVALID_APK"
    assert fake.called("pm install-abandon 5") and not fake.called("pm install-commit")
