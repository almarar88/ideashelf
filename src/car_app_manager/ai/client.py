"""Claude API access with the user's own key (keyring), a monthly spend cap and per-request token limit."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Optional

from ..db import Database
from ..security.secrets import get_secret

log = logging.getLogger(__name__)

# USD per 1M tokens (input, output). Unknown models fall back to the Opus row (most expensive) so the cap stays safe.
PRICES: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-opus-4-6": (5.0, 25.0),
    "claude-fable-5-1": (10.0, 50.0),
    "claude-fable-5": (10.0, 50.0),
}
DEFAULT_PRICE = (10.0, 50.0)


def price_for(model: str) -> tuple[float, float]:
    for key, p in PRICES.items():
        if model == key or model.startswith(key + "-"):
            return p
    return DEFAULT_PRICE


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pi, po = price_for(model)
    return input_tokens / 1e6 * pi + output_tokens / 1e6 * po


def rough_tokens(text: str) -> int:
    """Cheap pre-flight estimate (no API call): ~3.5 chars/token is conservative for mixed Arabic/logs."""
    return int(len(text) / 3.5) + 1


class AIError(Exception):
    def __init__(self, ar: str, en: str, kind: str = "error"):
        super().__init__(en)
        self.ar, self.en, self.kind = ar, en, kind

    def text(self, lang: str) -> str:
        return self.ar if lang == "ar" else self.en


class SpendCapExceeded(AIError):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class AIResponse:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = ""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    refusal: str = ""
    raw_content: list = field(default_factory=list)


class AIService:
    """Thin wrapper over the official `anthropic` SDK. Everything here runs in worker threads."""

    def __init__(self, settings, db: Database, client_factory: Optional[Callable[[str], Any]] = None):
        self.settings = settings
        self.db = db
        self._client_factory = client_factory or self._default_factory
        self._client = None
        self._client_key = ""

    @staticmethod
    def _default_factory(api_key: str):
        import anthropic
        return anthropic.Anthropic(api_key=api_key, timeout=120.0, max_retries=2)

    # ---- key / client ------------------------------------------------------------------
    @property
    def api_key(self) -> str:
        return get_secret("anthropic")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def client(self):
        key = self.api_key
        if not key:
            raise AIError("لم يتم إدخال مفتاح Anthropic API. أضفه في الإعدادات.", "No Anthropic API key set. Add it in Settings.", "no_key")
        if self._client is None or key != self._client_key:
            self._client = self._client_factory(key)
            self._client_key = key
        return self._client

    def test_key(self) -> list[str]:
        """Returns a few model ids visible to this key (raises AIError on failure)."""
        try:
            page = self.client().models.list(limit=20)
            return [m.id for m in page.data]
        except Exception as e:  # noqa: BLE001
            raise self._translate(e) from e

    # ---- spend tracking ---------------------------------------------------------------------
    def month_usage(self) -> tuple[int, int, float]:
        now = datetime.now()
        return self.db.ai_usage_month(now.year, now.month)

    def remaining_budget(self) -> float:
        _, _, spent = self.month_usage()
        return float(self.settings.ai_monthly_cap_usd) - spent

    def check_budget(self, model: str, prompt_chars: int, max_tokens: int) -> None:
        est = estimate_cost(model, rough_tokens("x" * prompt_chars), max_tokens)
        if self.remaining_budget() - est < 0:
            _, _, spent = self.month_usage()
            raise SpendCapExceeded(
                f"تم بلوغ حد الإنفاق الشهري (${spent:.2f} من ${self.settings.ai_monthly_cap_usd:.2f}). ارفع الحد في الإعدادات.",
                f"Monthly spend cap reached (${spent:.2f} of ${self.settings.ai_monthly_cap_usd:.2f}). Raise it in Settings.",
                "cap")

    # ---- calls ------------------------------------------------------------------------------
    def complete(self, *, system: str, messages: list[dict], model: str, feature: str,
                 tools: Optional[list[dict]] = None, max_tokens: Optional[int] = None) -> AIResponse:
        max_tokens = int(max_tokens or self.settings.ai_max_tokens_per_request)
        prompt_chars = len(system) + sum(len(str(m.get("content", ""))) for m in messages) + (len(str(tools)) if tools else 0)
        self.check_budget(model, prompt_chars, max_tokens)
        kwargs: dict = dict(model=model, max_tokens=max_tokens, system=system, messages=messages)
        if tools:
            kwargs["tools"] = tools
        try:
            resp = self.client().messages.create(**kwargs)
        except Exception as e:  # noqa: BLE001
            raise self._translate(e) from e
        out = AIResponse(model=getattr(resp, "model", model), stop_reason=getattr(resp, "stop_reason", "") or "")
        for block in getattr(resp, "content", []) or []:
            btype = getattr(block, "type", "")
            if btype == "text":
                out.text += block.text
            elif btype == "tool_use":
                out.tool_calls.append(ToolCall(id=block.id, name=block.name, input=dict(block.input or {})))
        out.raw_content = list(getattr(resp, "content", []) or [])
        usage = getattr(resp, "usage", None)
        if usage is not None:
            out.input_tokens = int(getattr(usage, "input_tokens", 0) or 0) + int(getattr(usage, "cache_read_input_tokens", 0) or 0) \
                + int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
            out.output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
        out.cost_usd = estimate_cost(out.model, out.input_tokens, out.output_tokens)
        self.db.add_ai_usage(out.model, feature, out.input_tokens, out.output_tokens, out.cost_usd)
        if out.stop_reason == "refusal":
            details = getattr(resp, "stop_details", None)
            out.refusal = (getattr(details, "explanation", "") or "refused") if details else "refused"
        if out.stop_reason == "max_tokens":
            out.text += "\n[…]"
        return out

    # ---- error translation --------------------------------------------------------------------
    @staticmethod
    def _translate(e: Exception) -> AIError:
        try:
            import anthropic
        except ImportError:  # pragma: no cover
            return AIError(str(e), str(e))
        if isinstance(e, anthropic.AuthenticationError):
            return AIError("مفتاح API غير صالح.", "Invalid API key.", "auth")
        if isinstance(e, anthropic.PermissionDeniedError):
            return AIError("المفتاح لا يملك الصلاحية المطلوبة.", "The key lacks the required permission.", "auth")
        if isinstance(e, anthropic.NotFoundError):
            return AIError("اسم النموذج غير صحيح. تحقق من الإعدادات.", "Model name not found. Check Settings.", "model")
        if isinstance(e, anthropic.RateLimitError):
            return AIError("تم تجاوز حد الطلبات. حاول بعد قليل.", "Rate limited. Try again shortly.", "rate")
        if isinstance(e, anthropic.BadRequestError):
            return AIError("طلب غير صالح: " + str(getattr(e, "message", e)), "Bad request: " + str(getattr(e, "message", e)), "bad_request")
        if isinstance(e, anthropic.APIStatusError):
            return AIError(f"خطأ من الخادم ({e.status_code}).", f"Server error ({e.status_code}).", "server")
        if isinstance(e, anthropic.APIConnectionError):
            return AIError("تعذّر الاتصال بالإنترنت أو بخدمة Anthropic.", "Cannot reach the Anthropic API (network).", "network")
        return AIError(str(e), str(e))
