#!/usr/bin/env python3
"""Fake adb for GUI smoke tests: simulates one authorized Jetour T2."""
import sys
a = sys.argv[1:]
if a[:2] == ["-s", "T2SERIAL"]:
    a = a[2:]
line = " ".join(a)
if a[:1] == ["version"]:
    print("Android Debug Bridge version 1.0.41\nVersion 35.0.2-fake"); sys.exit(0)
if a[:1] == ["devices"]:
    print("List of devices attached\nT2SERIAL               device usb:1-2 product:T2 model:Jetour_T2 device:t2 transport_id:3\n"); sys.exit(0)
if "getprop" in line:
    print("[ro.product.model]: [Jetour T2]\n[ro.product.manufacturer]: [Chery]\n[ro.product.brand]: [Jetour]\n[ro.build.version.release]: [10]\n[ro.build.version.sdk]: [29]\n[ro.product.cpu.abilist]: [arm64-v8a,armeabi-v7a,armeabi]\n[ro.build.display.id]: [T2.V1.2.3]"); sys.exit(0)
if "df -k" in line:
    print("Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/block/dm-4 60000000 20000000 40000000 34% /data"); sys.exit(0)
if "wlan0" in line:
    print("    inet 192.168.1.50/24 brd 192.168.1.255 scope global wlan0"); sys.exit(0)
if "pm list packages -s" in line:
    print("package:com.android.systemui\npackage:com.chery.hmi\npackage:com.oem.radio"); sys.exit(0)
if "pm list packages -3" in line:
    print("package:com.spotify.music\npackage:org.videolan.vlc\npackage:com.chery.usercfg"); sys.exit(0)
if "dumpsys package" in line:
    print("    versionCode=1000 minSdk=21 targetSdk=29\n    versionName=8.9.1\n    firstInstallTime=2024-01-01 10:00:00\n    lastUpdateTime=2024-02-01 10:00:00"); sys.exit(0)
if "pm path" in line:
    pkg = a[-1].split()[-1]
    print(f"package:/data/app/{pkg}/base.apk"); sys.exit(0)
if "stat -c" in line:
    for p in a[-1].split()[2:]:
        print(f"12345678 {p}")
    sys.exit(0)
if a[:1] == ["install"] or a[:1] == ["install-multiple"]:
    print("Performing Streamed Install\nSuccess"); sys.exit(0)
if a[:1] == ["uninstall"]:
    print("Success"); sys.exit(0)
if a[:1] == ["pull"]:
    open(a[-1], "wb").write(b"fake-apk"); print("1 file pulled"); sys.exit(0)
if a[:1] == ["connect"]:
    print(f"connected to {a[1]}"); sys.exit(0)
print("")
sys.exit(0)
