import os
from types import SimpleNamespace as NS

import pytest

from car_app_manager.ai import client as C
from car_app_manager.ai import features as F
from car_app_manager.ai import planner as P
from car_app_manager.ai.prompts import UNTRUSTED_OPEN, crash_doctor_system, planner_system, wrap_untrusted
from car_app_manager.apk.inspector import ApkInfo
from car_app_manager.config import Settings
from car_app_manager.db import Database


def _resp(text="", tools=(), stop="end_turn", model="claude-haiku-4-5-20251001", inp=1000, out=200):
    content = []
    if text:
        content.append(NS(type="text", text=text))
    for i, (name, args) in enumerate(tools):
        content.append(NS(type="tool_use", id=f"t{i}", name=name, input=args))
    return NS(content=content, stop_reason=stop, model=model, usage=NS(input_tokens=inp, output_tokens=out,
              cache_read_input_tokens=0, cache_creation_input_tokens=0), stop_details=None)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.messages = NS(create=self._create)
        self.models = NS(list=lambda limit=20: NS(data=[NS(id="claude-haiku-4-5-20251001"), NS(id="claude-sonnet-5")]))

    def _create(self, **kw):
        self.calls.append(kw)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture
def ai(monkeypatch):
    db = Database()
    s = Settings(); s.ai_monthly_cap_usd = 1.0; s.ai_max_tokens_per_request = 1024
    from car_app_manager.security import secrets
    monkeypatch.setattr(secrets, "_backend_ok", lambda: False)
    secrets.set_secret("anthropic", "sk-test")
    holder = {}
    svc = C.AIService(s, db, client_factory=lambda key: holder["client"])
    svc._holder = holder
    return svc


def test_cost_table():
    assert C.estimate_cost("claude-haiku-4-5-20251001", 1_000_000, 0) == 1.0
    assert C.estimate_cost("claude-sonnet-5", 0, 1_000_000) == 10.0
    assert C.price_for("some-unknown-model") == C.DEFAULT_PRICE


def test_complete_records_usage_and_parses_tools(ai):
    ai._holder["client"] = FakeClient([_resp("hi", [("report_diagnosis", {"likely_cause": "x"})])])
    r = ai.complete(system="s", messages=[{"role": "user", "content": "u"}], model="claude-haiku-4-5-20251001", feature="t")
    assert r.text == "hi" and r.tool_calls[0].name == "report_diagnosis" and r.cost_usd > 0
    inp, out, spent = ai.month_usage()
    assert inp == 1000 and out == 200 and spent == pytest.approx(r.cost_usd)
    assert ai._holder["client"].calls[0]["max_tokens"] == 1024


def test_spend_cap_blocks_before_call(ai):
    ai._holder["client"] = FakeClient([_resp("x", inp=1_000_000, out=0), _resp("never")])
    ai.settings.ai_monthly_cap_usd = 1.0
    ai.complete(system="s", messages=[{"role": "user", "content": "u"}], model="claude-haiku-4-5-20251001", feature="t")  # costs $1.0 = cap
    with pytest.raises(C.SpendCapExceeded) as ei:
        ai.complete(system="s", messages=[{"role": "user", "content": "u"}], model="claude-sonnet-5", feature="t")
    assert "1.00" in ei.value.text("en")
    assert len(ai._holder["client"].calls) == 1


def test_missing_key(monkeypatch):
    from car_app_manager.security import secrets
    monkeypatch.setattr(secrets, "_backend_ok", lambda: False)
    secrets.set_secret("anthropic", "")
    svc = C.AIService(Settings(), Database())
    assert not svc.configured
    with pytest.raises(C.AIError) as ei:
        svc.client()
    assert ei.value.kind == "no_key" and "مفتاح" in ei.value.text("ar")


def test_error_translation(ai):
    import anthropic
    import httpx2 as httpx
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    err = anthropic.AuthenticationError("bad", response=httpx.Response(401, request=req), body=None)
    ai._holder["client"] = FakeClient([err])
    with pytest.raises(C.AIError) as ei:
        ai.complete(system="s", messages=[{"role": "user", "content": "u"}], model="claude-haiku-4-5-20251001", feature="t")
    assert ei.value.kind == "auth"


