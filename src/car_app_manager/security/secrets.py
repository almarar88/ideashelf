"""API keys live in the OS credential store (Windows Credential Manager via `keyring`), never on disk in clear."""
from __future__ import annotations

import logging
from typing import Optional

log = logging.getLogger(__name__)
SERVICE = "CarAppManager"

_memory: dict[str, str] = {}  # fallback only when no keyring backend exists (e.g. headless CI)


def _backend_ok() -> bool:
    try:
        import keyring
        from keyring.backends.fail import Keyring as Fail
        from keyring.backends.null import Keyring as Null
        return not isinstance(keyring.get_keyring(), (Fail, Null))
    except Exception:
        return False


def get_secret(name: str) -> str:
    if _backend_ok():
        try:
            import keyring
            return keyring.get_password(SERVICE, name) or ""
        except Exception as e:  # pragma: no cover
            log.warning("keyring read failed: %s", e)
    return _memory.get(name, "")


def set_secret(name: str, value: str) -> bool:
    """Returns True if stored persistently (keyring), False if only kept in memory for this session."""
    if _backend_ok():
        try:
            import keyring
            if value:
                keyring.set_password(SERVICE, name, value)
            else:
                try:
                    keyring.delete_password(SERVICE, name)
                except Exception:
                    pass
            _memory.pop(name, None)
            return True
        except Exception as e:  # pragma: no cover
            log.warning("keyring write failed: %s", e)
    if value:
        _memory[name] = value
    else:
        _memory.pop(name, None)
    return False


def persistent_available() -> bool:
    return _backend_ok()
