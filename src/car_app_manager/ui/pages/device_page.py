"""Device page: detection (USB / Wi-Fi), info, wireless connect helper."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFormLayout, QGroupBox, QHBoxLayout, QLabel, QLineEdit,
                               QListWidget, QListWidgetItem, QPushButton, QVBoxLayout)

from ...adb.device import Device, DeviceInfo
from ...i18n import tr, human_size
from ...workers import run_in_background
from ..widgets.common import StatusLine, button, card, muted, title_label
from .base import BasePage


class DevicePage(BasePage):
    def build(self) -> None:
        self.title = title_label("")
        self.root.addWidget(self.title)

        # --- selector row
        top, tl = card()
        row = QHBoxLayout()
        self.lbl_select = QLabel()
        self.combo = QComboBox()
        self.combo.setMinimumWidth(320)
        self.combo.currentIndexChanged.connect(self._on_combo)
        self.btn_refresh = button("", slot=self.refresh)
        self.chk_auto = QCheckBox()
        self.chk_auto.setChecked(True)
        self.btn_restart = button("", slot=self._restart_adb)
        self.btn_diag = button("", slot=self._diagnostics)
        row.addWidget(self.lbl_select)
        row.addWidget(self.combo, 1)
        row.addWidget(self.btn_refresh)
        row.addWidget(self.chk_auto)
        row.addWidget(self.btn_restart)
        row.addWidget(self.btn_diag)
        tl.addLayout(row)
        self.status = StatusLine()
        tl.addWidget(self.status)
        self.root.addWidget(top)

        # --- info + wifi side by side
        body = QHBoxLayout()
        info_card, il = card()
        self.form = QFormLayout()
        self.form.setLabelAlignment(Qt.AlignLeft)
        self.info_labels: dict[str, QLabel] = {}
        self.info_keys: dict[str, QLabel] = {}
        for key in ("state", "connection", "serial", "model", "manufacturer", "android", "sdk", "abi", "storage", "wifi_ip", "build"):
            k = muted("")
            v = QLabel("—")
            v.setTextInteractionFlags(Qt.TextSelectableByMouse)
            self.info_keys[key] = k
            self.info_labels[key] = v
            self.form.addRow(k, v)
        il.addLayout(self.form)
        il.addStretch(1)
        body.addWidget(info_card, 3)

        self.wifi_group = QGroupBox()
        wl = QVBoxLayout(self.wifi_group)
        self.lbl_addr = QLabel()
        wl.addWidget(self.lbl_addr)
        r = QHBoxLayout()
        self.addr = QLineEdit()
        self.addr.setPlaceholderText("192.168.1.50:5555")
        self.addr.setMinimumWidth(170)
        self.addr.setText(self.ctx.settings.last_wifi_address)
        self.addr.returnPressed.connect(self._connect)
        self.btn_connect = button("", "primary", self._connect)
        self.btn_disconnect = button("", slot=self._disconnect)
        r.addWidget(self.addr, 1)
        r.addWidget(self.btn_connect)
        r.addWidget(self.btn_disconnect)
        wl.addLayout(r)
        self.lbl_known = muted("")
        wl.addWidget(self.lbl_known)
        self.known_list = QListWidget()
        self.known_list.itemDoubleClicked.connect(self._connect_known)
        wl.addWidget(self.known_list, 1)
        self.btn_forget = button("", slot=self._forget)
        wl.addWidget(self.btn_forget)
        self.btn_tcpip = button("", slot=self._tcpip)
        self.lbl_tcpip = muted("")
        self.btn_wizard = button("", "primary", self._wizard)
        wl.addWidget(self.btn_wizard)
        wl.addWidget(self.btn_tcpip)
        wl.addWidget(self.lbl_tcpip)
        body.addWidget(self.wifi_group, 2)
        self.root.addLayout(body, 1)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._auto_tick)
        self.timer.start(max(2, int(self.ctx.settings.auto_refresh_seconds)) * 1000)
        self._refreshing = False
        self._loading_combo = False

        self.ctx.devices_changed.connect(self._fill_combo)
        self.ctx.device_changed.connect(self._on_device_changed)
        self.ctx.device_info_changed.connect(self._show_info)
        self.ctx.adb_changed.connect(lambda _p: self.refresh())
        self._load_known()

    def retranslate(self) -> None:
        self.title.setText(tr("device.title"))
        self.lbl_select.setText(tr("device.select"))
        self.btn_refresh.setText(tr("refresh"))
        self.chk_auto.setText(tr("device.auto"))
        self.btn_restart.setText(tr("device.restart_adb"))
        self.btn_diag.setText(tr("diag.button"))
        for k, lbl in self.info_keys.items():
            lbl.setText(tr(f"device.{k}"))
        self.wifi_group.setTitle(tr("device.wifi_group"))
        self.lbl_addr.setText(tr("device.address"))
        self.btn_connect.setText(tr("device.connect"))
        self.btn_disconnect.setText(tr("device.disconnect"))
        self.lbl_known.setText(tr("device.known"))
        self.btn_forget.setText(tr("device.forget"))
        self.btn_tcpip.setText(tr("device.tcpip"))
        self.btn_wizard.setText(tr("wiz.button"))
        self.lbl_tcpip.setText(tr("device.tcpip_help"))
        self._fill_combo(self.ctx.known_devices)
        self._show_info(self.ctx.device_info)
        self._on_device_changed(self.ctx.current_device)

    def on_show(self) -> None:
        self.refresh()

    # ---- refresh ------------------------------------------------------------------
    def _auto_tick(self) -> None:
        if self.chk_auto.isChecked() and self.isVisible():
            self.refresh()

    def refresh(self) -> None:
        if self._refreshing or not self.ctx.adb_available:
            if not self.ctx.adb_available:
                self.status.set(tr("status.adb_missing"), "error")
            return
        self._refreshing = True
        run_in_background(self.ctx.devices.list_devices, on_done=self._got_devices, on_error=self._refresh_error)

    def _refresh_error(self, msg: str) -> None:
        self._refreshing = False
        self.status.set(msg, "error")

    def _got_devices(self, devices: list[Device]) -> None:
        self._refreshing = False
        prev = self.ctx.current_device
        self.ctx.set_devices(devices)
        cur = self.ctx.current_device
        if cur and cur.is_ready and (self.ctx.device_info is None or (prev and prev.serial != cur.serial)):
            run_in_background(self.ctx.devices.get_info, cur.serial, on_done=self.ctx.set_device_info)

    def _fill_combo(self, devices: list[Device]) -> None:
        self._loading_combo = True
        self.combo.clear()
        for d in devices:
            self.combo.addItem(f"{d.display_name} — {self._state_text(d.state)}", d.serial)
        cur = self.ctx.current_device
        if cur:
            i = self.combo.findData(cur.serial)
            if i >= 0:
                self.combo.setCurrentIndex(i)
        self._loading_combo = False
        if not devices:
            self.status.set(tr("device.none_found") + "\n" + tr("device.none_help"), "warn")
        elif len([d for d in devices if d.is_ready]) > 1:
            self.status.set(tr("device.multiple_help"), "warn")

    def _on_combo(self, idx: int) -> None:
        if self._loading_combo or idx < 0:
            return
        serial = self.combo.itemData(idx)
        dev = next((d for d in self.ctx.known_devices if d.serial == serial), None)
        if dev and (not self.ctx.current_device or dev.serial != self.ctx.current_device.serial):
            self.ctx.select_device(dev)
            if dev.is_ready:
                run_in_background(self.ctx.devices.get_info, dev.serial, on_done=self.ctx.set_device_info)

    @staticmethod
    def _state_text(state: str) -> str:
        return {"device": tr("status.connected"), "unauthorized": tr("status.unauthorized"),
                "offline": tr("status.offline")}.get(state, state)

    def _on_device_changed(self, dev: Device | None) -> None:
        if dev is None:
            self.info_labels["state"].setText(tr("status.no_device"))
            for k in ("connection", "serial"):
                self.info_labels[k].setText("—")
            self._show_info(None)
            return
        self.info_labels["state"].setText(self._state_text(dev.state))
        self.info_labels["connection"].setText(tr("device.wifi") if dev.is_wifi else tr("device.usb"))
        self.info_labels["serial"].setText(dev.serial)
        if dev.state == "unauthorized":
            self.status.set(tr("device.unauthorized_help"), "warn")
        elif dev.state == "offline":
            self.status.set(tr("device.offline_help"), "warn")
        elif dev.is_ready:
            self.status.set(f"{tr('status.connected')}: {dev.display_name}", "ok")
        if not dev.is_ready:
            self._show_info(None)
        self._load_known()

    def _show_info(self, info: DeviceInfo | None) -> None:
        keys = ("model", "manufacturer", "android", "sdk", "abi", "storage", "wifi_ip", "build")
        if info is None:
            for k in keys:
                self.info_labels[k].setText("—")
            return
        self.info_labels["model"].setText(info.model or "—")
        self.info_labels["manufacturer"].setText(f"{info.manufacturer} / {info.brand}".strip(" /") or "—")
        self.info_labels["android"].setText(info.android_version or "—")
        self.info_labels["sdk"].setText(str(info.sdk) if info.sdk else "—")
        self.info_labels["abi"].setText(", ".join(info.abis) or "—")
        if info.storage_total:
            self.info_labels["storage"].setText(tr("device.free_of", free=human_size(info.storage_free), total=human_size(info.storage_total)))
        else:
            self.info_labels["storage"].setText("—")
        self.info_labels["wifi_ip"].setText(info.wifi_ip or "—")
        self.info_labels["build"].setText(info.build_id or "—")
        if info.wifi_ip and not self.addr.text():
            self.addr.setText(f"{info.wifi_ip}:5555")

    # ---- wifi --------------------------------------------------------------------------
    def _connect(self) -> None:
        addr = self.addr.text().strip()
        if not addr:
            return
        self.ctx.settings.last_wifi_address = addr
        self.ctx.settings.save()
        self.btn_connect.setEnabled(False)
        self.status.set(tr("working"))
        run_in_background(self.ctx.devices.connect, addr, on_done=self._connected, on_error=self._refresh_error)

    def _connected(self, r) -> None:
        self.btn_connect.setEnabled(True)
        out = r.output
        if r.ok and ("connected to" in out or "already connected" in out):
            addr = out.split("connected to", 1)[-1].strip().rstrip(".")
            self.status.set(tr("device.connected_ok", addr=addr), "ok")
            self.ctx.db.remember_device(addr, "", addr)
            self._load_known()
        else:
            self.status.set(tr("device.connect_failed", msg=out), "error")
        self.refresh()

    def _disconnect(self) -> None:
        addr = self.addr.text().strip()
        cur = self.ctx.current_device
        if not addr and cur and cur.is_wifi:
            addr = cur.serial
        if not addr:
            return
        run_in_background(self.ctx.devices.disconnect, addr, on_done=lambda _r: self.refresh())

    def _tcpip(self) -> None:
        cur = self.ctx.current_device
        if not cur or not cur.is_ready or cur.is_wifi:
            self.status.set(tr("device_not_ready"), "warn")
            return
        run_in_background(self.ctx.devices.enable_tcpip, cur.serial, on_done=lambda r: self.status.set(r.output or tr("done"), "ok" if r.ok else "error"))

    def _wizard(self) -> None:
        from ..wireless_wizard import WirelessWizard
        w = WirelessWizard(self.ctx, self)
        w.exec()
        self._load_known()
        if w.connected_address:
            self.addr.setText(w.connected_address)
        self.refresh()

    def _load_known(self) -> None:
        self.known_list.clear()
        for d in self.ctx.db.known_devices():
            label = d["name"] or d["serial"]
            addr = d["address"] or ""
            it = QListWidgetItem(f"{label}  {addr}".strip())
            it.setData(Qt.UserRole, addr or d["serial"])
            it.setData(Qt.UserRole + 1, d["serial"])
            self.known_list.addItem(it)

    def _connect_known(self, item: QListWidgetItem) -> None:
        addr = item.data(Qt.UserRole)
        if addr and ":" in addr:
            self.addr.setText(addr)
            self._connect()

    def _forget(self) -> None:
        it = self.known_list.currentItem()
        if it:
            self.ctx.db.forget_device(it.data(Qt.UserRole + 1))
            self._load_known()

    def _diagnostics(self) -> None:
        from ..diagnostics_dialog import DiagnosticsDialog
        d = DiagnosticsDialog(self.ctx, self)
        if self.ctx.device_ready:
            d.run()
        d.exec()

    def _restart_adb(self) -> None:
        self.status.set(tr("working"))
        run_in_background(self.ctx.devices.restart_server, on_done=lambda _r: self.refresh())
