"""VirusTotal v3 hash lookup. Only the SHA-256 is sent; the APK itself is never uploaded."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Optional

API_URL = "https://www.virustotal.com/api/v3/files/{sha256}"
GUI_URL = "https://www.virustotal.com/gui/file/{sha256}"


@dataclass
class VTResult:
    sha256: str
    status: str  # found | not_found | invalid_key | quota | error
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0
    total: int = 0
    scan_date: str = ""
    names: list[str] = field(default_factory=list)
    message: str = ""

    @property
    def permalink(self) -> str:
        return GUI_URL.format(sha256=self.sha256)

    @property
    def level(self) -> str:
        if self.status != "found":
            return "warn" if self.status in ("not_found", "quota") else "error"
        if self.malicious > 0:
            return "error"
        if self.suspicious > 0:
            return "warn"
        return "ok"

    def summary(self, lang: str) -> str:
        if self.status == "found":
            if lang == "ar":
                return f"VirusTotal: {self.malicious} ضار، {self.suspicious} مشبوه من أصل {self.total} محرك"
            return f"VirusTotal: {self.malicious} malicious, {self.suspicious} suspicious of {self.total} engines"
        msgs = {
            "not_found": ("VirusTotal: الملف غير معروف (لم يُرفع من قبل). هذا لا يعني أنه آمن.",
                          "VirusTotal: file unknown (never uploaded). This does not mean it is safe."),
            "invalid_key": ("VirusTotal: مفتاح API غير صالح.", "VirusTotal: invalid API key."),
            "quota": ("VirusTotal: تجاوزت حصة الطلبات، حاول لاحقاً.", "VirusTotal: request quota exceeded, try later."),
            "error": ("VirusTotal: خطأ - " + self.message, "VirusTotal: error - " + self.message),
        }
        ar, en = msgs.get(self.status, ("", ""))
        return ar if lang == "ar" else en


def parse_response(sha256: str, data: dict) -> VTResult:
    attrs = data.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {}) or {}
    r = VTResult(sha256=sha256, status="found",
                 malicious=int(stats.get("malicious", 0)), suspicious=int(stats.get("suspicious", 0)),
                 harmless=int(stats.get("harmless", 0)), undetected=int(stats.get("undetected", 0)))
    r.total = r.malicious + r.suspicious + r.harmless + r.undetected
    ts = attrs.get("last_analysis_date")
    if ts:
        from datetime import datetime
        r.scan_date = datetime.utcfromtimestamp(int(ts)).strftime("%Y-%m-%d")
    r.names = [str(n) for n in (attrs.get("names") or [])[:5]]
    return r


def lookup(sha256: str, api_key: str, timeout: float = 30.0, opener=None) -> VTResult:
    if not api_key:
        return VTResult(sha256, "invalid_key")
    req = urllib.request.Request(API_URL.format(sha256=sha256), headers={"x-apikey": api_key, "User-Agent": "CarAppManager/1.0"})
    try:
        open_fn = opener or (lambda r: urllib.request.urlopen(r, timeout=timeout, context=ssl.create_default_context()))
        with open_fn(req) as resp:
            return parse_response(sha256, json.loads(resp.read().decode("utf-8")))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return VTResult(sha256, "not_found")
        if e.code in (401, 403):
            return VTResult(sha256, "invalid_key")
        if e.code == 429:
            return VTResult(sha256, "quota")
        return VTResult(sha256, "error", message=f"HTTP {e.code}")
    except Exception as e:  # network, json
        return VTResult(sha256, "error", message=str(e))
