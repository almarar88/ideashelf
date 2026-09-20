"""Settings page: language, adb location/download, refresh interval, backups folder."""
from __future__ import annotations

from PySide6.QtWidgets import (QCheckBox, QComboBox, QDoubleSpinBox, QFileDialog, QFormLayout, QFrame, QGroupBox, QHBoxLayout,
                               QLabel, QLineEdit, QProgressBar, QScrollArea, QSpinBox, QVBoxLayout, QWidget)

from ...config import data_dir
from ...i18n import tr, current_lang
from ...tools.platform_tools import download_platform_tools, verify_adb
from ...security.secrets import get_secret, set_secret
from ...security.virustotal import lookup as vt_lookup
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, muted, title_label
from .base import BasePage


class SettingsPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        # everything below scrolls (the page is taller than most windows)
        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setFrameShape(QFrame.NoFrame)
        inner = QWidget(); page_root = self.root
        self.root = QVBoxLayout(inner); self.root.setContentsMargins(0, 0, 8, 0); self.root.setSpacing(10)
        scroll.setWidget(inner); page_root.addWidget(scroll, 1)

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

        self.g_vt = QGroupBox()
        vv = QVBoxLayout(self.g_vt)
        self.chk_vt = QCheckBox(); self.chk_vt.setChecked(self.ctx.settings.virustotal_enabled)
        vv.addWidget(self.chk_vt)
        hv = QHBoxLayout()
        self.lbl_vt_key = QLabel()
        self.ed_vt_key = QLineEdit(get_secret("virustotal")); self.ed_vt_key.setEchoMode(QLineEdit.Password)
        self.btn_vt_test = button("", slot=self._test_vt)
        hv.addWidget(self.lbl_vt_key); hv.addWidget(self.ed_vt_key, 1); hv.addWidget(self.btn_vt_test)
        vv.addLayout(hv)
        self.lbl_vt_help = muted("")
        vv.addWidget(self.lbl_vt_help)
        self.vt_status = StatusLine()
        vv.addWidget(self.vt_status)
        self.root.addWidget(self.g_vt)

        self.g_ai = QGroupBox()
        av = QFormLayout(self.g_ai)
        ha = QHBoxLayout()
        self.lbl_ai_key = QLabel()
        self.ed_ai_key = QLineEdit(get_secret("anthropic")); self.ed_ai_key.setEchoMode(QLineEdit.Password)
        self.btn_ai_test = button("", slot=self._test_ai)
        ha.addWidget(self.ed_ai_key, 1); ha.addWidget(self.btn_ai_test)
        av.addRow(self.lbl_ai_key, ha)
        self.lbl_ai_help = muted("")
        av.addRow("", self.lbl_ai_help)
        self.lbl_ai_cheap = QLabel(); self.ed_ai_cheap = QLineEdit(self.ctx.settings.ai_cheap_model); av.addRow(self.lbl_ai_cheap, self.ed_ai_cheap)
        self.lbl_ai_smart = QLabel(); self.ed_ai_smart = QLineEdit(self.ctx.settings.ai_smart_model); av.addRow(self.lbl_ai_smart, self.ed_ai_smart)
        self.lbl_ai_cap = QLabel(); self.spin_ai_cap = QDoubleSpinBox(); self.spin_ai_cap.setRange(0.0, 1000.0); self.spin_ai_cap.setDecimals(2)
        self.spin_ai_cap.setValue(float(self.ctx.settings.ai_monthly_cap_usd)); av.addRow(self.lbl_ai_cap, self.spin_ai_cap)
        self.lbl_ai_tokens = QLabel(); self.spin_ai_tokens = QSpinBox(); self.spin_ai_tokens.setRange(256, 64000)
        self.spin_ai_tokens.setValue(int(self.ctx.settings.ai_max_tokens_per_request)); av.addRow(self.lbl_ai_tokens, self.spin_ai_tokens)
        self.ai_status = StatusLine()
        av.addRow("", self.ai_status)
        self.root.addWidget(self.g_ai)

        self.g_safety = QGroupBox()
        sv = QVBoxLayout(self.g_safety)
        self.lbl_safety = muted("")
        sv.addWidget(self.lbl_safety)
        self.root.addWidget(self.g_safety)

        self.g_about = QGroupBox()
        ab = QVBoxLayout(self.g_about)
        from ... import __version__
        from ...support import build_info
        bi = build_info()
        self.lbl_about = muted(f"v{__version__}  ·  build {bi.get('sha', '')[:12] or '-'}  {bi.get('date', '')}")
        ab.addWidget(self.lbl_about)
        hu = QHBoxLayout()
        self.btn_update = button("", slot=self._check_update)
        self.btn_release = button("", slot=self._open_release)
        hu.addWidget(self.btn_update); hu.addWidget(self.btn_release); hu.addStretch(1)
        ab.addLayout(hu)
        self.update_status = StatusLine()
        ab.addWidget(self.update_status)
        self.root.addWidget(self.g_about)

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
        self.g_vt.setTitle(tr("settings.vt")); self.chk_vt.setText(tr("settings.vt_enable"))
        self.lbl_vt_key.setText(tr("settings.vt_key")); self.btn_vt_test.setText(tr("settings.vt_test")); self.lbl_vt_help.setText(tr("settings.vt_key_help"))
        self.g_ai.setTitle(tr("settings.ai")); self.lbl_ai_key.setText(tr("settings.ai_key")); self.btn_ai_test.setText(tr("settings.ai_test"))
        self.lbl_ai_help.setText(tr("settings.ai_key_help")); self.lbl_ai_cheap.setText(tr("settings.ai_cheap")); self.lbl_ai_smart.setText(tr("settings.ai_smart"))
        self.lbl_ai_cap.setText(tr("settings.ai_cap")); self.lbl_ai_tokens.setText(tr("settings.ai_max_tokens"))
        try:
            _, _, spent = self.ctx.ai.month_usage()
            self.ai_status.set(tr("settings.ai_usage", spent=spent))
        except Exception:
            pass
        self.g_about.setTitle(tr("settings.about")); self.btn_update.setText(tr("settings.check_update")); self.btn_release.setText(tr("settings.open_release"))
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

    def _check_update(self) -> None:
        from ...updates import check_for_update
        self.update_status.set(tr("working"))

        def done(u):
            if u.available:
                self.update_status.set(tr("settings.update_available", date=u.published[:10]), "warn")
            elif not u.latest_sha:
                self.update_status.set(tr("settings.update_unknown"), "muted")
            else:
                self.update_status.set(tr("settings.update_none"), "ok")

        run_in_background(check_for_update, on_done=done, on_error=lambda m: self.update_status.set(m, "error"))

    def _open_release(self) -> None:
        from PySide6.QtCore import QUrl
        from PySide6.QtGui import QDesktopServices
        from ...updates import RELEASE_PAGE
        QDesktopServices.openUrl(QUrl(RELEASE_PAGE))

    def _test_vt(self) -> None:
        key = self.ed_vt_key.text().strip()
        self.vt_status.set(tr("working"))
        # EICAR test file hash: always present on VirusTotal
        run_in_background(vt_lookup, "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f", key,
                          on_done=lambda r: self.vt_status.set(tr("settings.vt_ok") if r.status == "found" else tr("settings.vt_bad", msg=r.summary(current_lang())),
                                                               "ok" if r.status == "found" else "error"))

    def _test_ai(self) -> None:
        key = self.ed_ai_key.text().strip()
        if key != get_secret("anthropic"):
            set_secret("anthropic", key)
        self.ai_status.set(tr("working"))

        def done(models):
            self.ai_status.set(tr("settings.ai_ok", models=", ".join(models[:6])), "ok")

        def fail(msg):
            self.ai_status.set(msg, "error")

        run_in_background(self._ai_models, on_done=done, on_error=fail)

    def _ai_models(self):
        from ...ai.client import AIError
        try:
            return self.ctx.ai.test_key()
        except AIError as e:
            raise RuntimeError(e.text(current_lang())) from e

    def _save(self) -> None:
        s = self.ctx.settings
        s.ai_cheap_model = self.ed_ai_cheap.text().strip() or s.ai_cheap_model
        s.ai_smart_model = self.ed_ai_smart.text().strip() or s.ai_smart_model
        s.ai_monthly_cap_usd = float(self.spin_ai_cap.value())
        s.ai_max_tokens_per_request = int(self.spin_ai_tokens.value())
        ai_key = self.ed_ai_key.text().strip()
        if ai_key != get_secret("anthropic"):
            persistent = set_secret("anthropic", ai_key)
            self.ai_status.set(tr("settings.key_saved") if persistent else tr("settings.key_memory"), "ok" if persistent else "warn")
        s.virustotal_enabled = self.chk_vt.isChecked()
        key = self.ed_vt_key.text().strip()
        if key != get_secret("virustotal"):
            persistent = set_secret("virustotal", key)
            self.vt_status.set(tr("settings.key_saved") if persistent else tr("settings.key_memory"), "ok" if persistent else "warn")
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
