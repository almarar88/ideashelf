from car_app_manager.adb.runner import AdbRunner, RC_ADB_NOT_FOUND, RC_TIMEOUT
from car_app_manager.adb.errors import parse_failure, explain, classify_device_error
import subprocess


def test_runner_adds_serial(runner, fake):
    r = runner.run("shell", "echo hi")
    assert fake.calls[0] == ["adb", "-s", "TESTSERIAL", "shell", "echo hi"]
    assert r.ok


def test_runner_no_serial_flag_when_disabled(runner, fake):
    runner.run("devices", "-l", use_serial=False)
    assert fake.calls[0] == ["adb", "devices", "-l"]


def test_runner_missing_adb():
    def boom(args, timeout):
        raise FileNotFoundError()
    r = AdbRunner("nope", executor=boom).run("version")
    assert r.returncode == RC_ADB_NOT_FOUND and "not found" in r.stderr


def test_runner_timeout():
    def slow(args, timeout):
        raise subprocess.TimeoutExpired(args, timeout)
    r = AdbRunner("adb", executor=slow).run("shell", "sleep")
    assert r.returncode == RC_TIMEOUT


def test_runner_calls_listener(fake):
    seen = []
    r = AdbRunner("adb", executor=fake, on_result=seen.append)
    r.run("version")
    assert len(seen) == 1 and seen[0].command == "adb version"


def test_parse_install_failure_codes():
    e = parse_failure("Performing Streamed Install\nadb: failed to install x.apk: Failure [INSTALL_FAILED_OLDER_SDK: ...]")
    assert e.code == "INSTALL_FAILED_OLDER_SDK"
    assert "أندرويد" in e.ar and "newer Android" in e.en


def test_parse_unknown_install_code_still_reported():
    e = parse_failure("Failure [INSTALL_FAILED_SOMETHING_NEW]")
    assert e.code == "INSTALL_FAILED_SOMETHING_NEW"
    assert "INSTALL_FAILED_SOMETHING_NEW" in e.en


def test_device_errors():
    assert classify_device_error("error: device unauthorized.").code == "unauthorized"
    assert classify_device_error("error: no devices/emulators found").code == "no_device"
    assert classify_device_error("error: device offline").code == "offline"
    assert classify_device_error("adb: more than one device/emulator").code == "multiple"
    assert classify_device_error("all good") is None


def test_explain_lang():
    out = "Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]"
    assert "مساحة" in explain(out, "ar")
    assert "storage" in explain(out, "en")
    assert explain("plain text", "en") == "plain text"
