from car_app_manager.apk.inspector import ApkInfo, check_compatibility, worst_level, abi_compatible, sha256_file, inspect_apk


def test_sha256(tmp_path):
    f = tmp_path / "x.bin"; f.write_bytes(b"hello")
    assert sha256_file(f) == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


def test_inspect_non_apk_reports_error(tmp_path):
    f = tmp_path / "bad.apk"; f.write_bytes(b"not a zip")
    info = inspect_apk(f)
    assert info.sha256 and info.parse_error


def test_compat_min_sdk_error():
    info = ApkInfo(path="a.apk", package="com.x", min_sdk=33, permissions=[])
    checks = check_compatibility(info, device_sdk=29, device_abis=["arm64-v8a"])
    assert worst_level(checks) == "error"
    assert any(c.key == "min_sdk" and c.level == "error" for c in checks)


def test_compat_abi_error_and_dangerous_permissions():
    info = ApkInfo(path="a.apk", package="com.x", min_sdk=21, native_abis=["x86"],
                   permissions=["android.permission.CAMERA", "android.permission.INTERNET"])
    checks = check_compatibility(info, 29, ["arm64-v8a", "armeabi-v7a"])
    keys = {c.key: c for c in checks}
    assert keys["abi"].level == "error" and keys["permissions"].level == "warn"
    assert "CAMERA" in keys["permissions"].en
    assert info.dangerous_permissions == ["android.permission.CAMERA"]


def test_compat_update_detection():
    info = ApkInfo(path="a.apk", package="com.x", min_sdk=21, version_name="2.0", version_code=20)
    up = {c.key for c in check_compatibility(info, 29, ["arm64-v8a"], installed_version=("1.0", 10))}
    assert "update" in up
    same = {c.key for c in check_compatibility(info, 29, ["arm64-v8a"], installed_version=("2.0", 20))}
    assert "same_version" in same
    down = {c.key for c in check_compatibility(info, 29, ["arm64-v8a"], installed_version=("3.0", 30))}
    assert "downgrade" in down


def test_abi_compat():
    assert abi_compatible([], ["arm64-v8a"])
    assert abi_compatible(["armeabi-v7a"], ["arm64-v8a", "armeabi-v7a"])
    assert not abi_compatible(["x86"], ["arm64-v8a"])


def test_parse_error_yields_single_warning():
    info = ApkInfo(path="a.apk", parse_error="boom")
    checks = check_compatibility(info, 29, [])
    assert len(checks) == 1 and checks[0].level == "warn"
