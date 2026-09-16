"""Screen page: scrcpy mirroring, screenshots, live logcat."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QPixmap, QTextCursor, QColor, QTextCharFormat, QGuiApplication
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFileDialog, QFormLayout, QHBoxLayout, QLabel, QLineEdit,
                               QPlainTextEdit, QProgressBar, QSpinBox, QTabWidget, QVBoxLayout, QWidget)

from ...adb.logcat import LEVELS, LogcatStreamer, build_logcat_args, find_pid, level_passes, parse_line
from ...adb.screen import take_screenshot
from ...config import logs_dir
from ...i18n import tr
from ...tools.scrcpy import ScrcpyProcess, build_scrcpy_command, download_scrcpy, find_scrcpy
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, muted, title_label
from .base import BasePage

LEVEL_COLORS = {"V": "#8a9099", "D": "#7fb3ff", "I": "#e6e6e6", "W": "#ffb84d", "E": "#ff6b6b", "F": "#ff3b3b"}


class ScreenPage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)
        self.tabs = QTabWidget()
        self.root.addWidget(self.tabs, 1)
        self._build_mirror()
        self._build_shot()
        self._build_logcat()
        self.scrcpy: ScrcpyProcess | None = None
        self.scrcpy_path = find_scrcpy(self.ctx.settings.scrcpy_path)
        self._poll = QTimer(self); self._poll.setInterval(1000); self._poll.timeout.connect(self._poll_scrcpy)
        self.streamer: LogcatStreamer | None = None
        self.log_lines: list[str] = []
        self._lc_timer = QTimer(self); self._lc_timer.setInterval(100); self._lc_timer.timeout.connect(self._drain_logcat)
        self.ctx.device_changed.connect(lambda _d: self._update_scrcpy_status())

    # ---------------------------------------------------------------- mirror
    def _build_mirror(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        self.m_help = muted("")
        lay.addWidget(self.m_help)
        self.m_status = StatusLine()
        lay.addWidget(self.m_status)
        row = QHBoxLayout()
        self.btn_scrcpy_dl = button("", slot=self._download_scrcpy)
        self.btn_scrcpy_browse = button("", slot=self._browse_scrcpy)
        row.addWidget(self.btn_scrcpy_dl); row.addWidget(self.btn_scrcpy_browse); row.addStretch(1)
        lay.addLayout(row)
        self.dl_progress = QProgressBar(); self.dl_progress.setVisible(False)
        lay.addWidget(self.dl_progress)
        form = QFormLayout()
        s = self.ctx.settings
        self.lbl_size = QLabel(); self.spin_size = QSpinBox(); self.spin_size.setRange(0, 4096); self.spin_size.setValue(s.scrcpy_max_size)
        self.lbl_bitrate = QLabel(); self.spin_bitrate = QSpinBox(); self.spin_bitrate.setRange(1, 64); self.spin_bitrate.setValue(s.scrcpy_bitrate)
        self.lbl_fps = QLabel(); self.spin_fps = QSpinBox(); self.spin_fps.setRange(0, 120); self.spin_fps.setValue(s.scrcpy_fps)
        form.addRow(self.lbl_size, self.spin_size)
        form.addRow(self.lbl_bitrate, self.spin_bitrate)
        form.addRow(self.lbl_fps, self.spin_fps)
        self.chk_top = QCheckBox(); self.chk_top.setChecked(s.scrcpy_always_on_top)
        self.chk_no_audio = QCheckBox(); self.chk_no_audio.setChecked(s.scrcpy_no_audio)
        self.chk_record = QCheckBox()
        form.addRow("", self.chk_top); form.addRow("", self.chk_no_audio); form.addRow("", self.chk_record)
        self.lbl_rec_dir = QLabel()
        rec = QHBoxLayout()
        self.ed_rec_dir = QLineEdit(str(Path(s.screenshots_dir).parent / "recordings")); self.ed_rec_dir.setReadOnly(True)
        self.btn_rec_dir = button("", slot=self._browse_rec)
        rec.addWidget(self.ed_rec_dir, 1); rec.addWidget(self.btn_rec_dir)
        form.addRow(self.lbl_rec_dir, rec)
        lay.addLayout(form)
        row2 = QHBoxLayout()
        self.btn_start = button("", "primary", self._start_scrcpy)
        self.btn_stop = button("", "danger", self._stop_scrcpy)
        row2.addWidget(self.btn_start); row2.addWidget(self.btn_stop); row2.addStretch(1)
        lay.addLayout(row2)
        lay.addStretch(1)
        self.tabs.addTab(w, "")

    def _update_scrcpy_status(self) -> None:
        if self.scrcpy and self.scrcpy.running:
            self.m_status.set(tr("scrcpy.running"), "ok")
        elif self.scrcpy_path:
            self.m_status.set(tr("scrcpy.found", path=self.scrcpy_path), "ok")
        else:
            self.m_status.set(tr("scrcpy.missing"), "warn")
        running = bool(self.scrcpy and self.scrcpy.running)
        self.btn_start.setEnabled(bool(self.scrcpy_path) and self.ctx.device_ready and not running)
        self.btn_stop.setEnabled(running)

    def _browse_scrcpy(self) -> None:
        p, _ = QFileDialog.getOpenFileName(self, tr("settings.scrcpy_path"), "", "scrcpy (scrcpy.exe scrcpy);;All (*)")
        if p:
            self.scrcpy_path = p
            self.ctx.settings.scrcpy_path = p
            self.ctx.settings.save()
            self._update_scrcpy_status()

    def _download_scrcpy(self) -> None:
        self.btn_scrcpy_dl.setEnabled(False)
        self.dl_progress.setVisible(True); self.dl_progress.setRange(0, 100)

        def prog(p):
            done, total = p
            pct = int(done * 100 / total) if total else 0
            self.dl_progress.setValue(pct)
            self.m_status.set(tr("scrcpy.downloading", pct=pct))

        def done(path):
            self.btn_scrcpy_dl.setEnabled(True); self.dl_progress.setVisible(False)
            self.scrcpy_path = path
            self.ctx.settings.scrcpy_path = path; self.ctx.settings.save()
            self._update_scrcpy_status()

        def fail(msg):
            self.btn_scrcpy_dl.setEnabled(True); self.dl_progress.setVisible(False)
            self.m_status.set(tr("scrcpy.download_failed", msg=msg), "error")

        run_in_background(lambda progress: download_scrcpy(lambda d, t: progress((d, t))), on_done=done, on_error=fail, on_progress=prog)

    def _browse_rec(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("scrcpy.record_dir"), self.ed_rec_dir.text())
        if d:
            self.ed_rec_dir.setText(d)

    def _start_scrcpy(self) -> None:
        if not self.scrcpy_path or not self.ctx.device_ready:
            return
        s = self.ctx.settings
        s.scrcpy_max_size = self.spin_size.value(); s.scrcpy_bitrate = self.spin_bitrate.value(); s.scrcpy_fps = self.spin_fps.value()
        s.scrcpy_always_on_top = self.chk_top.isChecked(); s.scrcpy_no_audio = self.chk_no_audio.isChecked(); s.save()
        record = ""
        if self.chk_record.isChecked():
            from datetime import datetime
            Path(self.ed_rec_dir.text()).mkdir(parents=True, exist_ok=True)
            record = str(Path(self.ed_rec_dir.text()) / f"car_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.mp4")
        dev = self.ctx.current_device
        title = f"{tr('app.title')} — {dev.model.replace('_', ' ') if dev and dev.model else dev.serial if dev else ''}"
        cmd = build_scrcpy_command(self.scrcpy_path, dev.serial if dev else None, title, s.scrcpy_max_size, s.scrcpy_bitrate,
                                   s.scrcpy_fps, s.scrcpy_always_on_top, s.scrcpy_no_audio, record)
        self.scrcpy = ScrcpyProcess(cmd, self.ctx.adb_path)
        try:
            self.scrcpy.start(logs_dir())
            self.ctx.logger.record("scrcpy start", " ".join(cmd), 0, device=dev.serial if dev else "")
        except OSError as e:
            self.m_status.set(str(e), "error")
            self.scrcpy = None
            return
        self._poll.start()
        self._update_scrcpy_status()

    def _stop_scrcpy(self) -> None:
        if self.scrcpy:
            self.scrcpy.stop()
            self.ctx.logger.note("scrcpy stop", "", device=self.ctx.runner.serial or "")
        self._poll_scrcpy()

    def _poll_scrcpy(self) -> None:
        if self.scrcpy and not self.scrcpy.running:
            rc = self.scrcpy.returncode
            log = self.scrcpy.tail_log(8)
            self._poll.stop()
            self.scrcpy = None
            self._update_scrcpy_status()
            if rc not in (0, None):
                self.m_status.set(tr("scrcpy.exited", rc=rc, log=log), "error")
        else:
            self._update_scrcpy_status()

    # ---------------------------------------------------------------- screenshot
    def _build_shot(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        row = QHBoxLayout()
        self.lbl_shot_dir = QLabel()
        self.ed_shot_dir = QLineEdit(self.ctx.settings.screenshots_dir); self.ed_shot_dir.setReadOnly(True)
        self.btn_shot_dir = button("", slot=self._browse_shot_dir)
        self.btn_shot_open = button("", slot=lambda: _open_folder(self.ed_shot_dir.text()))
        row.addWidget(self.lbl_shot_dir); row.addWidget(self.ed_shot_dir, 1); row.addWidget(self.btn_shot_dir); row.addWidget(self.btn_shot_open)
        lay.addLayout(row)
        row2 = QHBoxLayout()
        self.btn_capture = button("", "primary", self._capture)
        self.btn_copy = button("", slot=self._copy_shot); self.btn_copy.setEnabled(False)
        row2.addWidget(self.btn_capture); row2.addWidget(self.btn_copy); row2.addStretch(1)
        lay.addLayout(row2)
        self.shot_status = StatusLine()
        lay.addWidget(self.shot_status)
        self.preview = QLabel()
        self.preview.setAlignment(Qt.AlignCenter)
        self.preview.setMinimumHeight(300)
        self.preview.setObjectName("card")
        lay.addWidget(self.preview, 1)
        self._last_shot: Path | None = None
        self.tabs.addTab(w, "")

    def _browse_shot_dir(self) -> None:
        d = QFileDialog.getExistingDirectory(self, tr("shot.folder"), self.ed_shot_dir.text())
        if d:
            self.ed_shot_dir.setText(d)
            self.ctx.settings.screenshots_dir = d; self.ctx.settings.save()

    def _capture(self) -> None:
        if not self.ctx.device_ready:
            self.shot_status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        self.btn_capture.setEnabled(False)
        self.shot_status.set(tr("working"))
        run_in_background(take_screenshot, self.ctx.runner, self.ed_shot_dir.text(), on_done=self._captured,
                          on_error=lambda m: (self.btn_capture.setEnabled(True), self.shot_status.set(m, "error")))

    def _captured(self, path: Path) -> None:
        self.btn_capture.setEnabled(True)
        self._last_shot = path
        self.shot_status.set(tr("shot.saved", path=str(path)), "ok")
        pm = QPixmap(str(path))
        if not pm.isNull():
            self.preview.setPixmap(pm.scaled(self.preview.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))
        self.btn_copy.setEnabled(True)

    def _copy_shot(self) -> None:
        if self._last_shot and self._last_shot.exists():
            QGuiApplication.clipboard().setPixmap(QPixmap(str(self._last_shot)))
            self.shot_status.set(tr("shot.copied"), "ok")

    def resizeEvent(self, e) -> None:
        super().resizeEvent(e)
        if self._last_shot and self._last_shot.exists():
            pm = QPixmap(str(self._last_shot))
            if not pm.isNull():
                self.preview.setPixmap(pm.scaled(self.preview.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    # ---------------------------------------------------------------- logcat
    def _build_logcat(self) -> None:
        w = QWidget(); lay = QVBoxLayout(w)
        row = QHBoxLayout()
        self.lbl_pkg = QLabel()
        self.cmb_pkg = QComboBox(); self.cmb_pkg.setEditable(True); self.cmb_pkg.setMinimumWidth(240)
        self.lbl_level = QLabel()
        self.cmb_level = QComboBox()
        for l in LEVELS:
            self.cmb_level.addItem(l, l)
        self.cmb_level.setCurrentIndex(0)
        self.ed_filter = QLineEdit()
        self.ed_filter.textChanged.connect(lambda _t: self._rerender())
        self.chk_scroll = QCheckBox(); self.chk_scroll.setChecked(True)
        row.addWidget(self.lbl_pkg); row.addWidget(self.cmb_pkg, 1); row.addWidget(self.lbl_level); row.addWidget(self.cmb_level)
        row.addWidget(self.ed_filter, 1); row.addWidget(self.chk_scroll)
        lay.addLayout(row)
        row2 = QHBoxLayout()
        self.btn_lc_start = button("", "primary", self._start_logcat)
        self.btn_lc_stop = button("", slot=self._stop_logcat); self.btn_lc_stop.setEnabled(False)
        self.btn_lc_clear = button("", slot=self._clear_logcat)
        self.btn_lc_clear_dev = button("", slot=self._clear_device_log)
        self.btn_lc_save = button("", slot=self._save_logcat)
        for b in (self.btn_lc_start, self.btn_lc_stop, self.btn_lc_clear, self.btn_lc_clear_dev, self.btn_lc_save):
            row2.addWidget(b)
        row2.addStretch(1)
        self.lc_status = StatusLine()
        row2.addWidget(self.lc_status)
        lay.addLayout(row2)
        self.lc_view = QPlainTextEdit()
        self.lc_view.setReadOnly(True)
        self.lc_view.setMaximumBlockCount(20000)
        self.lc_view.setLineWrapMode(QPlainTextEdit.NoWrap)
        self.lc_view.setLayoutDirection(Qt.LeftToRight)  # log text is always LTR
        lay.addWidget(self.lc_view, 1)
        self.tabs.addTab(w, "")
        self.ctx.device_changed.connect(lambda _d: self._fill_packages())
        self.ctx.apps_loaded.connect(self.set_packages)

    def _fill_packages(self) -> None:
        cur = self.cmb_pkg.currentText()
        self.cmb_pkg.clear()
        self.cmb_pkg.addItem(tr("logcat.all"), "")
        for t in self.ctx.db.tracked_apps():
            self.cmb_pkg.addItem(t.package, t.package)
        if cur and cur != tr("logcat.all"):
            self.cmb_pkg.setEditText(cur)

    def set_packages(self, packages: list[str]) -> None:
        """Called by the apps page after it loads the list."""
        cur = self.cmb_pkg.currentText()
        self.cmb_pkg.clear()
        self.cmb_pkg.addItem(tr("logcat.all"), "")
        for p in packages:
            self.cmb_pkg.addItem(p, p)
        if cur and cur != tr("logcat.all"):
            self.cmb_pkg.setEditText(cur)

    def _current_package(self) -> str:
        data = self.cmb_pkg.currentData()
        text = self.cmb_pkg.currentText().strip()
        if data is not None and text == self.cmb_pkg.itemText(self.cmb_pkg.currentIndex()):
            return data or ""
        return "" if text == tr("logcat.all") else text

    def _start_logcat(self) -> None:
        if self.streamer:
            return
        if not self.ctx.device_ready:
            self.lc_status.set(tr("no_device") if not self.ctx.current_device else tr("device_not_ready"), "warn")
            return
        pkg = self._current_package()
        level = self.cmb_level.currentData()
        serial = self.ctx.runner.serial
        self.btn_lc_start.setEnabled(False)

        def prepare():
            pid = find_pid(self.ctx.runner, pkg) if pkg else None
            return pkg, pid

        def go(res):
            pkg_, pid = res
            if pkg_ and not pid:
                self.btn_lc_start.setEnabled(True)
                self.lc_status.set(tr("logcat.no_pid", pkg=pkg_), "warn")
                return
            args = build_logcat_args(self.ctx.adb_path, serial, pid, level)
            self.streamer = LogcatStreamer(args, self)
            self.streamer.finished_with.connect(self._logcat_finished)
            self.streamer.start()
            self._lc_timer.start()
            self.ctx.logger.record("logcat start", " ".join(args), 0, device=serial or "")
            self.btn_lc_stop.setEnabled(True)
            self.lc_status.set(tr("logcat.running", n=len(self.log_lines)))

        run_in_background(prepare, on_done=go, on_error=lambda m: (self.btn_lc_start.setEnabled(True), self.lc_status.set(m, "error")))

    def _stop_logcat(self) -> None:
        if self.streamer:
            self.streamer.stop()

    def _drain_logcat(self) -> None:
        if self.streamer:
            lines = self.streamer.drain()
            if lines:
                self._on_lines(lines)

    def _logcat_finished(self, msg: str) -> None:
        self._lc_timer.stop()
        if self.streamer:
            self.streamer.wait(2000)
            self._drain_logcat()
        self.streamer = None
        self.btn_lc_start.setEnabled(True)
        self.btn_lc_stop.setEnabled(False)
        self.lc_status.set(tr("logcat.stopped", n=len(self.log_lines)) + (f" ({msg})" if msg else ""))

    def _on_lines(self, lines: list[str]) -> None:
        self.log_lines.extend(lines)
        flt = self.ed_filter.text().strip().lower()
        min_level = self.cmb_level.currentData() or "V"
        for line in lines:
            self._append(line, flt, min_level)
        self.lc_status.set(tr("logcat.running", n=len(self.log_lines)))

    def _append(self, line: str, flt: str, min_level: str) -> None:
        ll = parse_line(line)
        if ll.parsed and not level_passes(ll.level, min_level):
            return
        if flt and flt not in line.lower():
            return
        fmt = QTextCharFormat()
        fmt.setForeground(QColor(LEVEL_COLORS.get(ll.level, "#e6e6e6")))
        cur = self.lc_view.textCursor()
        cur.movePosition(QTextCursor.End)
        cur.insertText(line + "\n", fmt)
        if self.chk_scroll.isChecked():
            self.lc_view.setTextCursor(cur)

    def _rerender(self) -> None:
        self.lc_view.clear()
        flt = self.ed_filter.text().strip().lower()
        min_level = self.cmb_level.currentData() or "V"
        for line in self.log_lines[-5000:]:
            self._append(line, flt, min_level)

    def _clear_logcat(self) -> None:
        self.log_lines = []
        self.lc_view.clear()
        self.lc_status.set("")

    def _clear_device_log(self) -> None:
        if self.ctx.device_ready:
            run_in_background(self.ctx.runner.run, "logcat", "-c", action="logcat clear", on_done=lambda _r: self._clear_logcat())

    def _save_logcat(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, tr("logcat.save"), "logcat.txt", "Text (*.txt *.log)")
        if path:
            Path(path).write_text("\n".join(self.log_lines) + "\n", encoding="utf-8")
            self.lc_status.set(tr("logcat.saved", n=len(self.log_lines), path=path), "ok")

    # ---------------------------------------------------------------- page
    def retranslate(self) -> None:
        self.title.setText(tr("screen.title"))
        self.tabs.setTabText(0, tr("screen.tab.mirror")); self.tabs.setTabText(1, tr("screen.tab.shot")); self.tabs.setTabText(2, tr("screen.tab.logcat"))
        self.m_help.setText(tr("scrcpy.help"))
        self.btn_scrcpy_dl.setText(tr("scrcpy.download")); self.btn_scrcpy_browse.setText(tr("browse"))
        self.lbl_size.setText(tr("scrcpy.max_size")); self.lbl_bitrate.setText(tr("scrcpy.bitrate")); self.lbl_fps.setText(tr("scrcpy.fps"))
        self.chk_top.setText(tr("scrcpy.top")); self.chk_no_audio.setText(tr("scrcpy.no_audio")); self.chk_record.setText(tr("scrcpy.record"))
        self.lbl_rec_dir.setText(tr("scrcpy.record_dir")); self.btn_rec_dir.setText(tr("browse"))
        self.btn_start.setText(tr("scrcpy.start")); self.btn_stop.setText(tr("scrcpy.stop"))
        self.lbl_shot_dir.setText(tr("shot.folder")); self.btn_shot_dir.setText(tr("browse")); self.btn_shot_open.setText(tr("shot.open"))
        self.btn_capture.setText(tr("shot.capture")); self.btn_copy.setText(tr("shot.copy"))
        self.lbl_pkg.setText(tr("logcat.package")); self.lbl_level.setText(tr("logcat.level")); self.ed_filter.setPlaceholderText(tr("logcat.filter"))
        self.chk_scroll.setText(tr("logcat.autoscroll"))
        self.btn_lc_start.setText(tr("logcat.start")); self.btn_lc_stop.setText(tr("logcat.stop")); self.btn_lc_clear.setText(tr("logcat.clear"))
        self.btn_lc_clear_dev.setText(tr("logcat.clear_device")); self.btn_lc_save.setText(tr("logcat.save"))
        if hasattr(self, "scrcpy"):
            self._update_scrcpy_status()
        if self.cmb_pkg.count() == 0:
            self._fill_packages()
        else:
            self.cmb_pkg.setItemText(0, tr("logcat.all"))

    def on_show(self) -> None:
        self._update_scrcpy_status()

    def shutdown(self) -> None:
        if self.streamer:
            self.streamer.stop(); self.streamer.wait(2000)
        if self.scrcpy and self.scrcpy.running:
            self.scrcpy.stop()


def _open_folder(p: str) -> None:
    if not os.path.isdir(p):
        Path(p).mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":
        os.startfile(p)  # type: ignore[attr-defined]
    else:
        subprocess.Popen(["xdg-open", p])
