"""Main window: sidebar navigation + stacked pages + status bar."""
from __future__ import annotations

from PySide6.QtCore import Qt, QByteArray
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import (QApplication, QFrame, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QMainWindow,
                               QPushButton, QStackedWidget, QStatusBar, QVBoxLayout, QWidget)

from .. import APP_NAME, __version__
from ..app import AppContext
from ..i18n import tr, current_lang
from ..workers import run_in_background
from .pages.apps_page import AppsPage
from .pages.backup_page import BackupPage
from .pages.device_page import DevicePage
from .pages.install_page import InstallPage
from .pages.logs_page import LogsPage
from .pages.screen_page import ScreenPage
from .pages.ai_page import AIPage
from .pages.settings_page import SettingsPage

NAV = ("device", "apps", "install", "screen", "backup", "logs", "ai", "settings")
NAV_ICONS = {"device": "🚗", "apps": "📱", "install": "📦", "screen": "🖥", "backup": "💾", "logs": "📜", "ai": "✨", "settings": "⚙"}


class MainWindow(QMainWindow):
    def __init__(self, ctx: AppContext, icon: QIcon | None = None):
        super().__init__()
        self.ctx = ctx
        if icon:
            self.setWindowIcon(icon)
        self.resize(1180, 760)
        self.setMinimumSize(900, 600)

        central = QWidget()
        lay = QHBoxLayout(central)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(210)
        sl = QVBoxLayout(self.sidebar)
        sl.setContentsMargins(0, 12, 0, 12)
        self.brand = QLabel()
        self.brand.setObjectName("title")
        self.brand.setAlignment(Qt.AlignCenter)
        self.brand.setWordWrap(True)
        sl.addWidget(self.brand)
        self.nav = QListWidget()
        self.nav.setObjectName("nav")
        self.nav.setFocusPolicy(Qt.NoFocus)
        for key in NAV:
            it = QListWidgetItem("")
            it.setData(Qt.UserRole, key)
            self.nav.addItem(it)
        self.nav.currentRowChanged.connect(self._switch)
        sl.addWidget(self.nav, 1)
        self.btn_lang = QPushButton()
        self.btn_lang.clicked.connect(self._toggle_lang)
        sl.addWidget(self.btn_lang)
        self.version_lbl = QLabel(f"v{__version__}")
        self.version_lbl.setObjectName("muted")
        self.version_lbl.setAlignment(Qt.AlignCenter)
        sl.addWidget(self.version_lbl)
        lay.addWidget(self.sidebar)

        self.stack = QStackedWidget()
        self.pages = {
            "device": DevicePage(ctx),
            "apps": AppsPage(ctx),
            "install": InstallPage(ctx),
            "screen": ScreenPage(ctx),
            "backup": BackupPage(ctx),
            "logs": LogsPage(ctx),
            "ai": AIPage(ctx),
            "settings": SettingsPage(ctx),
        }
        for key in NAV:
            self.stack.addWidget(self.pages[key])
        lay.addWidget(self.stack, 1)
        self.setCentralWidget(central)

        self.status = QStatusBar()
        self.setStatusBar(self.status)
        self.status_device = QLabel()
        self.status_adb = QLabel()
        self.status.addWidget(self.status_device, 1)
        self.status.addPermanentWidget(self.status_adb)

        ctx.device_changed.connect(lambda _d: self._update_status())
        ctx.adb_changed.connect(lambda _p: self._update_adb_status())
        ctx.language_changed.connect(lambda _l: self.retranslate())
        self.retranslate()
        self._update_adb_status()
        self.nav.setCurrentRow(0)
        if ctx.settings.window_geometry:
            try:
                self.restoreGeometry(QByteArray.fromBase64(ctx.settings.window_geometry.encode()))
            except Exception:
                pass

    def retranslate(self) -> None:
        self.setWindowTitle(f"{tr('app.title')} — {APP_NAME}" if current_lang() == "ar" else f"{APP_NAME} — {tr('app.title')}")
        self.brand.setText(tr("app.title"))
        for i, key in enumerate(NAV):
            self.nav.item(i).setText(f"{NAV_ICONS[key]}  {tr('nav.' + key)}")
        self.btn_lang.setText(tr("lang.switch"))
        QApplication.instance().setLayoutDirection(Qt.RightToLeft if current_lang() == "ar" else Qt.LeftToRight)
        self._update_status()
        self._update_adb_status()

    def _toggle_lang(self) -> None:
        self.ctx.set_language("en" if current_lang() == "ar" else "ar")

    def _switch(self, row: int) -> None:
        if row < 0:
            return
        self.stack.setCurrentIndex(row)
        page = self.pages[NAV[row]]
        page.on_show()

    def _update_status(self) -> None:
        d = self.ctx.current_device
        if d is None:
            self.status_device.setText(tr("status.no_device"))
        else:
            st = {"device": tr("status.connected"), "unauthorized": tr("status.unauthorized"), "offline": tr("status.offline")}.get(d.state, d.state)
            self.status_device.setText(f"{st}: {d.display_name}")

    def _update_adb_status(self) -> None:
        if not self.ctx.adb_available:
            self.status_adb.setText(f"{tr('status.adb')}: {tr('status.adb_missing')}")
            return
        self.status_adb.setText(f"{tr('status.adb')}: …")
        run_in_background(self.ctx.runner.version, on_done=lambda v: self.status_adb.setText(f"{tr('status.adb')}: {v or tr('status.adb_missing')}"))

    def closeEvent(self, e) -> None:
        try:
            self.pages["screen"].shutdown()
        except Exception:
            pass
        try:
            self.ctx.settings.window_geometry = bytes(self.saveGeometry().toBase64()).decode()
            self.ctx.settings.save()
        except Exception:
            pass
        super().closeEvent(e)
