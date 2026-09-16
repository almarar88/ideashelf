"""Guided USB -> Wi-Fi ADB switch (standard `adb tcpip` + `adb connect`, nothing more)."""
from __future__ import annotations

import time

from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QLineEdit, QVBoxLayout

from ..app import AppContext
from ..i18n import tr
from ..workers import run_in_background
from .widgets.common import StatusLine, button

STEPS = ("usb", "ip", "tcpip", "connect")


class WirelessWizard(QDialog):
    def __init__(self, ctx: AppContext, parent=None):
        super().__init__(parent)
        self.ctx = ctx
        self.setWindowTitle(tr("wiz.title"))
        self.setMinimumWidth(560)
        lay = QVBoxLayout(self)
        intro = QLabel(tr("wiz.intro")); intro.setWordWrap(True)
        lay.addWidget(intro)
        self.steps: dict[str, StatusLine] = {}
        for s in STEPS:
            line = StatusLine(); line.set("○ " + tr(f"wiz.step_{s}"))
            self.steps[s] = line
            lay.addWidget(line)
        row = QHBoxLayout()
        self.ed_ip = QLineEdit(); self.ed_ip.setPlaceholderText("192.168.1.50")
        row.addWidget(QLabel(tr("device.address"))); row.addWidget(self.ed_ip, 1)
        lay.addLayout(row)
        self.result = StatusLine()
        lay.addWidget(self.result)
        btns = QHBoxLayout()
        self.btn_run = button(tr("wiz.run"), "primary", self._run)
        btns.addWidget(self.btn_run); btns.addStretch(1); btns.addWidget(button(tr("close"), slot=self.reject))
        lay.addLayout(btns)
        self.connected_address = ""

    def _mark(self, key: str, level: str, extra: str = "") -> None:
        icon = {"ok": "✔", "error": "✖", "warn": "…"}.get(level, "○")
        self.steps[key].set(f"{icon} {tr('wiz.step_' + key)}" + (f" — {extra}" if extra else ""), level)

    def _run(self) -> None:
        self.btn_run.setEnabled(False)
        manual_ip = self.ed_ip.text().strip()
        ctx = self.ctx

        def work(progress):
            devs = ctx.devices.list_devices()
            usb = [d for d in devs if d.is_ready and not d.is_wifi]
            if not usb:
                progress(("usb", "error", tr("wiz.no_usb")))
                return None
            serial = usb[0].serial
            progress(("usb", "ok", usb[0].display_name))
            ip = manual_ip
            if not ip:
                info = ctx.devices.get_info(serial)
                ip = info.wifi_ip
            if not ip:
                progress(("ip", "error", tr("wiz.no_ip")))
                return None
            progress(("ip", "ok", ip))
            r = ctx.devices.enable_tcpip(serial)
            if not r.ok:
                progress(("tcpip", "error", r.output))
                return None
            progress(("tcpip", "ok", r.output.strip()))
            time.sleep(2)
            addr = f"{ip}:5555"
            r = ctx.devices.connect(addr)
            if r.ok and "connected" in r.output:
                progress(("connect", "ok", addr))
                ctx.db.remember_device(addr, usb[0].model, addr)
                ctx.settings.last_wifi_address = addr
                ctx.settings.save()
                return addr
            progress(("connect", "error", r.output.strip()))
            return None

        def prog(p):
            key, level, extra = p
            self._mark(key, level, extra)

        def done(addr):
            self.btn_run.setEnabled(True)
            if addr:
                self.connected_address = addr
                self.result.set(tr("wiz.success", addr=addr), "ok")
            else:
                self.result.set(tr("wiz.fail", msg=""), "error")

        def fail(msg):
            self.btn_run.setEnabled(True)
            self.result.set(tr("wiz.fail", msg=msg), "error")

        for s in STEPS:
            self._mark(s, "muted")
        run_in_background(work, on_done=done, on_error=fail, on_progress=prog)