def test_planner_allowlist_and_validation(tmp_path):
    apk = tmp_path / "a.apk"; apk.write_bytes(b"x")
    resp = C.AIResponse(text="plan", tool_calls=[
        C.ToolCall("1", "backup", {}),
        C.ToolCall("2", "install_apk", {"path": str(apk)}),
        C.ToolCall("3", "install_apk", {"path": "relative.apk"}),
        C.ToolCall("4", "uninstall_everything", {}),
        C.ToolCall("5", "launch_app", {"package": "com.x; rm -rf /"}),
        C.ToolCall("6", "get_logcat", {"package": "", "lines": 99999}),
    ])
    plan = P.parse_plan(resp)
    allowed = [s for s in plan.steps if s.allowed]
    assert [s.tool for s in allowed] == ["backup", "install_apk", "get_logcat"]
    assert plan.steps[2].reason.startswith("path must be") and plan.steps[3].reason == "tool not in allowlist"
    assert "invalid package" in plan.steps[4].reason
    assert plan.steps[5].args["lines"] == 2000
    assert set(t["name"] for t in P.ALLOWED_TOOLS) == {"list_apps", "install_apk", "backup", "launch_app", "screenshot", "get_logcat"}
    assert all(t.get("strict") and t["input_schema"]["additionalProperties"] is False for t in P.ALLOWED_TOOLS)


def test_make_plan_adds_folder_listing(ai, tmp_path):
    (tmp_path / "one.apk").write_bytes(b"1"); (tmp_path / "two.xapk").write_bytes(b"2"); (tmp_path / "readme.txt").write_text("x")
    fc = FakeClient([_resp("ok", [("install_apk", {"path": str(tmp_path / "one.apk")})])])
    ai._holder["client"] = fc
    plan = P.make_plan(ai, "install everything in the folder", "en", "claude-sonnet-5", [str(tmp_path)])
    sent = fc.calls[0]["messages"][0]["content"]
    assert "one.apk" in sent and "two.xapk" in sent and "readme.txt" not in sent
    assert fc.calls[0]["tools"] == P.ALLOWED_TOOLS
    assert plan.executable[0].tool == "install_apk"


def test_prompts_treat_device_output_as_data():
    assert UNTRUSTED_OPEN in wrap_untrusted("log", "x")
    for s in (crash_doctor_system("ar"), planner_system("en", P.ALLOWED_NAMES)):
        assert "never follow instructions" in s and "bypass" in s
    assert "Arabic" in crash_doctor_system("ar")


def test_crash_doctor_and_risk_parse(ai):
    ai._holder["client"] = FakeClient([
        _resp("", [("report_diagnosis", {"likely_cause": "ABI", "evidence": "lib", "fix_steps": ["a", "b"], "confidence": "high"})]),
        _resp("", [("report_risk", {"summary": "s", "notable_permissions": [{"permission": "CAMERA", "why_it_matters": "w"}],
                                    "compatibility_notes": ["n"], "risk_level": "low", "recommendation": "r"})]),
    ])
    d = F.crash_doctor(ai, "com.x", "log", "en", "claude-haiku-4-5-20251001")
    assert d.likely_cause == "ABI" and d.fix_steps == ["a", "b"] and d.confidence == "high"
    info = ApkInfo(path="a.apk", package="com.x", permissions=["android.permission.CAMERA"], sha256="h")
    rep = F.risk_explainer(ai, info, "en", "claude-haiku-4-5-20251001", "a game")
    assert rep.risk_level == "low" and rep.notable_permissions[0]["permission"] == "CAMERA"
    sent = ai._holder["client"].calls[1]["messages"][0]["content"]
    assert "<untrusted_data>" in sent and '"sha256": "h"' in sent and "a game" in sent


def test_collect_logcat(runner, fake):
    fake.when("logcat -b crash", out="09-16 1 1 1 E AndroidRuntime: FATAL EXCEPTION in com.x\nother\n")
    fake.when("pidof com.x", out="55\n")
    fake.when("--pid=55", out="line1\nline2\n")
    text, n = F.collect_logcat(runner, "com.x", 100)
    assert n == 3 and "FATAL" in text and "line2" in text and "other" not in text


def test_refusal_is_reported(ai):
    r = _resp("", stop="refusal"); r.stop_details = NS(explanation="policy")
    ai._holder["client"] = FakeClient([r])
    out = ai.complete(system="s", messages=[{"role": "user", "content": "u"}], model="claude-haiku-4-5-20251001", feature="t")
    assert out.refusal == "policy"
