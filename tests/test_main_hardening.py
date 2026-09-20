import sys

from car_app_manager import main as m


def test_harden_stdio_replaces_none_streams(monkeypatch, tmp_path):
    monkeypatch.setenv("CAR_APP_MANAGER_HOME", str(tmp_path / "home"))
    monkeypatch.setattr(sys, "stdout", None)
    monkeypatch.setattr(sys, "stderr", None)
    m.harden_stdio()
    assert sys.stdout is not None and sys.stderr is not None
    sys.stderr.write("hello from a windowed build\n")
    sys.stderr.flush()
    log = (tmp_path / "home" / "logs" / "stdio.log").read_text(encoding="utf-8")
    assert "hello from a windowed build" in log


def test_harden_stdio_is_noop_with_real_streams():
    before = (sys.stdout, sys.stderr)
    m.harden_stdio()
    assert (sys.stdout, sys.stderr) == before


def test_excepthook_logs(monkeypatch, tmp_path, caplog):
    monkeypatch.setenv("CAR_APP_MANAGER_HOME", str(tmp_path / "home"))
    m.install_excepthook()
    try:
        with caplog.at_level("ERROR"):
            try:
                raise ValueError("boom")
            except ValueError:
                sys.excepthook(*sys.exc_info())
        assert "boom" in caplog.text and "uncaught exception" in caplog.text
    finally:
        sys.excepthook = sys.__excepthook__
