"""Install page: drag & drop APK / split bundles, pre-install checks, batch install."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QDragEnterEvent, QDropEvent
from PySide6.QtWidgets import (QAbstractItemView, QCheckBox, QFileDialog, QFrame, QHBoxLayout, QHeaderView, QLabel,
                               QProgressBar, QSplitter, QTableWidget, QTableWidgetItem, QTabWidget, QTextBrowser, QVBoxLayout, QWidget)
from PySide6.QtGui import QDesktopServices
from PySide6.QtCore import QUrl

from ...adb.install import InstallResult
from ...apk.bundle import APK_EXTENSIONS, BUNDLE_EXTENSIONS, extract_bundle, is_base_apk
from ...apk.inspector import ApkInfo, Check, check_compatibility, inspect_apk, sha256_file, worst_level
from ...i18n import tr, human_size, current_lang
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, confirm, title_label
from .base import BasePage
from .catalog_tab import CatalogTab
from ...security.virustotal import VTResult, lookup as vt_lookup
from ...security.secrets import get_secret

COLS = ("file", "package", "version", "sdk", "abi", "perms", "vt", "status")
LEVEL_COLORS = {"ok": "#4cd964", "warn": "#ffb84d", "error": "#ff6b6b"}


@dataclass
class Item:
    path: str
    info: Optional[ApkInfo] = None
    checks: list[Check] = field(default_factory=list)
    installed_version: Optional[tuple[str, int]] = None
    state: str = "checking"  # checking | ok | warn | error | installing | installed | failed
    result: Optional[InstallResult] = None
    is_bundle: bool = False
    vt: Optional[VTResult] = None
    vt_checking: bool = False


def inspect_path(path: str, device_sdk: int, device_abis: list[str], pm) -> tuple[ApkInfo, list[Check], Optional[tuple[str, int]]]:
    p = Path(path)
    if p.suffix.lower() in BUNDLE_EXTENSIONS:
        bc = extract_bundle(p)
        try:
            base = next((a for a in bc.apks if is_base_apk(a.name)), bc.apks[0] if bc.apks else None)
            if base is None:
                info = ApkInfo(path=path, size=p.stat().st_size, sha256=sha256_file(p), parse_error="no apk in bundle")
            else:
                info = inspect_apk(base)
                info.path = path
                info.size = p.stat().st_size
                info.sha256 = sha256_file(p)
                # aggregate native abis over all splits
                abis = set(info.native_abis)
                from ...apk.bundle import split_abi
                for a in bc.apks:
                    ab = split_abi(a.name)
                    if ab:
                        abis.add(ab)
                info.native_abis = sorted(abis)
                if bc.package and not info.package:
                    info.package = bc.package
        finally:
            bc.cleanup()
    else:
        info = inspect_apk(p)
    installed = None
    if info.package and pm is not None:
        try:
            installed = pm.get_installed_version(info.package)
        except Exception:
            installed = None
    checks = check_compatibility(info, device_sdk, device_abis, installed)
    return info, checks, installed


class DropZone(QFrame):
    def __init__(self, on_files, parent=None):
        super().__init__(parent)
        self.setObjectName("dropzone")
        self.setAcceptDrops(True)
        self.on_files = on_files
        self.setMinimumHeight(70)
        lay = QVBoxLayout(self)
        self.label = QLabel("")
        self.label.setAlignment(Qt.AlignCenter)
        self.label.setObjectName("muted")
        lay.addWidget(self.label)

    def dragEnterEvent(self, e: QDragEnterEvent) -> None:
        if e.mimeData().hasUrls():
            self.setProperty("active", "true")
            self.style().unpolish(self); self.style().polish(self)
            e.acceptProposedAction()

    def dragLeaveEvent(self, e) -> None:
        self.setProperty("active", "false")
        self.style().unpolish(self); self.style().polish(self)

    def dropEvent(self, e: QDropEvent) -> None:
        self.setProperty("active", "false")
        self.style().unpolish(self); self.style().polish(self)
        paths = [u.toLocalFile() for u in e.mimeData().urls() if u.isLocalFile()]
        self.on_files(paths)
        e.acceptProposedAction()


class InstallPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        self.tabs = QTabWidget()
        self.root.addWidget(self.tabs, 1)
        files_tab = QWidget()
        self.files_lay = QVBoxLayout(files_tab)
        self.files_lay.setContentsMargins(0, 8, 0, 0)
        self.catalog_tab = CatalogTab(self.ctx, self.add_paths)
        self.tabs.addTab(files_tab, "")
        self.tabs.addTab(self.catalog_tab, "")
        self._build_files()

    def _build_files(self) -> None:
        self.root = self.files_lay  # the rest of the widgets go into the files tab
        self.drop = DropZone(self.add_paths)
        self.root.addWidget(self.drop)

        bar = QHBoxLayout()
        self.btn_add = button("", slot=self._add_files)
        self.btn_add_folder = button("", slot=self._add_folder)
        self.btn_remove = button("", slot=self._remove_selected)
        self.btn_clear = button("", slot=self._clear)
        self.btn_vt = button("", slot=self._vt_check_selected)
        for b in (self.btn_add, self.btn_add_folder, self.btn_remove, self.btn_clear, self.btn_vt):
            bar.addWidget(b)
        bar.addStretch(1)
        self.root.addLayout(bar)
        opts = QHBoxLayout()
        self.chk_reinstall = QCheckBox(); self.chk_reinstall.setChecked(True)
        self.chk_downgrade = QCheckBox()
        self.chk_grant = QCheckBox()
        for c in (self.chk_reinstall, self.chk_downgrade, self.chk_grant):
            opts.addWidget(c)
        opts.addStretch(1)
        self.root.addLayout(opts)

        split = QSplitter(Qt.Vertical)
        self.table = QTableWidget(0, len(COLS))
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        for c in (3, 4, 5, 6, 7):
            self.table.horizontalHeader().setSectionResizeMode(c, QHeaderView.ResizeToContents)
        self.table.itemSelectionChanged.connect(self._show_details)
        split.addWidget(self.table)
        self.details = QTextBrowser()
        self.details.setOpenExternalLinks(True)
        split.addWidget(self.details)
        split.setSizes([320, 220])
        self.root.addWidget(split, 1)

        bottom = QHBoxLayout()
        self.btn_install_sel = button("", slot=lambda: self._install(selected_only=True))
        self.btn_install = button("", "primary", lambda: self._install(selected_only=False))
        bottom.addWidget(self.btn_install_sel)
        bottom.addWidget(self.btn_install)
        self.progress = QProgressBar(); self.progress.setVisible(False)
        bottom.addWidget(self.progress, 1)
        self.root.addLayout(bottom)
        self.status = StatusLine()
        self.root.addWidget(self.status)

        self.items: list[Item] = []
        self._installing = False
        self.ctx.device_info_changed.connect(lambda _i: self._recheck_all())

    def retranslate(self) -> None:
        self.title.setText(tr("install.title"))
        self.tabs.setTabText(0, tr("install.tab.files")); self.tabs.setTabText(1, tr("install.tab.catalog"))
        self.btn_vt.setText(tr("install.vt_check"))
        self.catalog_tab.retranslate()
        self.drop.label.setText(tr("install.drop"))
        self.btn_add.setText(tr("install.add"))
        self.btn_add_folder.setText(tr("install.add_folder"))
        self.btn_remove.setText(tr("install.remove"))
        self.btn_clear.setText(tr("install.clear"))
        self.chk_reinstall.setText(tr("install.reinstall"))
        self.chk_downgrade.setText(tr("install.downgrade"))
        self.chk_grant.setText(tr("install.grant"))
        self.btn_install_sel.setText(tr("install.run_selected"))
        self.btn_install.setText(tr("install.run"))
        self.table.setHorizontalHeaderLabels([tr(f"install.col.{c}") for c in COLS])
        self._refill()
        self._show_details()

    # ---- list management ------------------------------------------------------------
    def _add_files(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(self, tr("install.add"), "", "APK (*.apk *.apks *.xapk *.apkm);;All (*)")
        self.add_paths(files)

    def _add_folder(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("install.add_folder"))
        if d:
            self.add_paths([d])

    def add_paths(self, paths: list[str]) -> None:
        new: list[str] = []
        for p in paths:
            if os.path.isdir(p):
                for root, _dirs, files in os.walk(p):
                    for f in sorted(files):
                        if f.lower().endswith(APK_EXTENSIONS):
                            new.append(os.path.join(root, f))
            elif p.lower().endswith(APK_EXTENSIONS) and os.path.isfile(p):
                new.append(p)
        existing = {i.path for i in self.items}
        for p in new:
            if p in existing:
                continue
            item = Item(path=p, is_bundle=p.lower().endswith(BUNDLE_EXTENSIONS))
            self.items.append(item)
            existing.add(p)
            self._check(item)
        self._refill()

    def _check(self, item: Item) -> None:
        item.state = "checking"
        info = self.ctx.device_info
        sdk = info.sdk if info else 0
        abis = info.abis if info else []
        pm = self.ctx.pm if self.ctx.device_ready else None

        it = item  # captured by the closures below (slots must take exactly one argument)

        def done(res):
            it.info, it.checks, it.installed_version = res
            it.state = worst_level(it.checks)
            self._refill()
            self._show_details()
            if self.ctx.settings.virustotal_enabled and it.info and it.info.sha256 and it.vt is None:
                self._vt_check(it)

        def fail(msg):
            it.info = ApkInfo(path=it.path, parse_error=msg)
            it.checks = [Check("error", "parse", msg, msg)]
            it.state = "error"
            self._refill()

        run_in_background(inspect_path, item.path, sdk, abis, pm, on_done=done, on_error=fail)

    def _recheck_all(self) -> None:
        for it in self.items:
            if it.state in ("checking", "ok", "warn", "error"):
                self._check(it)

    def _remove_selected(self) -> None:
        rows = sorted({i.row() for i in self.table.selectedIndexes()}, reverse=True)
        for r in rows:
            if r < len(self.items):
                self.items.pop(r)
        self._refill()

    def _clear(self) -> None:
        self.items = []
        self._refill()
        self.details.clear()

    def _refill(self) -> None:
        sel = {i.row() for i in self.table.selectedIndexes()}
        self.table.setRowCount(0)
        for it in self.items:
            r = self.table.rowCount()
            self.table.insertRow(r)
            info = it.info
            dp = len(info.dangerous_permissions) if info else 0
            vals = [
                os.path.basename(it.path),
                info.package if info else "",
                f"{info.version_name} ({info.version_code})" if info and info.version_name else "",
                str(info.min_sdk) if info and info.min_sdk else "",
                ", ".join(info.native_abis) if info and info.native_abis else ("—" if info else ""),
                str(dp) if info else "",
                self._vt_text(it),
                tr(f"install.status.{it.state}"),
            ]
            for c, v in enumerate(vals):
                cell = QTableWidgetItem(v)
                if c == 6 and it.vt is not None:
                    cell.setForeground(QColor(LEVEL_COLORS.get(it.vt.level, "#e6e6e6")))
                if c == 7:
                    color = {"ok": "ok", "installed": "ok", "warn": "warn", "error": "error", "failed": "error"}.get(it.state)
                    if color:
                        cell.setForeground(QColor(LEVEL_COLORS[color]))
                if c == 5 and dp:
                    cell.setForeground(QColor(LEVEL_COLORS["warn"]))
                self.table.setItem(r, c, cell)
        for r in sel:
            if r < self.table.rowCount():
                self.table.selectRow(r)
        self.btn_install.setEnabled(bool(self.items) and not self._installing)
        self.btn_install_sel.setEnabled(bool(self.items) and not self._installing)

    def _selected_items(self) -> list[Item]:
        rows = sorted({i.row() for i in self.table.selectedIndexes()})
        return [self.items[r] for r in rows if r < len(self.items)]

    def _show_details(self) -> None:
        sel = self._selected_items()
        if not sel:
            self.details.clear()
            return
        it = sel[0]
        info = it.info
        lang = current_lang()
        html: list[str] = []
        html.append(f"<b>{tr('install.col.file')}:</b> {it.path}<br>")
        if info:
            html.append(f"<b>{tr('install.sha256')}:</b> <code>{info.sha256}</code><br>")
            html.append(f"<b>{tr('install.size')}:</b> {human_size(info.size)}<br>")
            if info.label:
                html.append(f"<b>{tr('install.label')}:</b> {info.label}<br>")
            html.append(f"<b>{tr('install.col.package')}:</b> {info.package} &nbsp; <b>{tr('install.col.version')}:</b> {info.version_name} ({info.version_code})<br>")
            html.append(f"<b>minSdk:</b> {info.min_sdk or '?'} &nbsp; <b>{tr('install.target')}:</b> {info.target_sdk or '?'}<br>")
            if it.is_bundle:
                html.append(f"<i>{tr('install.bundle_note')}</i><br>")
            iv = it.installed_version
            html.append(f"<b>{tr('install.installed_version')}:</b> {(iv[0] + ' (' + str(iv[1]) + ')') if iv else tr('install.not_installed')}<br>")
            html.append(f"<br><b>{tr('install.checks')}</b><ul>")
            for c in it.checks:
                html.append(f"<li style='color:{LEVEL_COLORS[c.level]}'>{c.text(lang)}</li>")
            html.append("</ul>")
            if info.permissions:
                html.append(f"<b>{tr('install.permissions')}</b> ({len(info.permissions)})<ul>")
                dang = set(info.dangerous_permissions)
                for p in info.permissions:
                    style = f" style='color:{LEVEL_COLORS['warn']};font-weight:600'" if p in dang else ""
                    html.append(f"<li{style}>{p}</li>")
                html.append("</ul>")
            comps = []
            if info.services:
                comps.append(f"services: {len(info.services)}")
            if info.receivers:
                comps.append(f"receivers: {len(info.receivers)}")
            if info.activities:
                comps.append(f"activities: {len(info.activities)}")
            if info.providers:
                comps.append(f"providers: {len(info.providers)}")
            if comps:
                html.append(f"<b>{tr('install.components')}:</b> " + ", ".join(comps) + "<br>")
        if it.vt is not None:
            html.append(f"<br><b style='color:{LEVEL_COLORS.get(it.vt.level, '#e6e6e6')}'>{it.vt.summary(lang)}</b>")
            if it.vt.scan_date:
                html.append(f" ({it.vt.scan_date})")
            html.append(f" — <a href='{it.vt.permalink}'>{tr('vt.open')}</a><br>")
        if it.result:
            html.append(f"<br><b>{tr('install.col.status')}:</b> {it.result.message(lang)}<br><pre>{it.result.raw}</pre>")
        self.details.setHtml("".join(html))

    # ---- virustotal -----------------------------------------------------------------
    def _vt_text(self, it: Item) -> str:
        if it.vt_checking:
            return tr("vt.checking")
        v = it.vt
        if v is None:
            return ""
        if v.status == "found":
            if v.malicious:
                return tr("vt.malicious", n=v.malicious)
            if v.suspicious:
                return tr("vt.suspicious", n=v.suspicious)
            return tr("vt.clean")
        return tr("vt.unknown") if v.status == "not_found" else tr("vt.error")

    def _vt_check_selected(self) -> None:
        if not self.ctx.settings.virustotal_enabled or not get_secret("virustotal"):
            self.status.set(tr("install.vt_off"), "warn")
            return
        items = self._selected_items() or list(self.items)
        for it in items:
            if it.info and it.info.sha256 and not it.vt_checking:
                self._vt_check(it)

    def _vt_check(self, it: Item) -> None:
        key = get_secret("virustotal")
        if not key or not it.info:
            return
        it.vt_checking = True
        sha = it.info.sha256
        self._refill()

        def done(res):
            it.vt_checking = False
            it.vt = res
            self.ctx.logger.note("virustotal lookup", f"{sha} -> {res.status} malicious={res.malicious}", success=res.status in ("found", "not_found"))
            self._refill()
            self._show_details()

        def fail(msg):
            it.vt_checking = False
            it.vt = VTResult(sha, "error", message=msg)
            self._refill()

        run_in_background(vt_lookup, sha, key, on_done=done, on_error=fail)

    # ---- install --------------------------------------------------------------------
    def _install(self, selected_only: bool) -> None:
        if self._installing:
            return
        if not self.ctx.device_ready:
            self.status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        todo = self._selected_items() if selected_only else list(self.items)
        todo = [t for t in todo if t.state != "checking"]
        if not todo:
            return
        if any(t.state == "error" for t in todo):
            if not confirm(self, tr("install.confirm_errors"), danger=True):
                return
        for t in todo:
            if t.vt is not None and t.vt.status == "found" and t.vt.malicious > 0:
                if not confirm(self, tr("install.vt_confirm", n=t.vt.malicious, file=os.path.basename(t.path)), danger=True):
                    return
                self.ctx.logger.note("user overrode VirusTotal warning", f"{t.path} malicious={t.vt.malicious}", success=False)
        self._installing = True
        self.progress.setVisible(True)
        self.progress.setRange(0, len(todo))
        self.progress.setValue(0)
        self.btn_install.setEnabled(False)
        self.btn_install_sel.setEnabled(False)
        opts = dict(reinstall=self.chk_reinstall.isChecked(), downgrade=self.chk_downgrade.isChecked(),
                    grant_permissions=self.chk_grant.isChecked())
        installer = self.ctx.installer()
        device = self.ctx.runner.serial or ""

        def work(progress):
            results = []
            for i, it in enumerate(todo):
                progress(("start", i, it))
                pkg = it.info.package if it.info else ""
                preexisting = it.installed_version is not None
                res = installer.install(it.path, package=pkg, **opts)
                if res.success and (res.package or pkg):
                    p = res.package or pkg
                    self.ctx.db.track_install(p, label=it.info.label if it.info else "",
                                              version_name=it.info.version_name if it.info else "",
                                              version_code=it.info.version_code if it.info else 0,
                                              source_path=it.path, sha256=it.info.sha256 if it.info else "",
                                              device=device, preexisting=preexisting)
                results.append((it, res))
                progress(("done", i, it, res))
            return results

        def on_progress(ev):
            if ev[0] == "start":
                ev[2].state = "installing"
                self.status.set(f"{tr('install.status.installing')} {os.path.basename(ev[2].path)}")
            else:
                _, i, it, res = ev
                it.result = res
                it.state = "installed" if res.success else "failed"
                self.progress.setValue(i + 1)
            self._refill()
            self._show_details()

        def on_done(results):
            self._installing = False
            self.progress.setVisible(False)
            ok = sum(1 for _, r in results if r.success)
            self.status.set(tr("install.summary", ok=ok, fail=len(results) - ok), "ok" if ok == len(results) else "warn")
            self._refill()
            self.ctx.logger.note("batch install finished", f"{ok}/{len(results)} succeeded", success=ok == len(results), device=device)

        def on_error(msg):
            self._installing = False
            self.progress.setVisible(False)
            self.status.set(msg, "error")
            self._refill()

        run_in_background(work, on_done=on_done, on_error=on_error, on_progress=on_progress)
