"""Apps page: user-installed apps with launch / stop / clear / uninstall / export."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QAbstractItemView, QFileDialog, QHBoxLayout, QHeaderView, QLineEdit, QProgressBar,
                               QTableWidget, QTableWidgetItem)

from ...adb.packages import AppInfo
from ...adb.protection import ProtectedPackageError
from ...i18n import tr, human_size, current_lang
from ...adb.errors import explain
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, confirm, title_label, error
from .base import BasePage

COLS = ("name", "package", "version", "size", "flags")


class AppsPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        bar = QHBoxLayout()
        self.search = QLineEdit()
        self.search.textChanged.connect(self._apply_filter)
        self.btn_refresh = button("", slot=self.refresh)
        bar.addWidget(self.search, 1)
        bar.addWidget(self.btn_refresh)
        self.root.addLayout(bar)

        self.table = QTableWidget(0, len(COLS))
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.setSortingEnabled(True)
        self.table.itemSelectionChanged.connect(self._update_buttons)
        self.root.addWidget(self.table, 1)

        actions = QHBoxLayout()
        self.btn_launch = button("", "primary", lambda: self._act("launch"))
        self.btn_stop = button("", slot=lambda: self._act("force_stop"))
        self.btn_clear = button("", slot=lambda: self._act("clear_data"))
        self.btn_uninstall = button("", "danger", lambda: self._act("uninstall"))
        self.btn_export = button("", slot=self._export)
        for b in (self.btn_launch, self.btn_stop, self.btn_clear, self.btn_uninstall, self.btn_export):
            actions.addWidget(b)
        actions.addStretch(1)
        self.count_lbl = StatusLine()
        actions.addWidget(self.count_lbl)
        self.root.addLayout(actions)
        self.progress = QProgressBar()
        self.progress.setVisible(False)
        self.root.addWidget(self.progress)
        self.status = StatusLine()
        self.root.addWidget(self.status)

        self.apps: list[AppInfo] = []
        self._loading = False
        self.ctx.device_changed.connect(lambda _d: self._clear())
        self._update_buttons()

    def retranslate(self) -> None:
        self.title.setText(tr("apps.title"))
        self.search.setPlaceholderText(tr("search"))
        self.btn_refresh.setText(tr("refresh"))
        self.table.setHorizontalHeaderLabels([tr(f"apps.col.{c}") for c in COLS])
        self.btn_launch.setText(tr("apps.launch"))
        self.btn_stop.setText(tr("apps.force_stop"))
        self.btn_clear.setText(tr("apps.clear"))
        self.btn_uninstall.setText(tr("apps.uninstall"))
        self.btn_export.setText(tr("apps.export"))
        self._fill()

    def on_show(self) -> None:
        if not self.apps and self.ctx.device_ready:
            self.refresh()

    # ---- data ----------------------------------------------------------------------
    def _clear(self) -> None:
        self.apps = []
        self._fill()

    def refresh(self) -> None:
        if self._loading:
            return
        if not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        self._loading = True
        self.progress.setVisible(True)
        self.progress.setRange(0, 0)
        self.btn_refresh.setEnabled(False)
        run_in_background(self.ctx.pm.list_user_apps, on_done=self._loaded, on_error=self._load_error, on_progress=self._progress)

    def _progress(self, p) -> None:
        cur, total, pkg = p
        self.progress.setRange(0, max(total, 1))
        self.progress.setValue(cur)
        self.status.set(tr("apps.loading", cur=cur + 1, total=total) + f"  {pkg}")

    def _load_error(self, msg: str) -> None:
        self._loading = False
        self.progress.setVisible(False)
        self.btn_refresh.setEnabled(True)
        self.status.set(msg, "error")

    def _loaded(self, apps: list[AppInfo]) -> None:
        self._loading = False
        self.progress.setVisible(False)
        self.btn_refresh.setEnabled(True)
        ours = self.ctx.db.tracked_packages()
        tracked = {t.package: t for t in self.ctx.db.tracked_apps()}
        try:
            from ...catalog import Catalog
            names = {e.package: e.name for e in Catalog().entries if e.package}
        except Exception:
            names = {}
        for a in apps:
            a.installed_by_us = a.package in ours
            if not a.label and a.package in tracked and tracked[a.package].label:
                a.label = tracked[a.package].label
            if not a.label and a.package in names:
                a.label = names[a.package]
        self.apps = apps
        self.status.set("")
        self._fill()
        self.ctx.apps_loaded.emit([a.package for a in apps])

    def _fill(self) -> None:
        self.table.setSortingEnabled(False)
        self.table.setRowCount(0)
        for a in self.apps:
            r = self.table.rowCount()
            self.table.insertRow(r)
            flags = []
            if a.protected:
                flags.append(tr("apps.flag.protected"))
            if a.installed_by_us:
                flags.append(tr("apps.flag.ours"))
            vals = [a.display_name, a.package, f"{a.version_name} ({a.version_code})" if a.version_name else str(a.version_code or ""),
                    human_size(a.size_bytes) if a.size_bytes else "—", ", ".join(flags)]
            for c, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if c == 3:
                    it.setData(Qt.UserRole, a.size_bytes)
                it.setData(Qt.UserRole + 1, a.package)
                if a.protected:
                    it.setForeground(QColor("#ffb84d"))
                self.table.setItem(r, c, it)
        self.table.setSortingEnabled(True)
        self.count_lbl.set(tr("apps.count", n=len(self.apps)))
        self._apply_filter()
        self._update_buttons()

    def _apply_filter(self) -> None:
        q = self.search.text().strip().lower()
        for r in range(self.table.rowCount()):
            text = " ".join((self.table.item(r, c).text() if self.table.item(r, c) else "") for c in (0, 1)).lower()
            self.table.setRowHidden(r, bool(q) and q not in text)

    def _selected_all(self) -> list[AppInfo]:
        rows = self.table.selectionModel().selectedRows() if self.table.selectionModel() else []
        pkgs = [self.table.item(r.row(), 0).data(Qt.UserRole + 1) for r in rows]
        return [a for a in self.apps if a.package in pkgs]

    def _selected(self) -> AppInfo | None:
        sel = self._selected_all()
        return sel[0] if sel else None

    def _update_buttons(self) -> None:
        sel = self._selected_all()
        a = sel[0] if sel else None
        ok = a is not None and self.ctx.device_ready
        modifiable = ok and not any(x.protected for x in sel)
        self.btn_launch.setEnabled(ok and len(sel) == 1)
        self.btn_export.setEnabled(ok)
        for b in (self.btn_stop, self.btn_clear):
            b.setEnabled(modifiable and len(sel) == 1)
        self.btn_uninstall.setEnabled(modifiable)
        if len(sel) > 1:
            self.count_lbl.set(tr("apps.selected", n=len(sel)))
        else:
            self.count_lbl.set(tr("apps.count", n=len(self.apps)))
        if a is not None and any(x.protected for x in sel):
            self.status.set(tr("apps.protected_msg"), "warn")

    # ---- actions ----------------------------------------------------------------------
    def _act(self, action: str) -> None:
        sel = self._selected_all()
        if action == "uninstall" and len(sel) > 1:
            self._uninstall_many(sel)
            return
        a = self._selected()
        if not a:
            return
        if a.protected and action != "launch":
            error(self, tr("apps.protected_msg"))
            return
        need_confirm = {"clear_data": "apps.confirm.clear", "uninstall": "apps.confirm.uninstall", "force_stop": "apps.confirm.force_stop"}
        if action in need_confirm and self.ctx.settings.confirm_destructive:
            if not confirm(self, tr(need_confirm[action], app=a.display_name), danger=action != "force_stop"):
                return
            self.ctx.logger.note(f"user confirmed {action}", a.package, device=self.ctx.runner.serial or "")
        fn = getattr(self.ctx.pm, action)
        label = {"launch": tr("apps.launch"), "force_stop": tr("apps.force_stop"), "clear_data": tr("apps.clear"),
                 "uninstall": tr("apps.uninstall")}[action]
        self.status.set(tr("working"))
        self.setEnabled(False)

        def done(r):
            self.setEnabled(True)
            if r.ok:
                self.status.set(tr("apps.action_ok", action=f"{label}: {a.display_name}"), "ok")
                if action == "uninstall":
                    self.ctx.db.untrack(a.package)
                    self.apps = [x for x in self.apps if x.package != a.package]
                    self._fill()
            else:
                self.status.set(tr("apps.action_fail", action=label, msg=explain(r.output, current_lang())), "error")

        def fail(msg):
            self.setEnabled(True)
            self.status.set(tr("apps.action_fail", action=label, msg=msg), "error")

        run_in_background(self._safe_call, fn, a.package, on_done=done, on_error=fail)

    def _uninstall_many(self, apps: list[AppInfo]) -> None:
        apps = [a for a in apps if not a.protected]
        if not apps:
            return
        listing = "\n".join(f"• {a.display_name} ({a.package})" for a in apps)
        if not confirm(self, tr("apps.confirm.uninstall_many", n=len(apps), list=listing), danger=True):
            return
        self.ctx.logger.note("user confirmed batch uninstall", ", ".join(a.package for a in apps), device=self.ctx.runner.serial or "")
        self.setEnabled(False)
        self.status.set(tr("working"))

        def work(progress):
            out = []
            for a in apps:
                r = self.ctx.pm.uninstall(a.package)
                if r.ok:
                    self.ctx.db.untrack(a.package)
                out.append((a, r))
                progress(a.package)
            return out

        def done(results):
            self.setEnabled(True)
            ok = sum(1 for _, r in results if r.ok)
            removed = {a.package for a, r in results if r.ok}
            self.apps = [x for x in self.apps if x.package not in removed]
            self._fill()
            fails = [f"{a.package}: {explain(r.output, current_lang())}" for a, r in results if not r.ok]
            self.status.set(tr("apps.batch_done", ok=ok, fail=len(results) - ok) + ("\n" + "\n".join(fails) if fails else ""), "ok" if not fails else "warn")

        run_in_background(work, on_done=done, on_error=lambda m: (self.setEnabled(True), self.status.set(m, "error")),
                          on_progress=lambda pkg: self.status.set(f"{tr('apps.uninstall')}: {pkg}"))

    @staticmethod
    def _safe_call(fn, package):
        try:
            return fn(package)
        except ProtectedPackageError as e:
            raise RuntimeError(tr("apps.protected_msg")) from e

    def _export(self) -> None:
        sel = self._selected_all()
        if not sel:
            return
        d = QFileDialog.getExistingDirectory(self, tr("apps.export_dir"))
        if not d:
            return
        self.status.set(tr("working"))

        def work():
            files = []
            for a in sel:
                files += self.ctx.pm.export_apk(a.package, d, a.apk_paths)
            return files

        run_in_background(work, on_done=lambda files: self.status.set(tr("apps.exported", n=len(files), dir=d), "ok" if files else "error"),
                          on_error=lambda m: self.status.set(m, "error"))
