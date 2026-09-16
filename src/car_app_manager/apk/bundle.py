"""Split bundles: .apks (bundletool) and .xapk (APKPure style)."""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

BUNDLE_EXTENSIONS = (".apks", ".xapk", ".apkm")
APK_EXTENSIONS = (".apk",) + BUNDLE_EXTENSIONS

_ABI_TOKENS = {
    "arm64_v8a": "arm64-v8a", "arm64-v8a": "arm64-v8a",
    "armeabi_v7a": "armeabi-v7a", "armeabi-v7a": "armeabi-v7a",
    "x86_64": "x86_64", "x86": "x86",
}
_DPI_TOKENS = ("ldpi", "mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi", "tvdpi", "nodpi")


@dataclass
class BundleContents:
    root: Path  # extraction directory (temporary)
    apks: list[Path] = field(default_factory=list)  # all .apk found
    obb_files: list[tuple[Path, str]] = field(default_factory=list)  # (local, device relative path under /sdcard/)
    package: str = ""
    manifest: dict = field(default_factory=dict)

    def cleanup(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


def split_abi(name: str) -> Optional[str]:
    """Return the ABI a split file is for, or None if not an ABI split."""
    stem = Path(name).stem.lower()
    for tok, abi in _ABI_TOKENS.items():
        if re.search(rf"(?:^|[._-])(?:config\.)?{re.escape(tok)}$", stem):
            return abi
    return None


def split_dpi(name: str) -> Optional[str]:
    stem = Path(name).stem.lower()
    for tok in _DPI_TOKENS:
        if re.search(rf"(?:^|[._-])(?:config\.)?{tok}$", stem):
            return tok
    return None


def is_base_apk(name: str) -> bool:
    stem = Path(name).stem.lower()
    return stem in ("base", "base-master") or stem == "universal" or (not stem.startswith(("config.", "base-", "split_")) and split_abi(name) is None and split_dpi(name) is None)


def select_splits(apks: list[Path], device_abis: list[str]) -> list[Path]:
    """Pick base + language/other splits + the best matching ABI split.

    Density splits are all kept (harmless). If the bundle has a universal apk, use only it.
    """
    universal = [p for p in apks if p.stem.lower() == "universal"]
    if universal:
        return universal[:1]
    chosen: list[Path] = []
    abi_splits: dict[str, Path] = {}
    for p in apks:
        abi = split_abi(p.name)
        if abi:
            abi_splits[abi] = p
        else:
            chosen.append(p)
    if abi_splits:
        for abi in device_abis or []:
            if abi in abi_splits:
                chosen.append(abi_splits[abi])
                break
        else:
            # unknown device -> include all ABI splits and let pm decide
            if not device_abis:
                chosen.extend(abi_splits.values())
    # base first
    chosen.sort(key=lambda p: (0 if is_base_apk(p.name) else 1, p.name))
    return chosen


def extract_bundle(path: str | os.PathLike, work_dir: Optional[str | os.PathLike] = None) -> BundleContents:
    src = Path(path)
    root = Path(tempfile.mkdtemp(prefix="cam_bundle_", dir=str(work_dir) if work_dir else None))
    bc = BundleContents(root=root)
    with zipfile.ZipFile(src) as z:
        for member in z.infolist():
            name = member.filename
            if member.is_dir() or name.startswith("/") or ".." in name.split("/"):
                continue  # zip-slip guard
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(member) as fsrc, open(target, "wb") as fdst:
                shutil.copyfileobj(fsrc, fdst)
    for p in sorted(root.rglob("*.apk")):
        bc.apks.append(p)
    manifest_json = root / "manifest.json"
    if manifest_json.exists():
        try:
            bc.manifest = json.loads(manifest_json.read_text(encoding="utf-8"))
            bc.package = str(bc.manifest.get("package_name", ""))
            for exp in bc.manifest.get("expansions", []) or []:
                f = exp.get("file")
                inst = exp.get("install_path", "")
                if f and (root / f).exists():
                    rel = inst
                    if rel.startswith("/sdcard/"):
                        rel = rel[len("/sdcard/"):]
                    elif rel.startswith("/storage/emulated/0/"):
                        rel = rel[len("/storage/emulated/0/"):]
                    bc.obb_files.append((root / f, rel))
        except ValueError:
            pass
    if not bc.obb_files:
        for obb in root.rglob("*.obb"):
            try:
                rel = obb.relative_to(root).as_posix()
            except ValueError:
                continue
            if rel.startswith("Android/obb/"):
                bc.obb_files.append((obb, rel))
    return bc
