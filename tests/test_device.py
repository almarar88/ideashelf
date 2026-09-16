from car_app_manager.adb.device import parse_devices, parse_getprop, parse_df, DeviceManager

DEVICES_OUT = """List of devices attached
1234ABCD               device usb:1-2 product:T2 model:Jetour_T2 device:t2 transport_id:3
192.168.1.50:5555      device product:T2 model:Jetour_T2 device:t2 transport_id:5
XYZ                    unauthorized transport_id:6
OFF1                   offline transport_id:7
NOPERM                 no permissions (user in plugdev group; are your udev rules wrong?); see [http://developer.android.com/tools/device.html]
"""


def test_parse_devices():
    devs = parse_devices(DEVICES_OUT)
    assert [d.serial for d in devs] == ["1234ABCD", "192.168.1.50:5555", "XYZ", "OFF1", "NOPERM"]
    assert devs[0].model == "Jetour_T2" and devs[0].is_ready and not devs[0].is_wifi
    assert devs[1].is_wifi
    assert devs[2].state == "unauthorized"
    assert devs[3].state == "offline"
    assert devs[4].state == "no permissions"
    assert "Jetour T2" in devs[0].display_name


def test_parse_devices_empty():
    assert parse_devices("List of devices attached\n\n") == []


def test_parse_getprop_and_df():
    p = parse_getprop("[ro.build.version.sdk]: [29]\n[ro.product.cpu.abilist]: [arm64-v8a,armeabi-v7a,armeabi]\n[x]: []")
    assert p["ro.build.version.sdk"] == "29"
    assert p["x"] == ""
    total, free = parse_df("Filesystem      1K-blocks    Used Available Use% Mounted on\n/dev/block/dm-4  55000000 20000000  35000000  37% /data\n")
    assert total == 55000000 * 1024 and free == 35000000 * 1024
    assert parse_df("garbage") == (0, 0)


def test_device_info(runner, fake):
    fake.when("getprop", out="[ro.product.model]: [Jetour T2]\n[ro.build.version.release]: [10]\n[ro.build.version.sdk]: [29]\n[ro.product.cpu.abilist]: [arm64-v8a,armeabi-v7a]\n")
    fake.when("df -k", out="Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/x 100 40 60 40% /data\n")
    fake.when("wlan0", out="    inet 192.168.1.50/24 brd 192.168.1.255 scope global wlan0")
    info = DeviceManager(runner).get_info("TESTSERIAL")
    assert info.model == "Jetour T2" and info.sdk == 29 and info.abis == ["arm64-v8a", "armeabi-v7a"]
    assert info.storage_free == 60 * 1024 and info.wifi_ip == "192.168.1.50"


def test_connect_adds_default_port(runner, fake):
    DeviceManager(runner).connect("192.168.1.9")
    assert fake.calls[-1] == ["adb", "connect", "192.168.1.9:5555"]
