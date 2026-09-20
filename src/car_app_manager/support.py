"""Support bundle: one zip the user can send when something goes wrong (never includes secrets)."""
from __future__ import annotations

import json
import platform
import zipfile
from datetime import datetime
from pathlib import Path

from . import __version__
from .config import data_dir, logs_dir, settings_path


def build_info() -> dict:
    p = Path(__file__).resolve().parent / "resources" / "build.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"sha": "", "date": ""}


def write_support_bundle(dest: str | Path, logger, diagnostics_text: str = "", device_info: dict | None = None) -> Path:
    dest = Path(dest)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        meta = {
            "app_version": __version__, "build": build_info(), "created": datetime.now().isoformat(timespec="seconds"),
            "os": platform.platform(), "python": platform.python_version(), "device": device_info or {},
        }
        z.writestr("info.json", json.dumps(meta, ensure_ascii=False, indent=2))
        tmp = data_dir() / "_actions_export.txt"
        try:
            logger.export(tmp)
            z.write(tmp, "actions.txt")
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass
        for lf in sorted(logs_dir().glob("car_app_manager.log*")):
            z.write(lf, "logs/" + lf.name)
        sp = settings_path()
        if sp.exists():
            z.write(sp, "settings.json")  # contains paths and preferences only; API keys live in the credential store
        if diagnostics_text:
            z.writestr("diagnostics.txt", diagnostics_text)
    return dest
