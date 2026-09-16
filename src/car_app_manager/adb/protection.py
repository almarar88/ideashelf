"""Blocklist that keeps system / vehicle packages read-only in the whole app."""
from __future__ import annotations

from typing import Iterable

PROTECTED_PREFIXES: tuple[str, ...] = (
    "com.chery",
    "com.jetour",
    "com.qualcomm",
    "android.",
    "com.android.",
)

# Extra safety: never touch these even if they are somehow reported as user apps.
PROTECTED_EXACT: frozenset[str] = frozenset({
    "android",
    "com.google.android.gms",
    "com.google.android.gsf",
    "com.google.android.webview",
})


class ProtectedPackageError(PermissionError):
    def __init__(self, package: str):
        super().__init__(f"Protected package: {package}")
        self.package = package


def matches_protected_prefix(package: str) -> bool:
    return package in PROTECTED_EXACT or any(package.startswith(p) for p in PROTECTED_PREFIXES)


def is_protected(package: str, system_packages: Iterable[str] | None = None) -> bool:
    if matches_protected_prefix(package):
        return True
    if system_packages is not None and package in set(system_packages):
        return True
    return False


def assert_modifiable(package: str, system_packages: Iterable[str] | None = None) -> None:
    if is_protected(package, system_packages):
        raise ProtectedPackageError(package)
