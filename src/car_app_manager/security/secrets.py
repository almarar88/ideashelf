"""API keys live in the OS credential store (Windows Credential Manager via `keyring`), never on disk in clear."""
from __future__ import annotations

import logging
from typing import Optional

log = logging.getLogger(__name__)
SERVICE = "CarAppManager"

_memory: dict[str, str] = {}  # fallback only when no keyring backend exists (e.g. headless CI)


_forced = False


def _force_windows_backend() -> None:
    """In a PyInstaller build entry-point discovery can miss the WinVault backend; select it explicitly."""
    global _forced
    if _forced:
        return
    _forced = True
    import sys
    if sys.platform != "win32":
        return
    try:
        import keyring
        from keyring.backends.Windows import WinVaultKeyring
        keyring.set_keyring(WinVaultKeyring())
    except Exception as e:  # pragma: no cover
        log.warning("could not select WinVault keyring: %s", e)


def _backend_ok() -> bool:
    try:
        _force_windows_backend()
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
