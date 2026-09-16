"""Entry point."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QIcon, QFont
from PySide6.QtWidgets import QApplication, QDialog

from . import APP_NAME
from .app import AppContext
from .ui.first_run import FirstRunDialog
from .ui.main_window import MainWindow
from .ui.theme import DARK_QSS


def resource_path(name: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    p = base / "resources" / name
    if p.exists():
        return p
    return Path(__file__).resolve().parent / "resources" / name


def create_app(argv: list[str] | None = None) -> QApplication:
    app = QApplication.instance() or QApplication(argv or sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName("CarAppManager")
    app.setStyle("Fusion")
    app.setStyleSheet(DARK_QSS)
    if sys.platform == "win32":
        app.setFont(QFont("Segoe UI", 10))
    return app


def _cli(argv: list[str]) -> int | None:
    """Tiny non-GUI helpers, useful for support and for verifying a frozen build."""
    if "--version" in argv:
        from . import __version__
        print(f"{APP_NAME} {__version__}")
        return 0
    if "--inspect" in argv:
        import json
        from dataclasses import asdict
        from .apk.inspector import inspect_apk
        path = argv[argv.index("--inspect") + 1]
        info = inspect_apk(path)
        d = asdict(info)
        d["dangerous_permissions"] = info.dangerous_permissions
        print(json.dumps(d, ensure_ascii=False, indent=2))
        return 0
    return None


def main(argv: list[str] | None = None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    rc = _cli(argv)
    if rc is not None:
        return rc
    app = create_app(argv)
    icon_file = resource_path("icon.ico")
    icon = QIcon(str(icon_file)) if icon_file.exists() else QIcon()
    app.setWindowIcon(icon)
    ctx = AppContext()
    if not ctx.adb_available and os.environ.get("CAR_APP_MANAGER_SKIP_FIRSTRUN") != "1":
        dlg = FirstRunDialog()
        dlg.setWindowIcon(icon)
        if dlg.exec() == QDialog.Accepted and dlg.adb_path:
            ctx.set_adb_path(dlg.adb_path)
    win = MainWindow(ctx, icon)
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
