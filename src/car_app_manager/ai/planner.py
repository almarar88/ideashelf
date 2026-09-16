"""Natural-language assistant: the model may only propose calls to an allowlist of tools; the user approves; we execute."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from ..apk.bundle import APK_EXTENSIONS
from .client import AIResponse, AIService, ToolCall
from .prompts import planner_system

ALLOWED_TOOLS: list[dict] = [
    {"name": "list_apps", "description": "List the user-installed apps on the car head unit (package, version, size).",
     "strict": True, "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
    {"name": "install_apk", "description": "Install one APK / split bundle file from the PC. Path must be an absolute local file path.",
     "strict": True, "input_schema": {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute path of a .apk/.apks/.xapk/.apkm file"}},
                                       "required": ["path"], "additionalProperties": False}},
    {"name": "backup", "description": "Back up all user-installed apps (list + APK files) to the backups folder.",
     "strict": True, "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
    {"name": "launch_app", "description": "Launch an installed app by package name.",
     "strict": True, "input_schema": {"type": "object", "properties": {"package": {"type": "string"}}, "required": ["package"], "additionalProperties": False}},
    {"name": "screenshot", "description": "Capture a screenshot of the car screen and save it as PNG.",
     "strict": True, "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
    {"name": "get_logcat", "description": "Dump recent logcat lines, optionally filtered to one package.",
     "strict": True, "input_schema": {"type": "object", "properties": {"package": {"type": "string", "description": "Package name or empty for all"},
                                                                         "lines": {"type": "integer", "description": "Number of lines (max 2000)"}},
                                       "required": ["package", "lines"], "additionalProperties": False}},
]
ALLOWED_NAMES = [t["name"] for t in ALLOWED_TOOLS]


@dataclass
class PlanStep:
    tool: str
    args: dict
    allowed: bool = True
    reason: str = ""  # why rejected
    status: str = "pending"  # pending | running | done | failed | skipped
    result: str = ""

    def describe(self, lang: str) -> str:
        a = self.args
        d = {
            "list_apps": ("عرض قائمة التطبيقات", "List installed apps"),
            "install_apk": (f"تثبيت {a.get('path', '')}", f"Install {a.get('path', '')}"),
            "backup": ("نسخ احتياطي لكل تطبيقات المستخدم", "Back up all user apps"),
            "launch_app": (f"تشغيل {a.get('package', '')}", f"Launch {a.get('package', '')}"),
            "screenshot": ("التقاط لقطة شاشة", "Take a screenshot"),
            "get_logcat": (f"قراءة logcat ({a.get('lines', '')} سطر، {a.get('package') or 'الكل'})", f"Read logcat ({a.get('lines', '')} lines, {a.get('package') or 'all'})"),
        }.get(self.tool, (f"{self.tool} {a}", f"{self.tool} {a}"))
        return d[0] if lang == "ar" else d[1]


@dataclass
class Plan:
    steps: list[PlanStep] = field(default_factory=list)
    explanation: str = ""
    refusal: str = ""

    @property
    def executable(self) -> list[PlanStep]:
        return [s for s in self.steps if s.allowed]


def expand_folder_paths(text: str) -> str:
    """No-op hook kept for clarity: the model receives folder listings we add to the prompt, not the other way round."""
    return text


def validate_step(call: ToolCall) -> PlanStep:
    step = PlanStep(tool=call.name, args=dict(call.input))
    if call.name not in ALLOWED_NAMES:
        step.allowed, step.reason = False, "tool not in allowlist"
        return step
    if call.name == "install_apk":
        p = str(step.args.get("path", ""))
        if not p or not os.path.isabs(p) or not p.lower().endswith(APK_EXTENSIONS):
            step.allowed, step.reason = False, "path must be an absolute .apk/.apks/.xapk/.apkm file"
        elif not os.path.isfile(p):
            step.allowed, step.reason = False, "file does not exist"
    elif call.name == "launch_app":
        pkg = str(step.args.get("package", ""))
        if not pkg or any(c.isspace() for c in pkg) or ";" in pkg or "|" in pkg or "&" in pkg:
            step.allowed, step.reason = False, "invalid package name"
    elif call.name == "get_logcat":
        try:
            n = int(step.args.get("lines", 200))
        except (TypeError, ValueError):
            n = 200
        step.args["lines"] = max(10, min(2000, n))
        pkg = str(step.args.get("package", "") or "")
        if any(c.isspace() for c in pkg) or ";" in pkg or "|" in pkg:
            step.allowed, step.reason = False, "invalid package name"
    return step


def parse_plan(resp: AIResponse) -> Plan:
    plan = Plan(explanation=resp.text.strip(), refusal=resp.refusal)
    for call in resp.tool_calls:
        plan.steps.append(validate_step(call))
    return plan


def folder_context(paths: list[str]) -> str:
    """List APK files in folders the user mentions so the model can reference real absolute paths."""
    lines = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            for f in sorted(pp.iterdir()):
                if f.suffix.lower() in APK_EXTENSIONS:
                    lines.append(str(f.resolve()))
        elif pp.is_file() and pp.suffix.lower() in APK_EXTENSIONS:
            lines.append(str(pp.resolve()))
    return "\n".join(lines)


def make_plan(ai: AIService, request: str, lang: str, model: str, extra_paths: Optional[list[str]] = None) -> Plan:
    user = request.strip()
    listing = folder_context(extra_paths or [])
    if listing:
        user += "\n\nAPK files available on this PC (absolute paths):\n" + listing
    resp = ai.complete(system=planner_system(lang, ALLOWED_NAMES), messages=[{"role": "user", "content": user}],
                       model=model, feature="assistant_plan", tools=ALLOWED_TOOLS)
    return parse_plan(resp)


class PlanExecutor:
    """Executes approved steps with the app context. Called from a worker thread."""

    def __init__(self, ctx):
        self.ctx = ctx

    def run(self, plan: Plan, progress: Optional[Callable[[object], None]] = None) -> Plan:
        from ..adb.screen import take_screenshot
        from ..backup import create_backup
        from .features import collect_logcat
        for i, step in enumerate(plan.steps):
            if not step.allowed:
                step.status = "skipped"
                continue
            step.status = "running"
            if progress:
                progress(("step", i, step))
            try:
                if step.tool == "list_apps":
                    apps = self.ctx.pm.list_user_apps()
                    step.result = "\n".join(f"{a.package} {a.version_name}" for a in apps)
                elif step.tool == "install_apk":
                    r = self.ctx.installer().install(step.args["path"])
                    step.result = r.message("en")
                    if r.success and r.package:
                        self.ctx.db.track_install(r.package, source_path=step.args["path"], device=self.ctx.runner.serial or "")
                    if not r.success:
                        raise RuntimeError(step.result)
                elif step.tool == "backup":
                    apps = [a for a in self.ctx.pm.list_user_apps() if not a.protected]
                    b = create_backup(self.ctx.pm, self.ctx.settings.backups_dir, apps, self.ctx.runner.serial or "")
                    step.result = str(b.folder)
                elif step.tool == "launch_app":
                    r = self.ctx.pm.launch(step.args["package"])
                    step.result = r.output or "ok"
                    if not r.ok:
                        raise RuntimeError(step.result)
                elif step.tool == "screenshot":
                    step.result = str(take_screenshot(self.ctx.runner, self.ctx.settings.screenshots_dir))
                elif step.tool == "get_logcat":
                    text, n = collect_logcat(self.ctx.runner, step.args.get("package", ""), int(step.args.get("lines", 200)))
                    step.result = text
                step.status = "done"
            except Exception as e:  # noqa: BLE001
                step.status = "failed"
                step.result = str(e)
            self.ctx.logger.note(f"assistant step {step.tool}", step.result[:500], success=step.status == "done",
                                 device=self.ctx.runner.serial or "")
            if progress:
                progress(("step", i, step))
        return plan
