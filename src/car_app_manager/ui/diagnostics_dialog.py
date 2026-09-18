"""Diagnostics dialog: runs checks in a worker, shows results, exports a report, offers reversible fixes."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QDialog, QFileDialog, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QVBoxLayout

from ..adb.diagnostics import DiagReport, run_diagnostics, set_adb_verification
from ..i18n import tr, current_lang
from ..workers import run_in_background
from .widgets.common import StatusLine, button, confirm

COLORS = {"ok": "#4cd964", "warn": "#ffb84d", "error": "#ff6b6b", "info": "#9aa0a6"}


class DiagnosticsDialog(QDialog):
    def __init__(self, ctx, parent=None):
        super().__init__(parent)
        self.ctx = ctx
        self.report: DiagReport | None = None
        self.setWindowTitle(tr("diag.title"))
        self.resize(820, 560)
        lay = QVBoxLayout(self)
        intro = QLabel(tr("diag.intro")); intro.setWordWrap(True)
        lay.addWidget(intro)
        self.list = QListWidget()
        lay.addWidget(self.list, 1)
        self.status = StatusLine(); lay.addWidget(self.status)
        row = QHBoxLayout()
        self.btn_run = button(tr("diag.run"), "primary", self.run)
        self.btn_export = button(tr("diag.export"), slot=self._export); self.btn_export.setEnabled(False)
        self.btn_disable = button(tr("diag.disable_verify"), "danger", lambda: self._set_verify(False))
        self.btn_enable = button(tr("diag.enable_verify"), slot=lambda: self._set_verify(True))
        for b in (self.btn_run, self.btn_export, self.btn_disable, self.btn_enable):
            row.addWidget(b)
        row.addStretch(1)
        row.addWidget(button(tr("close"), slot=self.accept))
        lay.addLayout(row)
        self._busy = False

    def run(self) -> None:
        if self._busy:
            return
        self._busy = True
        self.list.clear(); self.btn_run.setEnabled(False)
        run_in_background(run_diagnostics, self.ctx.runner, self.ctx.adb_path, on_done=self._done,
                          on_error=self._fail, on_progress=lambda st: self.status.set(tr("diag.running", step=st)))

    def _fail(self, msg: str) -> None:
        self._busy = False; self.btn_run.setEnabled(True)
        self.status.set(msg, "error")

    def _done(self, rep: DiagReport) -> None:
        self._busy = False; self.btn_run.setEnabled(True); self.btn_export.setEnabled(True)
        self.report = rep
        lang = current_lang()
        for it in rep.items:
            mark = {"ok": "✔", "warn": "⚠", "error": "✖", "info": "•"}[it.level]
            li = QListWidgetItem(f"{mark} {it.text(lang)}" + (f"\n    {it.raw.strip()[:300]}" if it.raw.strip() and it.level != "ok" else ""))
            li.setForeground(QColor(COLORS[it.level]))
            self.list.addItem(li)
        self.status.set(tr("diag.done"), rep.worst if rep.worst != "ok" else "ok")
        self.ctx.logger.note("diagnostics", rep.to_text("en")[:4000], success=rep.worst != "error", device=self.ctx.runner.serial or "")

    def _export(self) -> None:
        if not self.report:
            return
        path, _ = QFileDialog.getSaveFileName(self, tr("diag.export"), "car_diagnostics.txt", "Text (*.txt)")
        if path:
            from pathlib import Path
            Path(path).write_text(self.report.to_text("en") + "\n\n" + self.report.to_text("ar"), encoding="utf-8")
            self.status.set(tr("logs.exported", path=path), "ok")

    def _set_verify(self, enabled: bool) -> None:
        if self._busy or not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn"); return
        if not enabled and not confirm(self, tr("diag.confirm_disable"), danger=True):
            return
        self.ctx.logger.note("adb verification " + ("enabled" if enabled else "disabled"), "", device=self.ctx.runner.serial or "")
        run_in_background(set_adb_verification, self.ctx.runner, enabled,
                          on_done=lambda outs: self.status.set(tr("diag.applied", out="; ".join(outs)), "ok"),
                          on_error=lambda m: self.status.set(m, "error"))
