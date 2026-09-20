import struct
import zipfile
from pathlib import Path

import pytest

from car_app_manager.apk.axml import AXMLError, parse_manifest
from car_app_manager.apk.inspector import inspect_apk

FIXTURE = Path(__file__).parent / "fixtures" / "fdroid_AndroidManifest.xml"


def test_parse_real_manifest():
    m = parse_manifest(FIXTURE.read_bytes())
    assert m.package == "org.fdroid.fdroid" and m.version_code == 1023052 and m.version_name == "1.23.2"
    assert m.min_sdk == 23 and m.target_sdk == 30
    assert "android.permission.INTERNET" in m.permissions and "android.permission.CAMERA" in m.permissions
    assert len(m.activities) == 25 and len(m.services) == 16 and len(m.receivers) == 16 and len(m.providers) == 4
    assert "android.hardware.nfc" in m.features and not m.split


def test_parse_rejects_garbage():
    with pytest.raises(AXMLError):
        parse_manifest(b"<?xml version='1.0'?><manifest/>")
    with pytest.raises(AXMLError):
        parse_manifest(b"\x03\x00\x08\x00" + struct.pack("<I", 8))  # valid header, no package


def _fake_apk(path: Path, signed: bool = True, abis=("arm64-v8a",)):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("AndroidManifest.xml", FIXTURE.read_bytes())
        for abi in abis:
            z.writestr(f"lib/{abi}/libx.so", b"\x7fELF")
        z.writestr("classes.dex", b"dex\n")
        if signed:
            z.writestr("META-INF/CERT.RSA", b"cert")


def test_inspect_apk_without_androguard(tmp_path, monkeypatch):
    import car_app_manager.apk.inspector as insp
    monkeypatch.setattr(insp, "_label_via_androguard", lambda p: (_ for _ in ()).throw(RuntimeError("no androguard")))
    apk = tmp_path / "x.apk"
    _fake_apk(apk)
    # even if the optional label lookup blows up, the essential fields must be present
    monkeypatch.setattr(insp, "_label_via_androguard", lambda p: "")
    info = inspect_apk(apk)
    assert info.parse_error == "" and info.package == "org.fdroid.fdroid" and info.min_sdk == 23
    assert info.native_abis == ["arm64-v8a"] and info.signed and info.sha256
    assert "android.permission.CAMERA" in info.dangerous_permissions
    unsigned = tmp_path / "u.apk"
    _fake_apk(unsigned, signed=False, abis=())
    info2 = inspect_apk(unsigned)
    assert not info2.signed and info2.native_abis == []


def test_inspect_apk_v2_signature_block(tmp_path, monkeypatch):
    import car_app_manager.apk.inspector as insp
    monkeypatch.setattr(insp, "_label_via_androguard", lambda p: "")
    apk = tmp_path / "v2.apk"
    _fake_apk(apk, signed=False)
    raw = apk.read_bytes()
    # splice a fake signing block before the central directory (zip readers ignore it)
    eocd = raw.rfind(b"PK\x05\x06")
    cd_start = struct.unpack_from("<I", raw, eocd + 16)[0]
    block = b"\x00" * 24 + b"APK Sig Block 42"
    new = raw[:cd_start] + block + raw[cd_start:eocd] + raw[eocd:eocd + 16] + struct.pack("<I", cd_start + len(block)) + raw[eocd + 20:]
    apk.write_bytes(new)
    info = inspect_apk(apk)
    assert info.package == "org.fdroid.fdroid" and info.signed
