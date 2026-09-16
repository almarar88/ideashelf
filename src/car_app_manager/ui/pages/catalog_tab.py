"""Catalog tab (inside the Install page)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (QAbstractItemView, QCheckBox, QDialog, QDialogButtonBox, QFileDialog, QFormLayout,
                               QHBoxLayout, QHeaderView, QLineEdit, QPlainTextEdit, QProgressBar, QTableWidget,
                               QTableWidgetItem, QTextBrowser, QVBoxLayout, QWidget)

from ...catalog import Catalog, CatalogEntry
from ...config import downloads_dir
from ...i18n import tr, current_lang
from ...tools.platform_tools import download_file
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, confirm, info, muted

COLS = ("name", "category", "package", "tested", "installed", "source")


class EntryDialog(QDialog):
    def __init__(self, parent, entry: CatalogEntry):
        super().__init__(parent)
        self.setWindowTitle(tr("catalog.edit") if entry.name else tr("catalog.add"))
        self.setMinimumWidth(560)
        self.entry = entry
        lay = QVBoxLayout(self)
        f = QFormLayout()
        self.ed_name = QLineEdit(entry.name); f.addRow(tr("catalog.f.name"), self.ed_name)
        self.ed_pkg = QLineEdit(entry.package); f.addRow(tr("catalog.f.package"), self.ed_pkg)
        self.ed_cat = QLineEdit(entry.category); f.addRow(tr("catalog.f.category"), self.ed_cat)
        self.ed_url = QLineEdit(entry.source_url); f.addRow(tr("catalog.f.url"), self.ed_url)
        self.ed_ar = QPlainTextEdit(entry.description_ar); self.ed_ar.setMaximumHeight(70); f.addRow(tr("catalog.f.desc_ar"), self.ed_ar)
        self.ed_en = QPlainTextEdit(entry.description_en); self.ed_en.setMaximumHeight(70); f.addRow(tr("catalog.f.desc_en"), self.ed_en)
        self.ed_notes = QLineEdit(entry.notes); f.addRow(tr("catalog.f.notes"), self.ed_notes)
        self.ed_sha = QLineEdit(entry.sha256); f.addRow(tr("catalog.f.sha"), self.ed_sha)
        self.chk_tested = QCheckBox(tr("catalog.f.tested")); self.chk_tested.setChecked(entry.tested_on_t2); f.addRow("", self.chk_tested)
        lay.addLayout(f)
        bb = QDialogButtonBox()
        bb.addButton(tr("ok"), QDialogButtonBox.AcceptRole).setObjectName("primary")
        bb.addButton(tr("cancel"), QDialogButtonBox.RejectRole)
        bb.accepted.connect(self.accept); bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def result_entry(self) -> CatalogEntry:
        e = self.entry
        e.name = self.ed_name.text().strip() or e.name
        e.package = self.ed_pkg.text().strip()
        e.category = self.ed_cat.text().strip()
        e.source_url = self.ed_url.text().strip()
        e.description_ar = self.ed_ar.toPlainText().strip()
        e.description_en = self.ed_en.toPlainText().strip()
        e.notes = self.ed_notes.text().strip()
        e.sha256 = self.ed_sha.text().strip().lower()
        e.tested_on_t2 = self.chk_tested.isChecked()
        return e


class CatalogTab(QWidget):
    def __init__(self, ctx, add_to_install, parent=None):
        super().__init__(parent)
        self.ctx = ctx
        self.add_to_install = add_to_install
        self.catalog = Catalog()
        self.installed: set[str] = set()
        lay = QVBoxLayout(self)
        self.help = muted("")
        lay.addWidget(self.help)
        top = QHBoxLayout()
        self.search = QLineEdit(); self.search.textChanged.connect(lambda _t: self._apply_filter())
        top.addWidget(self.search, 1)
        self.btn_add = button("", slot=self._add); self.btn_edit = button("", slot=self._edit); self.btn_delete = button("", "danger", self._delete)
        self.btn_tested = button("", slot=self._toggle_tested)
        for b in (self.btn_add, self.btn_edit, self.btn_delete, self.btn_tested):
            top.addWidget(b)
        lay.addLayout(top)
        self.table = QTableWidget(0, len(COLS))
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows); self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers); self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        for c in (3, 4):
            self.table.horizontalHeader().setSectionResizeMode(c, QHeaderView.ResizeToContents)
        self.table.itemSelectionChanged.connect(self._show)
        self.table.itemDoubleClicked.connect(lambda _i: self._edit())
        lay.addWidget(self.table, 1)
        self.desc = QTextBrowser(); self.desc.setOpenExternalLinks(True); self.desc.setMaximumHeight(110)
        lay.addWidget(self.desc)
        bottom = QHBoxLayout()
        self.btn_open = button("", slot=self._open_source)
        self.btn_download = button("", "primary", self._download)
        self.btn_import = button("", slot=self._import); self.btn_export = button("", slot=self._export); self.btn_file = button("", slot=self._open_file)
        for b in (self.btn_open, self.btn_download):
            bottom.addWidget(b)
        bottom.addStretch(1)
        for b in (self.btn_import, self.btn_export, self.btn_file):
            bottom.addWidget(b)
        lay.addLayout(bottom)
        self.progress = QProgressBar(); self.progress.setVisible(False)
        lay.addWidget(self.progress)
        self.status = StatusLine()
        lay.addWidget(self.status)
        ctx.apps_loaded.connect(self._apps_loaded)
        self.retranslate()

    def retranslate(self) -> None:
        self.help.setText(tr("catalog.help"))
        self.search.setPlaceholderText(tr("search"))
        self.table.setHorizontalHeaderLabels([tr(f"catalog.col.{c}") for c in COLS])
        self.btn_add.setText(tr("catalog.add")); self.btn_edit.setText(tr("catalog.edit")); self.btn_delete.setText(tr("catalog.delete"))
        self.btn_tested.setText(tr("catalog.toggle_tested")); self.btn_open.setText(tr("catalog.open")); self.btn_download.setText(tr("catalog.download"))
        self.btn_import.setText(tr("catalog.import")); self.btn_export.setText(tr("catalog.export")); self.btn_file.setText(tr("catalog.open_file"))
        self.refill()

    def _apps_loaded(self, packages: list[str]) -> None:
        self.installed = set(packages)
        self.refill()

    def refill(self) -> None:
        sel = self._selected_id()
        self.table.setRowCount(0)
        for e in self.catalog.entries:
            r = self.table.rowCount(); self.table.insertRow(r)
            host = urlparse(e.source_url).netloc
            vals = (e.name, e.category, e.package, "✔" if e.tested_on_t2 else "", "✔" if e.package and e.package in self.installed else "", host)
            for c, v in enumerate(vals):
                it = QTableWidgetItem(v); it.setData(Qt.UserRole, e.id)
                if c in (3, 4):
                    it.setTextAlignment(Qt.AlignCenter)
                self.table.setItem(r, c, it)
            if sel == e.id:
                self.table.selectRow(r)
        self._apply_filter()
        self._show()

    def _apply_filter(self) -> None:
        q = self.search.text().strip().lower()
        for r in range(self.table.rowCount()):
            text = " ".join(self.table.item(r, c).text() for c in (0, 1, 2)).lower()
            self.table.setRowHidden(r, bool(q) and q not in text)

    def _selected_id(self) -> str:
        rows = self.table.selectionModel().selectedRows() if self.table.selectionModel() else []
        return self.table.item(rows[0].row(), 0).data(Qt.UserRole) if rows else ""

    def _selected(self) -> CatalogEntry | None:
        return self.catalog.get(self._selected_id())

    def _show(self) -> None:
        e = self._selected()
        has = e is not None
        for b in (self.btn_edit, self.btn_delete, self.btn_tested, self.btn_open, self.btn_download):
            b.setEnabled(has)
        if not e:
            self.desc.clear(); return
        html = f"<b>{e.name}</b> — {e.package}<br>{e.description(current_lang())}<br>"
        html += f"<a href='{e.source_url}'>{e.source_url}</a>"
        if e.notes:
            html += f"<br><i>{e.notes}</i>"
        if e.sha256:
            html += f"<br>SHA-256: <code>{e.sha256}</code>"
        self.desc.setHtml(html)

    # ---- actions -------------------------------------------------------------------------
    def _add(self) -> None:
        d = EntryDialog(self, CatalogEntry(id="", name=""))
        if d.exec() == QDialog.Accepted:
            e = d.result_entry()
            if not e.name:
                return
            e.id = self.catalog.new_id(e.package or e.name)
            self.catalog.upsert(e); self.refill()

    def _edit(self) -> None:
        e = self._selected()
        if not e:
            return
        d = EntryDialog(self, CatalogEntry(**{k: getattr(e, k) for k in CatalogEntry.__dataclass_fields__}))
        if d.exec() == QDialog.Accepted:
            self.catalog.upsert(d.result_entry()); self.refill()

    def _delete(self) -> None:
        e = self._selected()
        if e and confirm(self, tr("catalog.confirm_delete", name=e.name), danger=True):
            self.catalog.remove(e.id); self.refill()

    def _toggle_tested(self) -> None:
        e = self._selected()
        if e:
            self.catalog.set_tested(e.id, not e.tested_on_t2); self.refill()

    def _open_source(self) -> None:
        e = self._selected()
        if e and e.source_url:
            QDesktopServices.openUrl(QUrl(e.source_url))

    def _download(self) -> None:
        e = self._selected()
        if not e or not e.source_url:
            return
        if not e.direct_download:
            info(self, tr("catalog.not_direct"))
            QDesktopServices.openUrl(QUrl(e.source_url))
            return
        name = os.path.basename(urlparse(e.source_url).path) or f"{e.id}.apk"
        dest = downloads_dir() / name
        self.btn_download.setEnabled(False)
        self.progress.setVisible(True); self.progress.setRange(0, 100)

        def prog(p):
            done, total = p
            pct = int(done * 100 / total) if total else 0
            self.progress.setValue(pct); self.status.set(tr("catalog.downloading", pct=pct, name=name))

        def finished(path):
            self.btn_download.setEnabled(True); self.progress.setVisible(False)
            self.status.set(tr("catalog.downloaded", path=str(path)), "ok")
            self.ctx.logger.note("catalog download", f"{e.source_url} -> {path}")
            self.add_to_install([str(path)])

        def fail(msg):
            self.btn_download.setEnabled(True); self.progress.setVisible(False)
            self.status.set(tr("catalog.download_failed", msg=msg), "error")

        run_in_background(lambda progress: download_file(e.source_url, dest, lambda d, t: progress((d, t))),
                          on_done=finished, on_error=fail, on_progress=prog)

    def _import(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, tr("catalog.import"), "", "JSON (*.json)")
        if path:
            try:
                n = self.catalog.import_file(Path(path))
                self.status.set(tr("catalog.imported", n=n), "ok"); self.refill()
            except Exception as ex:
                self.status.set(str(ex), "error")

    def _export(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, tr("catalog.export"), "catalog.json", "JSON (*.json)")
        if path:
            self.catalog.export_file(Path(path)); self.status.set(tr("logs.exported", path=path), "ok")

    def _open_file(self) -> None:
        p = str(self.catalog.path)
        if sys.platform == "win32":
            os.startfile(p)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", p])
