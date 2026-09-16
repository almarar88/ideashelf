"""Curated, user-editable app catalog stored as JSON in the app data folder."""
from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from .config import data_dir

CATALOG_NAME = "catalog.json"
DOWNLOAD_EXTENSIONS = (".apk", ".apks", ".xapk", ".apkm")


@dataclass
class CatalogEntry:
    id: str
    name: str
    package: str = ""
    category: str = ""
    description_en: str = ""
    description_ar: str = ""
    source_url: str = ""
    tested_on_t2: bool = False
    notes: str = ""
    sha256: str = ""  # optional: known-good hash of the file the user tested

    def description(self, lang: str) -> str:
        return (self.description_ar if lang == "ar" else self.description_en) or self.description_en or self.description_ar

    @property
    def direct_download(self) -> bool:
        return self.source_url.lower().split("?")[0].endswith(DOWNLOAD_EXTENSIONS)


def catalog_path() -> Path:
    return data_dir() / CATALOG_NAME


def seed_path() -> Path:
    return Path(__file__).resolve().parent / "resources" / CATALOG_NAME


class Catalog:
    def __init__(self, path: Optional[Path] = None):
        self.path = path or catalog_path()
        self.entries: list[CatalogEntry] = []
        self.load()

    # ---- persistence ------------------------------------------------------------------
    def load(self) -> None:
        if not self.path.exists() and seed_path().exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(seed_path(), self.path)
        self.entries = []
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                for e in raw.get("apps", []):
                    self.entries.append(self._from_dict(e))
            except (OSError, ValueError):
                self.entries = []

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"version": 1, "apps": [asdict(e) for e in self.entries]}
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    @staticmethod
    def _from_dict(d: dict) -> CatalogEntry:
        fields = {k: v for k, v in d.items() if k in CatalogEntry.__dataclass_fields__}
        fields.setdefault("id", str(d.get("package") or d.get("name") or "entry"))
        fields.setdefault("name", fields["id"])
        return CatalogEntry(**fields)

    # ---- editing ------------------------------------------------------------------------
    def get(self, entry_id: str) -> Optional[CatalogEntry]:
        return next((e for e in self.entries if e.id == entry_id), None)

    def upsert(self, entry: CatalogEntry) -> None:
        for i, e in enumerate(self.entries):
            if e.id == entry.id:
                self.entries[i] = entry
                break
        else:
            self.entries.append(entry)
        self.save()

    def remove(self, entry_id: str) -> None:
        self.entries = [e for e in self.entries if e.id != entry_id]
        self.save()

    def set_tested(self, entry_id: str, tested: bool, sha256: str = "") -> None:
        e = self.get(entry_id)
        if e:
            e.tested_on_t2 = tested
            if sha256:
                e.sha256 = sha256
            self.save()

    def import_file(self, path: Path, replace: bool = False) -> int:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        new = [self._from_dict(e) for e in raw.get("apps", [])]
        if replace:
            self.entries = new
        else:
            ids = {e.id for e in self.entries}
            self.entries.extend(e for e in new if e.id not in ids)
        self.save()
        return len(new)

    def export_file(self, path: Path) -> None:
        Path(path).write_text(json.dumps({"version": 1, "apps": [asdict(e) for e in self.entries]}, ensure_ascii=False, indent=2), encoding="utf-8")

    def new_id(self, base: str) -> str:
        base = "".join(c for c in base.lower() if c.isalnum() or c in "._-") or "app"
        cand, n = base, 2
        while self.get(cand):
            cand = f"{base}-{n}"; n += 1
        return cand
