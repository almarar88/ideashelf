"""Screenshots via `adb exec-out screencap -p`."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .runner import AdbRunner

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def take_screenshot(runner: AdbRunner, dest_dir: str | Path, prefix: str = "car") -> Path:
    rc, data, err = runner.run_raw("exec-out", "screencap", "-p", timeout=60, action="screenshot")
    if rc != 0:
        raise RuntimeError(err.strip() or f"screencap failed (rc={rc})")
    if not data.startswith(PNG_MAGIC):
        # some old adb builds mangle \n -> \r\n on Windows; undo it
        fixed = data.replace(b"\r\n", b"\n")
        if fixed.startswith(PNG_MAGIC):
            data = fixed
        else:
            raise RuntimeError("screencap did not return a PNG image")
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    out = Path(dest_dir) / f"{prefix}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"
    out.write_bytes(data)
    return out
