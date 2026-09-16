"""Logs page: every action with command, result, stdout/stderr; export to file."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QAbstractItemView, QFileDialog, QHBoxLayout, QHeaderView, QLineEdit, QSplitter,
                               QTableWidget, QTableWidgetItem, QTextEdit)

from ...db import ActionRow
from ...i18n import tr
from ..widgets.common import StatusLine, button, confirm, title_label
from .base import BasePage


class LogsPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        bar = QHBoxLayout()
        self.search = QLineEdit()
        self.search.textChanged.connect(lambda _t: self._debounce.start())
        self.btn_refresh = button("", slot=self.reload)
        self.btn_export = button("", slot=self._export)
        self.btn_clear = button("", "danger", self._clear)
        bar.addWidget(self.search, 1)
        for b in (self.btn_refresh, self.btn_export, self.btn_clear):
            bar.addWidget(b)
        self.root.addLayout(bar)
        split = QSplitter(Qt.Vertical)
        self.table = QTableWidget(0, 4)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.itemSelectionChanged.connect(self._show)
        split.addWidget(self.table)
        self.detail = QTextEdit()
        self.detail.setReadOnly(True)
        split.addWidget(self.detail)
        split.setSizes([360, 200])
        self.root.addWidget(split, 1)
        self.status = StatusLine()
        self.root.addWidget(self.status)
        self.rows: list[ActionRow] = []
        self._debounce = QTimer(self); self._debounce.setSingleShot(True); self._debounce.setInterval(250)
        self._debounce.timeout.connect(self.reload)
        self._dirty = False
        self.ctx.logger.add_listener(self._on_new_row)
        self._poll = QTimer(self); self._poll.setInterval(1500); self._poll.timeout.connect(self._maybe_reload); self._poll.start()

    def retranslate(self) -> None:
        self.title.setText(tr("logs.title"))
        self.search.setPlaceholderText(tr("search"))
        self.btn_refresh.setText(tr("refresh"))
        self.btn_export.setText(tr("logs.export"))
        self.btn_clear.setText(tr("logs.clear"))
        self.table.setHorizontalHeaderLabels([tr("logs.col.time"), tr("logs.col.action"), tr("logs.col.result"), tr("logs.col.device")])
        self.reload()

    def on_show(self) -> None:
        self.reload()

    def _on_new_row(self, _row: ActionRow) -> None:
        self._dirty = True  # called from worker threads; the timer picks it up on the GUI thread

    def _maybe_reload(self) -> None:
        if self._dirty and self.isVisible():
            self._dirty = False
            self.reload()

    def reload(self) -> None:
        self.rows = self.ctx.db.actions(limit=1000, search=self.search.text().strip())
        sel = self.table.currentRow()
        self.table.setRowCount(0)
        for r in self.rows:
            i = self.table.rowCount()
            self.table.insertRow(i)
            vals = (r.ts.replace("T", " "), r.action, tr("success") if r.success else tr("error"), r.device)
            for c, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if c == 2:
                    it.setForeground(QColor("#4cd964" if r.success else "#ff6b6b"))
                self.table.setItem(i, c, it)
        if 0 <= sel < self.table.rowCount():
            self.table.selectRow(sel)

    def _show(self) -> None:
        i = self.table.currentRow()
        if i < 0 or i >= len(self.rows):
            self.detail.clear()
            return
        r = self.rows[i]
        parts = [f"<b>{tr('logs.col.time')}:</b> {r.ts}", f"<b>{tr('logs.col.action')}:</b> {r.action}",
                 f"<b>{tr('logs.command')}:</b> <code>{r.command}</code>", f"<b>{tr('logs.rc')}:</b> {r.returncode} ({r.duration:.2f}s)"]
        if r.stdout.strip():
            parts.append(f"<b>stdout:</b><pre>{_esc(r.stdout)}</pre>")
        if r.stderr.strip():
            parts.append(f"<b>stderr:</b><pre style='color:#ff6b6b'>{_esc(r.stderr)}</pre>")
        self.detail.setHtml("<br>".join(parts))

    def _export(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, tr("logs.export"), "car_app_manager_log.txt", "Text (*.txt)")
        if path:
            self.ctx.logger.export(path)
            self.status.set(tr("logs.exported", path=path), "ok")

    def _clear(self) -> None:
        if confirm(self, tr("logs.confirm_clear"), danger=True):
            self.ctx.db.clear_actions()
            self.reload()


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
