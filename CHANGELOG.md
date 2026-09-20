# Changelog

All notable changes to Car App Manager are documented here.

## [0.6.0] - Robustness & support
### Fixed
- API keys are stored through an explicitly selected Windows Credential Manager backend, so the frozen build cannot silently fall back to session-only storage.
- Resource lookup inside the frozen build checks the bundled path first.
### Added
- **Support bundle** (Logs page): one zip with the action log, text logs, settings (no secrets), device info and a fresh diagnostics report, to attach when asking for help.
- **Check for updates** (Settings → About): compares the build sha embedded by CI with the published release and links to the download page.
- App list loads with two device calls instead of two per app (`pm list packages -3 -f` + one filtered `dumpsys package packages`), falling back per app when needed.
- APK / bundle paths on the command line open the Install page (drag files onto the exe, or "Open with").
- Clearer guidance when no device is found (cable/port, USB driver in Device Manager, wireless alternative).
- CI now runs the built exe on the native Windows platform (not offscreen), verifies the main window started, and verifies the frozen androguard parses a real APK.

## [0.5.0] - Install reliability & diagnostics
### Fixed
- Pressing Install while files were still being checked was silently ignored. The install now waits for the checks and starts automatically.
- The adb server is started once, detached, at startup so no captured call can block on a freshly spawned daemon (Windows).
### Added
- **Install engine v2** with automatic fallback: streamed `adb install` first, then compatibility mode (`adb push` to `/data/local/tmp` or `/sdcard/Download` + `pm install`; a `pm install-create/write/commit` session for split bundles). Definitive errors (wrong SDK/ABI/signature/space, …) are not retried. `-t` (allow test packages) is on by default. Method selectable: auto / streamed / compatibility.
- **Post-install verification**: after a reported success the package is looked up with `pm path`; a missing package is reported as `NOT_FOUND_AFTER_INSTALL` (typical of guard apps on head units).
- **Failure dialog** for every failed file: cause in Arabic/English, a concrete next step per error code (e.g. watch the car screen for a confirmation prompt, disable ADB install verification, use compatibility mode), and the exact commands with the device output; one-click copy of the report.
- **Diagnostics dialog** (Device page): adb, shell access, build info, free space, users, `verifier_verify_adb_installs` / `package_verifier_enable`, temp dir writability, package-manager session test, `cmd package` availability, adb features, and a scan for guard/protection packages. Export report. Reversible **Disable / Re-enable ADB install verification** buttons (global settings only, no system app touched, explicit confirmation, logged).
- "Launch installed app" button after a successful install plus a note that some head-unit launchers hide sideloaded apps.
- Apps page: multi-select with batch uninstall (protected packages are skipped) and batch export; catalog names used as labels.
- Tests: fallback path, definitive-error no-retry, sdcard push fallback, verification failure, split sessions (commit and abandon), diagnostics report, GUI tests for the pending install, failure dialog, diagnostics dialog and batch uninstall (92 tests).

## [0.4.0] - Phase 4 (AI features, Claude API)
### Added
- **AI Assistant page** (official `anthropic` Python SDK, the user's own key stored in Windows Credential Manager via `keyring`; never written to disk, logs or the repo):
  - **Crash doctor**: collects the crash buffer + recent logcat for one package (by pid when running), sends it as untrusted data, returns likely cause, evidence, fix steps and a confidence level in Arabic or English (typed result via a strict tool schema).
  - **APK risk explainer**: sends only a manifest summary (permissions, components, SDK levels, ABIs, SHA-256; never the binary) and returns a plain-language risk assessment with notable permissions, compatibility notes and a recommendation.
  - **Natural-language assistant**: the model may only propose calls to the allowlist `list_apps`, `install_apk`, `backup`, `launch_app`, `screenshot`, `get_logcat` (strict schemas). Every step is validated locally (absolute existing APK paths, sane package names, capped line counts); anything else is shown as rejected. Nothing runs until the user approves the plan in a confirmation dialog; execution and results are logged.
  - **Chat help** about ADB and this tool, in the UI language.
- Default models: `claude-haiku-4-5-20251001` for cheap tasks (doctor, risk, chat) and `claude-sonnet-5` for planning; both editable in Settings. Model IDs verified against the current Claude API reference.
- **Monthly spend cap** and **per-request output token limit** in Settings; every call records tokens and estimated cost (SQLite), the page shows this month's usage, and a request that would exceed the cap is refused before it is sent. "Test key" lists the models the key can see.
- Every prompt wraps device output / APK data in `<untrusted_data>` tags with instructions to treat it as data only; refusals (`stop_reason: refusal`) are surfaced to the user.
- Tests: pricing table, usage recording, spend cap, key/error translation, allowlist validation, folder listing for the planner, prompt safety framing, diagnosis/risk parsing, logcat collection, refusal handling, and a GUI test that plans and executes against the fake adb with a mocked model.

## [0.3.0] - Phase 3 (curated catalog, VirusTotal, hashes)
### Added
- **Catalog tab** (Install page): local, user-editable JSON catalog (`%LOCALAPPDATA%\CarAppManager\catalog.json`, seeded from a bundled list of well-known apps with official source links). Fields: name, package, category, Arabic/English description, source URL, "tested on T2" flag, notes, optional SHA-256. Add / edit / delete / toggle tested, import & export JSON, open source page, direct download of `.apk`/`.xapk`/`.apks` links straight into the install list. Shows which catalog apps are currently installed.
- **VirusTotal** (optional, off by default): the user's own API key is stored in Windows Credential Manager through `keyring` (session-only fallback when no store exists). Only the SHA-256 is sent, never the file. Results show in a new column and in the details pane with a link to the report. A file flagged malicious asks for explicit confirmation before install; nothing is blocked silently. Manual "Check VirusTotal" button, "Test key" in Settings.
- **SHA-256** is computed for every APK / bundle (install list details, tracked installs, and now per-file in backup manifests).
- Tests: catalog persistence / import / export, VirusTotal response parsing and HTTP status handling, secret storage with and without a keyring backend, GUI test for the catalog tab and the VirusTotal column.

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

