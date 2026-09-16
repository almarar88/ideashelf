import io
import json
import urllib.error
from pathlib import Path

import pytest

from car_app_manager.catalog import Catalog, CatalogEntry, seed_path
from car_app_manager.security import secrets
from car_app_manager.security.virustotal import lookup, parse_response, VTResult


def test_seed_catalog_is_valid_and_untested():
    data = json.loads(seed_path().read_text(encoding="utf-8"))
    assert len(data["apps"]) >= 5
    for e in data["apps"]:
        assert e["source_url"].startswith("https://") and e["name"]
        assert e["tested_on_t2"] is False  # nothing in the seed claims to be tested


def test_catalog_seed_copy_and_edit(tmp_path):
    c = Catalog(tmp_path / "catalog.json")
    assert (tmp_path / "catalog.json").exists() and c.get("fdroid")
    c.set_tested("fdroid", True, sha256="abc")
    c2 = Catalog(tmp_path / "catalog.json")
    assert c2.get("fdroid").tested_on_t2 and c2.get("fdroid").sha256 == "abc"
    e = CatalogEntry(id=c2.new_id("My App"), name="My App", source_url="https://example.com/app.apk")
    assert e.id == "myapp" and e.direct_download
    c2.upsert(e)
    c2.remove("fdroid")
    c3 = Catalog(tmp_path / "catalog.json")
    assert c3.get("myapp") and not c3.get("fdroid")
    assert not CatalogEntry(id="x", name="x", source_url="https://example.com/page").direct_download


def test_catalog_import_export(tmp_path):
    c = Catalog(tmp_path / "c.json")
    out = tmp_path / "exp.json"
    c.export_file(out)
    other = Catalog(tmp_path / "other.json")
    other.entries = []
    other.save()
    assert other.import_file(out) == len(c.entries)
    assert len(Catalog(tmp_path / "other.json").entries) == len(c.entries)
    # partial / malformed entries get defaults
    (tmp_path / "bad.json").write_text('{"apps": [{"name": "Only Name"}]}', encoding="utf-8")
    other.import_file(tmp_path / "bad.json")
    assert other.get("Only Name").name == "Only Name"


def test_vt_parse_and_levels():
    r = parse_response("h", {"data": {"attributes": {"last_analysis_stats": {"malicious": 2, "suspicious": 0, "harmless": 60, "undetected": 5},
                                                     "last_analysis_date": 1700000000, "names": ["a.apk"]}}})
    assert r.status == "found" and r.total == 67 and r.level == "error" and r.scan_date == "2023-11-14"
    assert "2" in r.summary("ar") and "malicious" in r.summary("en")
    assert VTResult("h", "found").level == "ok" and VTResult("h", "not_found").level == "warn"
    assert "virustotal.com/gui/file/h" in r.permalink


class _Resp(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False


def test_vt_http_codes():
    def opener_for(code=None, body=None):
        def opener(req):
            assert req.get_header("X-apikey") == "KEY"
            if code:
                raise urllib.error.HTTPError(req.full_url, code, "x", {}, None)
            return _Resp(json.dumps(body).encode())
        return opener
    assert lookup("h", "KEY", opener=opener_for(404)).status == "not_found"
    assert lookup("h", "KEY", opener=opener_for(401)).status == "invalid_key"
    assert lookup("h", "KEY", opener=opener_for(429)).status == "quota"
    assert lookup("h", "KEY", opener=opener_for(500)).status == "error"
    ok = lookup("h", "KEY", opener=opener_for(body={"data": {"attributes": {"last_analysis_stats": {"malicious": 0, "harmless": 3}}}}))
    assert ok.status == "found" and ok.total == 3
    assert lookup("h", "").status == "invalid_key"


def test_secrets_memory_fallback(monkeypatch):
    monkeypatch.setattr(secrets, "_backend_ok", lambda: False)
    assert secrets.set_secret("virustotal", "k1") is False
    assert secrets.get_secret("virustotal") == "k1"
    secrets.set_secret("virustotal", "")
    assert secrets.get_secret("virustotal") == ""


def test_secrets_uses_keyring_when_available(monkeypatch):
    store = {}

    class FakeKeyring:
        @staticmethod
        def get_password(svc, name): return store.get((svc, name))
        @staticmethod
        def set_password(svc, name, val): store[(svc, name)] = val
        @staticmethod
        def delete_password(svc, name): store.pop((svc, name), None)
    monkeypatch.setattr(secrets, "_backend_ok", lambda: True)
    monkeypatch.setitem(__import__("sys").modules, "keyring", FakeKeyring)
    assert secrets.set_secret("virustotal", "abc") is True
    assert store[("CarAppManager", "virustotal")] == "abc" and secrets.get_secret("virustotal") == "abc"
