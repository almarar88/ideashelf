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
    assert res.success and fake.calls[-1][3:] == ["install", "-r", str(apk)]


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
    res = Installer(runner, device_abis=["arm64-v8a"]).install(b)
    assert res.success and res.package == "com.game"
    im = next(c for c in fake.calls if "install-multiple" in c)
    names = [Path(x).name for x in im[im.index("install-multiple") + 2:]]
    assert names == ["com.game.apk", "config.arm64_v8a.apk"]
    push = next(c for c in fake.calls if "push" in c)
    assert push[-1] == "/sdcard/Android/obb/com.game/main.obb"


def test_install_bundle_empty(runner, fake, tmp_path):
    b = tmp_path / "empty.apks"
    _mk_bundle(b, [])
    res = Installer(runner).install(b)
    assert not res.success and res.error.code == "EMPTY_BUNDLE"
