"""Check the GitHub release that CI publishes for a newer build (compares the commit sha embedded at build time)."""
from __future__ import annotations

import json
import re
import ssl
import urllib.request
from dataclasses import dataclass

from .support import build_info

RELEASE_API = "https://api.github.com/repos/almarar88/ideashelf/releases/tags/car-app-manager-latest"
RELEASE_PAGE = "https://github.com/almarar88/ideashelf/releases/tag/car-app-manager-latest"
_SHA_RE = re.compile(r"\b([0-9a-f]{40})\b")


@dataclass
class UpdateInfo:
    available: bool
    current_sha: str
    latest_sha: str
    published: str
    url: str = RELEASE_PAGE


def parse_release(data: dict, current_sha: str) -> UpdateInfo:
    body = str(data.get("body", ""))
    m = _SHA_RE.search(body)
    latest = m.group(1) if m else ""
    published = ""
    for a in data.get("assets", []) or []:
        published = max(published, str(a.get("updated_at", "")))
    available = bool(latest) and bool(current_sha) and not latest.startswith(current_sha[:12])
    return UpdateInfo(available=available, current_sha=current_sha, latest_sha=latest, published=published,
                      url=str(data.get("html_url") or RELEASE_PAGE))


def check_for_update(opener=None) -> UpdateInfo:
    current = str(build_info().get("sha", ""))
    req = urllib.request.Request(RELEASE_API, headers={"User-Agent": "CarAppManager/1.0", "Accept": "application/vnd.github+json"})
    open_fn = opener or (lambda r: urllib.request.urlopen(r, timeout=20, context=ssl.create_default_context()))
    with open_fn(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return parse_release(data, current)
