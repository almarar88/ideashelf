"""Backup / restore page + 'Restore to original' (uninstall only what we installed)."""
from __future__ import annotations

import os
import subprocess
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QAbstractItemView, QDialog, QDialogButtonBox, QFileDialog, QHBoxLayout, QHeaderView,
                               QLabel, QLineEdit, QListWidget, QListWidgetItem, QProgressBar, QSplitter, QTableWidget,
                               QTableWidgetItem, QVBoxLayout, QWidget)

from ... import backup as bk
from ...adb.packages import AppInfo
from ...i18n import tr, human_size, current_lang
from ...workers import run_in_background
from ..widgets.common import StatusLine, TypeToConfirmDialog, button, card, confirm, info as info_box, muted, title_label
from .base import BasePage


class ChooseAppsDialog(QDialog):
    def __init__(self, parent, apps: list[AppInfo]):
        super().__init__(parent)
        self.setWindowTitle(tr("backup.choose_apps"))
        self.setMinimumSize(520, 460)
        lay = QVBoxLayout(self)
        self.list = QListWidget()
        for a in apps:
            it = QListWidgetItem(f"{a.display_name}  —  {a.package}  ({a.version_name})")
            it.setFlags(it.flags() | Qt.ItemIsUserCheckable)
            it.setCheckState(Qt.Checked)
            it.setData(Qt.UserRole, a.package)
            self.list.addItem(it)
        lay.addWidget(self.list, 1)
        row = QHBoxLayout()
        row.addWidget(button(tr("backup.select_all"), slot=lambda: self._set_all(Qt.Checked)))
        row.addWidget(button(tr("backup.select_none"), slot=lambda: self._set_all(Qt.Unchecked)))
        row.addStretch(1)
        lay.addLayout(row)
        bb = QDialogButtonBox()
        bb.addButton(tr("backup.create"), QDialogButtonBox.AcceptRole).setObjectName("primary")
        bb.addButton(tr("cancel"), QDialogButtonBox.RejectRole)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def _set_all(self, st) -> None:
        for i in range(self.list.count()):
            self.list.item(i).setCheckState(st)

    def selected(self) -> set[str]:
        return {self.list.item(i).data(Qt.UserRole) for i in range(self.list.count()) if self.list.item(i).checkState() == Qt.Checked}


class BackupPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        row = QHBoxLayout()
        self.lbl_folder = QLabel()
        self.folder = QLineEdit(self.ctx.settings.backups_dir)
        self.folder.setReadOnly(True)
        self.btn_browse = button("", slot=self._browse)
        self.btn_open = button("", slot=self._open_folder)
        self.btn_create = button("", "primary", self._create)
        row.addWidget(self.lbl_folder)
        row.addWidget(self.folder, 1)
        row.addWidget(self.btn_browse)
        row.addWidget(self.btn_open)
        row.addWidget(self.btn_create)
        self.root.addLayout(row)

        split = QSplitter(Qt.Horizontal)
        left = QWidget(); ll = QVBoxLayout(left); ll.setContentsMargins(0, 0, 0, 0)
        self.lbl_list = muted("")
        ll.addWidget(self.lbl_list)
        self.backups_table = QTableWidget(0, 3)
        self.backups_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.backups_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.backups_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.backups_table.verticalHeader().setVisible(False)
        self.backups_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.backups_table.itemSelectionChanged.connect(self._show_contents)
        ll.addWidget(self.backups_table, 1)
        split.addWidget(left)

        right = QWidget(); rl = QVBoxLayout(right); rl.setContentsMargins(0, 0, 0, 0)
        self.lbl_contents = muted("")
        rl.addWidget(self.lbl_contents)
        self.contents = QListWidget()
        rl.addWidget(self.contents, 1)
        r2 = QHBoxLayout()
        self.btn_all = button("", slot=lambda: self._check_all(Qt.Checked))
        self.btn_none = button("", slot=lambda: self._check_all(Qt.Unchecked))
        self.btn_restore = button("", "primary", self._restore)
        r2.addWidget(self.btn_all); r2.addWidget(self.btn_none); r2.addStretch(1); r2.addWidget(self.btn_restore)
        rl.addLayout(r2)
        split.addWidget(right)
        split.setSizes([420, 420])
        self.root.addWidget(split, 1)

        self.progress = QProgressBar(); self.progress.setVisible(False)
        self.root.addWidget(self.progress)
        self.status = StatusLine()
        self.root.addWidget(self.status)

        orig, ol = card()
        self.lbl_orig = muted("")
        self.btn_orig = button("", "danger", self._restore_original)
        ol.addWidget(self.lbl_orig)
        ol.addWidget(self.btn_orig, 0, Qt.AlignLeft)
        self.root.addWidget(orig)

        self.backups: list[bk.Backup] = []
        self._busy = False

    def retranslate(self) -> None:
        self.title.setText(tr("backup.title"))
        self.lbl_folder.setText(tr("backup.folder"))
        self.btn_browse.setText(tr("browse"))
        self.btn_open.setText(tr("backup.open_folder"))
        self.btn_create.setText(tr("backup.create"))
        self.lbl_list.setText(tr("backup.list"))
        self.backups_table.setHorizontalHeaderLabels([tr("backup.col.created"), tr("backup.col.device"), tr("backup.col.apps")])
        self.lbl_contents.setText(tr("backup.contents"))
        self.btn_all.setText(tr("backup.select_all"))
        self.btn_none.setText(tr("backup.select_none"))
        self.btn_restore.setText(tr("backup.restore"))
        self.lbl_orig.setText(tr("orig.help"))
        self.btn_orig.setText(tr("orig.button"))
        self.reload()

    def on_show(self) -> None:
        self.reload()

    # ---- backups list --------------------------------------------------------------------
    def reload(self) -> None:
        self.backups = bk.list_backups(self.folder.text())
        self.backups_table.setRowCount(0)
        for b in self.backups:
            r = self.backups_table.rowCount()
            self.backups_table.insertRow(r)
            for c, v in enumerate((b.created.replace("T", " "), b.device, str(len(b.entries)))):
                self.backups_table.setItem(r, c, QTableWidgetItem(v))
        if not self.backups:
            self.status.set(tr("backup.none"))
        self.contents.clear()

    def _show_contents(self) -> None:
        self.contents.clear()
        rows = self.backups_table.selectionModel().selectedRows()
        if not rows:
            return
        b = self.backups[rows[0].row()]
        for e in b.entries:
            it = QListWidgetItem(f"{e.label or e.package}  —  {e.package}  {e.version_name}  ({human_size(e.size_bytes)})")
            it.setFlags(it.flags() | Qt.ItemIsUserCheckable)
            it.setCheckState(Qt.Checked)
            it.setData(Qt.UserRole, e.package)
            self.contents.addItem(it)

    def _check_all(self, st) -> None:
        for i in range(self.contents.count()):
            self.contents.item(i).setCheckState(st)

    def _browse(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("backup.folder"), self.folder.text())
        if d:
            self.folder.setText(d)
            self.ctx.settings.backups_dir = d
            self.ctx.settings.save()
            self.reload()

    def _open_folder(self) -> None:
        p = self.folder.text()
        if not os.path.isdir(p):
            return
        if sys.platform == "win32":
            os.startfile(p)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", p])

    # ---- create ---------------------------------------------------------------------------
    def _create(self) -> None:
        if self._busy:
            return
        if not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        self._busy = True
        self.status.set(tr("working"))
        run_in_background(self.ctx.pm.list_user_apps, on_done=self._choose_apps, on_error=self._fail)

    def _choose_apps(self, apps: list[AppInfo]) -> None:
        self._busy = False
        apps = [a for a in apps if not a.protected]
        dlg = ChooseAppsDialog(self, apps)
        if dlg.exec() != QDialog.Accepted:
            self.status.set("")
            return
        chosen = [a for a in apps if a.package in dlg.selected()]
        if not chosen:
            return
        self._busy = True
        self.progress.setVisible(True)
        self.progress.setRange(0, len(chosen))
        dev = self.ctx.current_device
        model = self.ctx.device_info.model if self.ctx.device_info else (dev.model if dev else "")

        def prog(p):
            cur, total, pkg = p
            self.progress.setValue(cur)
            self.status.set(tr("backup.progress", cur=cur + 1, total=total, pkg=pkg))

        def done(b: bk.Backup):
            self._busy = False
            self.progress.setVisible(False)
            self.status.set(tr("backup.done", name=b.name, n=len(b.entries)), "ok")
            self.ctx.logger.note("backup created", str(b.folder), device=dev.serial if dev else "")
            self.reload()

        run_in_background(bk.create_backup, self.ctx.pm, self.folder.text(), chosen, dev.serial if dev else "", model,
                          on_done=done, on_error=self._fail, on_progress=prog)

    def _fail(self, msg: str) -> None:
        self._busy = False
        self.progress.setVisible(False)
        self.status.set(msg, "error")

    # ---- restore ---------------------------------------------------------------------------
    def _restore(self) -> None:
        if self._busy:
            return
        rows = self.backups_table.selectionModel().selectedRows()
        if not rows:
            return
        if not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        b = self.backups[rows[0].row()]
        pkgs = [self.contents.item(i).data(Qt.UserRole) for i in range(self.contents.count())
                if self.contents.item(i).checkState() == Qt.Checked]
        if not pkgs:
            return
        if not confirm(self, tr("backup.confirm_restore", n=len(pkgs))):
            return
        self._busy = True
        self.progress.setVisible(True)
        self.progress.setRange(0, len(pkgs))
        installer = self.ctx.installer()
        device = self.ctx.runner.serial or ""

        def prog(p):
            cur, total, pkg = p
            self.progress.setValue(cur)
            self.status.set(tr("backup.restore_progress", cur=cur + 1, total=total, pkg=pkg))

        def work(progress):
            results = bk.restore(installer, b, pkgs, progress)
            for e, r in zip([e for e in b.entries if e.package in set(pkgs)], results):
                if r.success:
                    self.ctx.db.track_install(e.package, label=e.label, version_name=e.version_name,
                                              version_code=e.version_code, source_path=str(b.folder), device=device,
                                              preexisting=True)  # restored apps were the user's own
            return results

        def done(results):
            self._busy = False
            self.progress.setVisible(False)
            ok = sum(1 for r in results if r.success)
            fails = [f"{r.package}: {r.message(current_lang())}" for r in results if not r.success]
            self.status.set(tr("backup.restore_done", ok=ok, fail=len(results) - ok) + ("\n" + "\n".join(fails) if fails else ""),
                            "ok" if not fails else "warn")

        run_in_background(work, on_done=done, on_error=self._fail, on_progress=prog)

    # ---- restore to original ------------------------------------------------------------------
    def _restore_original(self) -> None:
        if self._busy:
            return
        if not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        tracked = self.ctx.db.tracked_apps(only_removable=True)
        if not tracked:
            info_box(self, tr("orig.none"))
            return
        self._busy = True
        self.status.set(tr("working"))

        def work():
            # only those still installed and still user (non-protected) apps
            sys_pkgs = self.ctx.pm.list_system_packages(refresh=True)
            user = set(self.ctx.pm.list_user_packages())
            from ...adb.protection import is_protected
            return [t for t in tracked if t.package in user and not is_protected(t.package, sys_pkgs)]

        run_in_background(work, on_done=self._orig_confirm, on_error=self._fail)

    def _orig_confirm(self, targets) -> None:
        self._busy = False
        if not targets:
            info_box(self, tr("orig.none"))
            return
        listing = "\n".join(f"• {t.label or t.package}  ({t.package})" for t in targets)
        if not confirm(self, tr("orig.step1", n=len(targets), list=listing), danger=True):
            return
        word = tr("orig.word")
        if not TypeToConfirmDialog.ask(self, tr("orig.step2", word=word), word):
            return
        device = self.ctx.runner.serial or ""
        self.ctx.logger.note("restore to original confirmed", ", ".join(t.package for t in targets), device=device)
        self._busy = True
        self.progress.setVisible(True)
        self.progress.setRange(0, len(targets))

        def work(progress):
            out = []
            for i, t in enumerate(targets):
                progress((i, len(targets), t.package))
                r = self.ctx.pm.uninstall(t.package)
                if r.ok:
                    self.ctx.db.untrack(t.package)
                out.append((t, r))
            return out

        def prog(p):
            cur, total, pkg = p
            self.progress.setValue(cur)
            self.status.set(f"{tr('apps.uninstall')} {cur + 1}/{total}: {pkg}")

        def done(results):
            self._busy = False
            self.progress.setVisible(False)
            ok = sum(1 for _, r in results if r.ok)
            fails = [f"{t.package}: {r.output}" for t, r in results if not r.ok]
            self.status.set(tr("orig.done", ok=ok, fail=len(results) - ok) + ("\n" + "\n".join(fails) if fails else ""),
                            "ok" if not fails else "warn")

        run_in_background(work, on_done=done, on_error=self._fail, on_progress=prog)
