"""Crash doctor, APK risk explainer, chat help."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional

from ..adb.logcat import find_pid
from ..adb.runner import AdbRunner
from ..apk.inspector import ApkInfo
from .client import AIResponse, AIService
from .prompts import chat_system, crash_doctor_system, risk_explainer_system, wrap_untrusted

DIAGNOSIS_TOOL = {
    "name": "report_diagnosis", "description": "Report the crash diagnosis.", "strict": True,
    "input_schema": {"type": "object", "properties": {
        "likely_cause": {"type": "string"},
        "evidence": {"type": "string", "description": "The log lines or facts the diagnosis rests on"},
        "fix_steps": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
    }, "required": ["likely_cause", "evidence", "fix_steps", "confidence"], "additionalProperties": False},
}

RISK_TOOL = {
    "name": "report_risk", "description": "Report the plain-language risk assessment.", "strict": True,
    "input_schema": {"type": "object", "properties": {
        "summary": {"type": "string"},
        "notable_permissions": {"type": "array", "items": {"type": "object", "properties": {
            "permission": {"type": "string"}, "why_it_matters": {"type": "string"}},
            "required": ["permission", "why_it_matters"], "additionalProperties": False}},
        "compatibility_notes": {"type": "array", "items": {"type": "string"}},
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "recommendation": {"type": "string"},
    }, "required": ["summary", "notable_permissions", "compatibility_notes", "risk_level", "recommendation"], "additionalProperties": False},
}


@dataclass
class Diagnosis:
    likely_cause: str = ""
    evidence: str = ""
    fix_steps: list[str] = field(default_factory=list)
    confidence: str = "low"
    raw_text: str = ""
    response: Optional[AIResponse] = None


@dataclass
class RiskReport:
    summary: str = ""
    notable_permissions: list[dict] = field(default_factory=list)
    compatibility_notes: list[str] = field(default_factory=list)
    risk_level: str = "medium"
    recommendation: str = ""
    raw_text: str = ""
    response: Optional[AIResponse] = None


def collect_logcat(runner: AdbRunner, package: str, max_lines: int = 400) -> tuple[str, int]:
    """Dump recent log lines for a package: crash buffer + main buffer (by pid if running, else by name)."""
    lines: list[str] = []
    r = runner.shell("logcat -b crash -d -v threadtime", action="logcat crash dump", timeout=60)
    if r.ok:
        crash = [l for l in r.stdout.splitlines() if not package or package in l or "AndroidRuntime" in l or "FATAL" in l]
        lines += crash[-max_lines:]
    pid = find_pid(runner, package) if package else None
    if pid:
        r = runner.shell(f"logcat -d -v threadtime --pid={pid} -t {max_lines}", action="logcat dump", timeout=60)
        if r.ok:
            lines += r.stdout.splitlines()
    else:
        r = runner.shell(f"logcat -d -v threadtime -t {max(max_lines * 5, 1000)}", action="logcat dump", timeout=60)
        if r.ok:
            lines += [l for l in r.stdout.splitlines() if not package or package in l]
    seen: set[str] = set()
    uniq = []
    for l in lines:
        if l not in seen:
            seen.add(l)
            uniq.append(l)
    uniq = uniq[-max_lines:]
    return "\n".join(uniq), len(uniq)


def crash_doctor(ai: AIService, package: str, logcat_text: str, lang: str, model: str, device_desc: str = "") -> Diagnosis:
    user = f"Package: {package}\nDevice: {device_desc}\n\n" + wrap_untrusted("Filtered logcat", logcat_text or "(empty)")
    resp = ai.complete(system=crash_doctor_system(lang), messages=[{"role": "user", "content": user}], model=model,
                       feature="crash_doctor", tools=[DIAGNOSIS_TOOL])
    d = Diagnosis(raw_text=resp.text, response=resp)
    for call in resp.tool_calls:
        if call.name == "report_diagnosis":
            d.likely_cause = str(call.input.get("likely_cause", ""))
            d.evidence = str(call.input.get("evidence", ""))
            d.fix_steps = [str(s) for s in call.input.get("fix_steps", [])]
            d.confidence = str(call.input.get("confidence", "low"))
            break
    return d


def manifest_summary(info: ApkInfo) -> str:
    """Only manifest-level facts are sent - never the binary or code."""
    data = {
        "package": info.package, "label": info.label, "version": f"{info.version_name} ({info.version_code})",
        "min_sdk": info.min_sdk, "target_sdk": info.target_sdk, "native_abis": info.native_abis,
        "permissions": info.permissions, "dangerous_permissions": info.dangerous_permissions,
        "services": info.services[:40], "receivers": info.receivers[:40], "providers": info.providers[:20],
        "activities_count": len(info.activities), "features": info.features, "signed": info.signed, "sha256": info.sha256,
    }
    return json.dumps(data, ensure_ascii=False, indent=1)


def risk_explainer(ai: AIService, info: ApkInfo, lang: str, model: str, purpose: str = "") -> RiskReport:
    user = (f"Stated purpose of the app (from the user, may be empty): {purpose or '(not given)'}\n\n"
            + wrap_untrusted("Manifest summary (JSON)", manifest_summary(info)))
    resp = ai.complete(system=risk_explainer_system(lang), messages=[{"role": "user", "content": user}], model=model,
                       feature="risk_explainer", tools=[RISK_TOOL])
    rep = RiskReport(raw_text=resp.text, response=resp)
    for call in resp.tool_calls:
        if call.name == "report_risk":
            i = call.input
            rep.summary = str(i.get("summary", ""))
            rep.notable_permissions = [dict(p) for p in i.get("notable_permissions", []) if isinstance(p, dict)]
            rep.compatibility_notes = [str(s) for s in i.get("compatibility_notes", [])]
            rep.risk_level = str(i.get("risk_level", "medium"))
            rep.recommendation = str(i.get("recommendation", ""))
            break
    return rep


def chat(ai: AIService, history: list[dict], lang: str, model: str) -> AIResponse:
    return ai.complete(system=chat_system(lang), messages=history, model=model, feature="chat")
