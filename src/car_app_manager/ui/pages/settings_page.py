"""Settings page: language, adb location/download, refresh interval, backups folder."""
from __future__ import annotations

from PySide6.QtWidgets import (QCheckBox, QComboBox, QFileDialog, QFormLayout, QGroupBox, QHBoxLayout, QLabel,
                               QLineEdit, QProgressBar, QSpinBox, QVBoxLayout)

from ...config import data_dir
from ...i18n import tr
from ...tools.platform_tools import download_platform_tools, verify_adb
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, muted, title_label
from .base import BasePage


class SettingsPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)

        self.g_general = QGroupBox()
        f = QFormLayout(self.g_general)
        self.lbl_lang = QLabel()
        self.cmb_lang = QComboBox()
        self.cmb_lang.addItem("العربية", "ar")
        self.cmb_lang.addItem("English", "en")
        self.cmb_lang.setCurrentIndex(0 if self.ctx.settings.language == "ar" else 1)
        self.cmb_lang.currentIndexChanged.connect(lambda i: self.ctx.set_language(self.cmb_lang.itemData(i)))
        f.addRow(self.lbl_lang, self.cmb_lang)
        self.lbl_refresh = QLabel()
        self.spin_refresh = QSpinBox(); self.spin_refresh.setRange(2, 120); self.spin_refresh.setValue(self.ctx.settings.auto_refresh_seconds)
        f.addRow(self.lbl_refresh, self.spin_refresh)
        self.lbl_backups = QLabel()
        h = QHBoxLayout()
        self.ed_backups = QLineEdit(self.ctx.settings.backups_dir)
        self.btn_backups = button("", slot=self._browse_backups)
        h.addWidget(self.ed_backups, 1); h.addWidget(self.btn_backups)
        f.addRow(self.lbl_backups, h)
        self.lbl_shots = QLabel()
        h3 = QHBoxLayout()
        self.ed_shots = QLineEdit(self.ctx.settings.screenshots_dir)
        self.btn_shots = button("", slot=self._browse_shots)
        h3.addWidget(self.ed_shots, 1); h3.addWidget(self.btn_shots)
        f.addRow(self.lbl_shots, h3)
        self.lbl_scrcpy = QLabel()
        h4 = QHBoxLayout()
        self.ed_scrcpy = QLineEdit(self.ctx.settings.scrcpy_path)
        self.btn_scrcpy = button("", slot=self._browse_scrcpy)
        h4.addWidget(self.ed_scrcpy, 1); h4.addWidget(self.btn_scrcpy)
        f.addRow(self.lbl_scrcpy, h4)
        self.chk_confirm = QCheckBox(); self.chk_confirm.setChecked(self.ctx.settings.confirm_destructive)
        f.addRow("", self.chk_confirm)
        self.lbl_data = QLabel()
        self.ed_data = QLineEdit(str(data_dir())); self.ed_data.setReadOnly(True)
        f.addRow(self.lbl_data, self.ed_data)
        self.root.addWidget(self.g_general)

        self.g_adb = QGroupBox()
        v = QVBoxLayout(self.g_adb)
        h2 = QHBoxLayout()
        self.lbl_adb = QLabel()
        self.ed_adb = QLineEdit(self.ctx.adb_path)
        self.btn_adb_browse = button("", slot=self._browse_adb)
        self.btn_adb_test = button("", slot=self._test_adb)
        self.btn_adb_download = button("", "primary", self._download)
        h2.addWidget(self.lbl_adb); h2.addWidget(self.ed_adb, 1); h2.addWidget(self.btn_adb_browse); h2.addWidget(self.btn_adb_test); h2.addWidget(self.btn_adb_download)
        v.addLayout(h2)
        self.dl_progress = QProgressBar(); self.dl_progress.setVisible(False)
        v.addWidget(self.dl_progress)
        self.adb_status = StatusLine()
        v.addWidget(self.adb_status)
        self.root.addWidget(self.g_adb)

        self.g_safety = QGroupBox()
        sv = QVBoxLayout(self.g_safety)
        self.lbl_safety = muted("")
        sv.addWidget(self.lbl_safety)
        self.root.addWidget(self.g_safety)

        row = QHBoxLayout()
        self.btn_save = button("", "primary", self._save)
        row.addWidget(self.btn_save); row.addStretch(1)
        self.status = StatusLine()
        row.addWidget(self.status)
        self.root.addLayout(row)
        self.root.addStretch(1)
        self.ctx.adb_changed.connect(lambda p: self.ed_adb.setText(p))

    def retranslate(self) -> None:
        self.title.setText(tr("settings.title"))
        self.g_general.setTitle(tr("settings.general"))
        self.lbl_lang.setText(tr("language"))
        self.lbl_refresh.setText(tr("settings.refresh"))
        self.lbl_backups.setText(tr("settings.backups"))
        self.btn_backups.setText(tr("browse"))
        self.lbl_shots.setText(tr("settings.shots_dir")); self.btn_shots.setText(tr("browse"))
        self.lbl_scrcpy.setText(tr("settings.scrcpy_path")); self.btn_scrcpy.setText(tr("browse"))
        self.chk_confirm.setText(tr("settings.confirm"))
        self.lbl_data.setText(tr("settings.data_dir"))
        self.g_adb.setTitle(tr("settings.adb"))
        self.lbl_adb.setText(tr("settings.adb_path"))
        self.btn_adb_browse.setText(tr("browse"))
        self.btn_adb_test.setText(tr("settings.adb_test"))
        self.btn_adb_download.setText(tr("settings.adb_download"))
        self.g_safety.setTitle(tr("settings.safety"))
        self.lbl_safety.setText(tr("settings.safety_text"))
        self.btn_save.setText(tr("settings.save"))

    def _browse_backups(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("settings.backups"), self.ed_backups.text())
        if d:
            self.ed_backups.setText(d)

    def _browse_shots(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("settings.shots_dir"), self.ed_shots.text())
        if d:
            self.ed_shots.setText(d)

    def _browse_scrcpy(self) -> None:
        p, _ = QFileDialog.getOpenFileName(self, tr("settings.scrcpy_path"), "", "scrcpy (scrcpy.exe scrcpy);;All (*)")
        if p:
            self.ed_scrcpy.setText(p)

    def _browse_adb(self) -> None:
        p, _ = QFileDialog.getOpenFileName(self, tr("settings.adb_path"), "", "adb (adb.exe adb);;All (*)")
        if p:
            self.ed_adb.setText(p)
            self._test_adb()

    def _test_adb(self) -> None:
        path = self.ed_adb.text().strip()
        self.adb_status.set(tr("working"))
        run_in_background(verify_adb, path, on_done=self._tested)

    def _tested(self, version) -> None:
        if version:
            self.adb_status.set(tr("settings.adb_ok", v=version), "ok")
            self.ctx.set_adb_path(self.ed_adb.text().strip())
        else:
            self.adb_status.set(tr("settings.adb_bad"), "error")

    def _download(self) -> None:
        self.btn_adb_download.setEnabled(False)
        self.dl_progress.setVisible(True)
        self.dl_progress.setRange(0, 100)

        def prog(p):
            done, total = p
            pct = int(done * 100 / total) if total else 0
            self.dl_progress.setValue(pct)
            self.adb_status.set(tr("settings.adb_downloading", pct=pct))

        def done(path):
            self.btn_adb_download.setEnabled(True)
            self.dl_progress.setVisible(False)
            self.ed_adb.setText(path)
            self.ctx.set_adb_path(path)
            self.adb_status.set(tr("settings.adb_downloaded", path=path), "ok")

        def fail(msg):
            self.btn_adb_download.setEnabled(True)
            self.dl_progress.setVisible(False)
            self.adb_status.set(tr("settings.adb_download_failed", msg=msg), "error")

        run_in_background(lambda progress: download_platform_tools(lambda d, t: progress((d, t))),
                          on_done=done, on_error=fail, on_progress=prog)

    def _save(self) -> None:
        s = self.ctx.settings
        s.auto_refresh_seconds = self.spin_refresh.value()
        s.backups_dir = self.ed_backups.text().strip() or s.backups_dir
        s.confirm_destructive = self.chk_confirm.isChecked()
        s.screenshots_dir = self.ed_shots.text().strip() or s.screenshots_dir
        s.scrcpy_path = self.ed_scrcpy.text().strip()
        adb = self.ed_adb.text().strip()
        if adb != self.ctx.adb_path:
            self.ctx.set_adb_path(adb, persist=False)
        s.adb_path = adb
        s.save()
        self.status.set(tr("settings.saved"), "ok")
