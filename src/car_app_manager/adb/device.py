"""Device discovery (USB + Wi-Fi) and device information."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from .runner import AdbRunner, AdbResult

_IP_PORT_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}:\d+$")


@dataclass
class Device:
    serial: str
    state: str  # device | unauthorized | offline | no permissions | connecting | ...
    model: str = ""
    product: str = ""
    device_name: str = ""
    transport_id: str = ""

    @property
    def is_wifi(self) -> bool:
        return bool(_IP_PORT_RE.match(self.serial))

    @property
    def is_ready(self) -> bool:
        return self.state == "device"

    @property
    def display_name(self) -> str:
        label = self.model.replace("_", " ") if self.model else self.serial
        return f"{label} ({self.serial})" if self.model else self.serial


@dataclass
class DeviceInfo:
    serial: str = ""
    model: str = ""
    manufacturer: str = ""
    brand: str = ""
    android_version: str = ""
    sdk: int = 0
    abis: list[str] = field(default_factory=list)
    build_id: str = ""
    storage_total: int = 0  # bytes (/data)
    storage_free: int = 0
    wifi_ip: str = ""
    raw_props: dict[str, str] = field(default_factory=dict)

    @property
    def primary_abi(self) -> str:
        return self.abis[0] if self.abis else ""


def parse_devices(output: str) -> list[Device]:
    """Parse `adb devices -l` output."""
    devices: list[Device] = []
    for line in output.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices") or line.startswith("*"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        serial, state = parts[0], parts[1]
        if state == "no" and len(parts) > 2 and parts[2].startswith("permissions"):
            state = "no permissions"
        dev = Device(serial=serial, state=state)
        for p in parts[2:]:
            if ":" in p:
                k, _, v = p.partition(":")
                if k == "model":
                    dev.model = v
                elif k == "product":
                    dev.product = v
                elif k == "device":
                    dev.device_name = v
                elif k == "transport_id":
                    dev.transport_id = v
        devices.append(dev)
    return devices


def parse_getprop(output: str) -> dict[str, str]:
    props: dict[str, str] = {}
    for m in re.finditer(r"\[([^\]]+)\]:\s*\[([^\]]*)\]", output):
        props[m.group(1)] = m.group(2)
    return props


def parse_df(output: str) -> tuple[int, int]:
    """Parse `df -k /data` -> (total_bytes, free_bytes). Returns (0, 0) if unparseable."""
    lines = [l for l in output.strip().splitlines() if l.strip()]
    if len(lines) < 2:
        return 0, 0
    parts = lines[-1].split()
    # Filesystem 1K-blocks Used Available Use% Mounted
    nums = [p for p in parts if p.isdigit()]
    if len(nums) >= 3:
        total, _used, avail = int(nums[0]), int(nums[1]), int(nums[2])
        return total * 1024, avail * 1024
    return 0, 0


class DeviceManager:
    def __init__(self, runner: AdbRunner):
        self.runner = runner

    def list_devices(self) -> list[Device]:
        r = self.runner.run("devices", "-l", use_serial=False, timeout=20, action="list devices")
        if not r.ok:
            return []
        return parse_devices(r.stdout)

    def get_info(self, serial: str) -> DeviceInfo:
        info = DeviceInfo(serial=serial)
        r = self.runner.shell("getprop", serial=serial, timeout=20, action="getprop")
        if r.ok:
            p = parse_getprop(r.stdout)
            info.raw_props = p
            info.model = p.get("ro.product.model", "")
            info.manufacturer = p.get("ro.product.manufacturer", "")
            info.brand = p.get("ro.product.brand", "")
            info.android_version = p.get("ro.build.version.release", "")
            try:
                info.sdk = int(p.get("ro.build.version.sdk", "0") or 0)
            except ValueError:
                info.sdk = 0
            abilist = p.get("ro.product.cpu.abilist", "") or p.get("ro.product.cpu.abi", "")
            info.abis = [a.strip() for a in abilist.split(",") if a.strip()]
            info.build_id = p.get("ro.build.display.id", "") or p.get("ro.build.id", "")
        r = self.runner.shell("df -k /data", serial=serial, timeout=20, action="storage")
        if r.ok:
            info.storage_total, info.storage_free = parse_df(r.stdout)
        r = self.runner.shell("ip -f inet addr show wlan0", serial=serial, timeout=15, action="wifi ip")
        if r.ok:
            m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", r.stdout)
            if m:
                info.wifi_ip = m.group(1)
        return info

    def connect(self, address: str) -> AdbResult:
        if ":" not in address:
            address = f"{address}:5555"
        return self.runner.run("connect", address, use_serial=False, timeout=30, action="connect")

    def disconnect(self, address: str) -> AdbResult:
        return self.runner.run("disconnect", address, use_serial=False, timeout=15, action="disconnect")

    def enable_tcpip(self, serial: str, port: int = 5555) -> AdbResult:
        """Switch an already-authorized USB device to listen on TCP (standard `adb tcpip`)."""
        return self.runner.run("tcpip", str(port), serial=serial, timeout=20, action="tcpip")

    def restart_server(self) -> None:
        self.runner.run("kill-server", use_serial=False, timeout=15, action="kill-server")
        self.runner.run("start-server", use_serial=False, timeout=30, action="start-server")
