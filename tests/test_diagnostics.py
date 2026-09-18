from car_app_manager.adb.diagnostics import run_diagnostics, set_adb_verification


def test_diagnostics_happy_path(runner, fake):
    fake.when("version", out="Android Debug Bridge version 1.0.41\n")
    fake.when("echo ok", out="ok\n")
    fake.when("getprop", out="[ro.product.model]: [T2]\n[ro.build.version.release]: [10]\n[ro.build.version.sdk]: [29]\n[ro.product.cpu.abilist]: [arm64-v8a]\n[ro.build.type]: [user]\n")
    fake.when("df -k", out="F 1K U A U% M\n/dev/x 100000 50000 3000000 50% /data\n")
    fake.when("pm list users", out="Users:\n\tUserInfo{0:Owner:c13} running\n")
    fake.when("am get-current-user", out="0\n")
    fake.when("verifier_verify_adb_installs", out="1\n")
    fake.when("package_verifier_enable", out="null\n")
    fake.when("touch /data/local/tmp", out="writable\n")
    fake.when("pm install-create", out="Success: created install session [12]\n")
    fake.when("cmd package help", out="Package manager (package) commands:\n  install [-r ...]\n")
    fake.when("features", out="shell_v2,cmd,stat_v2,abb_exec\n")
    fake.when("pm list packages", out="package:com.android.settings\npackage:com.chery.appguard\n")
    rep = run_diagnostics(runner, "adb", progress=lambda s: None)
    keys = {i.key: i for i in rep.items}
    assert keys["pm_session"].level == "ok" and fake.called("pm install-abandon 12")
    assert keys["tmp"].level == "ok" and keys["cmd_package"].level == "ok"
    assert keys["verifier_verify_adb_installs"].level == "warn" and keys["package_verifier_enable"].level == "info"
    assert "com.chery.appguard" in keys["guards"].en
    assert rep.worst == "warn"
    text = rep.to_text("ar")
    assert "pm_session" in text and "WARN" in text


def test_diagnostics_stops_when_shell_unavailable(runner, fake):
    fake.when("version", out="Android Debug Bridge version 1.0.41\n")
    fake.when("echo ok", rc=1, err="error: device unauthorized")
    rep = run_diagnostics(runner, "adb")
    assert rep.worst == "error" and rep.items[-1].key == "shell" and len(rep.items) == 2


def test_diagnostics_session_failure_is_error(runner, fake):
    fake.when("version", out="v\n"); fake.when("echo ok", out="ok\n")
    fake.when("pm install-create", rc=1, err="Error: java.lang.SecurityException: Neither user 2000 nor current process has android.permission.INSTALL_PACKAGES")
    rep = run_diagnostics(runner, "adb")
    assert next(i for i in rep.items if i.key == "pm_session").level == "error"


def test_set_verification(runner, fake):
    set_adb_verification(runner, False)
    assert fake.called("settings put global verifier_verify_adb_installs 0") and fake.called("settings put global package_verifier_enable 0")
    set_adb_verification(runner, True)
    assert fake.called("settings put global verifier_verify_adb_installs 1")
