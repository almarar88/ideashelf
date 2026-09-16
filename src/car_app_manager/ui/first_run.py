"""First-run dialog shown when adb cannot be found."""
from __future__ import annotations

from PySide6.QtWidgets import QDialog, QFileDialog, QHBoxLayout, QLabel, QProgressBar, QVBoxLayout

from ..i18n import tr
from ..tools.platform_tools import download_platform_tools, verify_adb
from ..workers import run_in_background
from .widgets.common import StatusLine, button


class FirstRunDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("firstrun.title"))
        self.setMinimumWidth(520)
        self.adb_path: str = ""
        lay = QVBoxLayout(self)
        text = QLabel(tr("firstrun.text"))
        text.setWordWrap(True)
        lay.addWidget(text)
        self.progress = QProgressBar(); self.progress.setVisible(False)
        lay.addWidget(self.progress)
        self.status = StatusLine()
        lay.addWidget(self.status)
        row = QHBoxLayout()
        self.btn_dl = button(tr("firstrun.download"), "primary", self._download)
        self.btn_browse = button(tr("firstrun.browse"), slot=self._browse)
        self.btn_later = button(tr("firstrun.later"), slot=self.reject)
        row.addWidget(self.btn_dl); row.addWidget(self.btn_browse); row.addStretch(1); row.addWidget(self.btn_later)
        lay.addLayout(row)

    def _browse(self) -> None:
        p, _ = QFileDialog.getOpenFileName(self, tr("settings.adb_path"), "", "adb (adb.exe adb);;All (*)")
        if not p:
            return
        if verify_adb(p):
            self.adb_path = p
            self.accept()
        else:
            self.status.set(tr("settings.adb_bad"), "error")

    def _download(self) -> None:
        self.btn_dl.setEnabled(False)
        self.progress.setVisible(True)
        self.progress.setRange(0, 100)

        def prog(p):
            done, total = p
            pct = int(done * 100 / total) if total else 0
            self.progress.setValue(pct)
            self.status.set(tr("settings.adb_downloading", pct=pct))

        def done(path):
            self.adb_path = path
            self.accept()

        def fail(msg):
            self.btn_dl.setEnabled(True)
            self.progress.setVisible(False)
            self.status.set(tr("settings.adb_download_failed", msg=msg), "error")

        run_in_background(lambda progress: download_platform_tools(lambda d, t: progress((d, t))),
                          on_done=done, on_error=fail, on_progress=prog)
