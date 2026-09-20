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
    here = Path(__file__).resolve().parent
    candidates = [here / "resources" / name]
    mei = getattr(sys, "_MEIPASS", None)
    if mei:
        candidates = [Path(mei) / "car_app_manager" / "resources" / name, Path(mei) / "resources" / name] + candidates
    for c in candidates:
        if c.exists():
            return c
    return candidates[-1]


def harden_stdio() -> None:
    """A windowed (no console) exe has sys.stdout/sys.stderr = None. Anything that writes to them raises
    AttributeError - that is what broke APK parsing in the frozen build. Route them to a log file instead."""
    if sys.stdout is not None and sys.stderr is not None:
        return
    try:
        from .config import logs_dir
        f = open(logs_dir() / "stdio.log", "a", encoding="utf-8", errors="replace", buffering=1)
    except Exception:  # pragma: no cover
        f = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = f
    if sys.stderr is None:
        sys.stderr = f


def install_excepthook() -> None:
    """Log uncaught exceptions (PySide slots swallow them otherwise) and show them once to the user."""
    import logging
    import traceback
    log = logging.getLogger("car_app_manager.crash")
    shown = {"n": 0}

    def hook(exc_type, exc, tb):
        text = "".join(traceback.format_exception(exc_type, exc, tb))
        log.error("uncaught exception:\n%s", text)
        try:
            sys.__stderr__ and sys.__stderr__.write(text)
        except Exception:
            pass
        if shown["n"] < 3 and QApplication.instance():
            shown["n"] += 1
            try:
                from PySide6.QtWidgets import QMessageBox
                box = QMessageBox(QMessageBox.Critical, "Car App Manager",
                                  "Unexpected error (logged to %LOCALAPPDATA%\\CarAppManager\\logs):\n\n" + text[-1500:])
                box.setAttribute(Qt.WA_DeleteOnClose, True)
                box.show()  # non-modal: never blocks the event loop (or a test)
                hook.boxes.append(box)
            except Exception:
                pass

    hook.boxes = []
    sys.excepthook = hook


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
        text = json.dumps(d, ensure_ascii=False, indent=2)
        if "--out" in argv:  # a windowed exe has no stdout; write to a file instead
            Path(argv[argv.index("--out") + 1]).write_text(text, encoding="utf-8")
        else:
            print(text)
        return 0
    return None


def apk_args(argv: list[str]) -> list[str]:
    """APK / bundle paths passed on the command line (Open with…, drag onto the exe)."""
    from .apk.bundle import APK_EXTENSIONS
    return [a for a in argv if not a.startswith("-") and a.lower().endswith(APK_EXTENSIONS) and os.path.isfile(a)]


def main(argv: list[str] | None = None) -> int:
    harden_stdio()
    argv = list(argv if argv is not None else sys.argv[1:])
    rc = _cli(argv)
    if rc is not None:
        return rc
    app = create_app(argv)
    install_excepthook()
    icon_file = resource_path("icon.ico")
    icon = QIcon(str(icon_file)) if icon_file.exists() else QIcon()
    app.setWindowIcon(icon)
    ctx = AppContext()
    import logging
    from . import __version__
    from .support import build_info
    logging.getLogger("car_app_manager").info("app started v%s build=%s adb=%s", __version__, build_info().get("sha", "")[:12], ctx.adb_path or "-")
    if not ctx.adb_available and os.environ.get("CAR_APP_MANAGER_SKIP_FIRSTRUN") != "1":
        dlg = FirstRunDialog()
        dlg.setWindowIcon(icon)
        if dlg.exec() == QDialog.Accepted and dlg.adb_path:
            ctx.set_adb_path(dlg.adb_path)
    win = MainWindow(ctx, icon)
    win.show()
    files = apk_args(argv)
    if files:
        win.open_install_with(files)
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
