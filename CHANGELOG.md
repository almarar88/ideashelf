# Changelog

All notable changes to Car App Manager are documented here.

## [0.2.0] - Phase 2 (remote control)
### Added
- Screen page with three tabs:
  - **Mirror**: scrcpy launcher (window title, max size, bit rate, FPS, always-on-top, no-audio default for Android 10, optional MP4 recording). scrcpy is located from Settings / PATH or downloaded on demand from the official GitHub release (win64 zip, Apache-2.0) into `%LOCALAPPDATA%\CarAppManager\tools\scrcpy`. It shares the app's adb via the `ADB` env var.
  - **Screenshot**: `adb exec-out screencap -p`, saved as timestamped PNG, preview, copy to clipboard.
  - **Live logcat**: `-v threadtime` stream in a background thread, filter by package (via `pidof` + `--pid`), minimum level, free text; colour by level; clear device buffer; save to file.
- Wireless ADB helper dialog on the Device page: checks for an authorized USB device, reads the Wi-Fi IP, runs `adb tcpip 5555`, connects and remembers the address.
- Settings: scrcpy path and screenshots folder.
- Tests for logcat parsing / filtering / args, screenshot capture (incl. CRLF repair), scrcpy asset selection and command line, plus a headless GUI test that streams a fake logcat and captures a screenshot.

## [0.1.0] - Phase 1 (core)
### Added
- Project skeleton: `src/car_app_manager`, `tests/`, `build.bat`, PyInstaller spec, Inno Setup script, icon generator.
- ADB layer: subprocess runner with per-command logging, `adb devices -l` parsing (device / unauthorized / offline / no permissions), device info (getprop, df, Wi-Fi IP), `adb connect` / `disconnect` / `tcpip`, restart server.
- Protection blocklist: system packages (`pm list packages -s`) and vendor prefixes (`com.chery`, `com.jetour`, `com.qualcomm`, `android.`, `com.android.`) are read-only; enforced in the package layer, not only in the UI.
- Apps: list user apps (version, size, APK paths), launch, force stop, clear data, uninstall, export APK (base + splits).
- Install: single / batch APK, `.apks` / `.xapk` / `.apkm` bundles via `install-multiple` with ABI-aware split selection and OBB push; drag & drop; pre-install checks (minSdk, ABI, dangerous permissions, signature, update / same / downgrade detection); SHA-256; `INSTALL_FAILED_*` / `DELETE_FAILED_*` codes mapped to Arabic + English explanations.
- Backup: dated folder with `apps.json` + APKs; selective restore.
- Restore to original: uninstalls only apps tracked as installed by this program (SQLite), two-step confirmation.
- Logs page backed by SQLite with search and export; rotating text log in `%LOCALAPPDATA%\CarAppManager\logs`.
- Settings: language (ar/en, live switch, RTL), adb path, official Platform-Tools download, auto-refresh, backups folder, destructive-action confirmation toggle.
- First-run dialog to download Platform-Tools or locate `adb.exe`.
- `--version` and `--inspect <apk>` CLI helpers.
- Test suite: 48 pytest tests with a scriptable fake adb executor plus a headless (offscreen) GUI smoke test.

### Planned
- Phase 3: curated JSON app catalog, optional VirusTotal hash lookup.
- Phase 4: Claude API features (crash doctor, APK risk explainer, natural-language planner with tool allowlist, chat help), keyring-stored API key, spend cap.
