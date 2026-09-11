# Building the Android APK

The app ships as a real Android package: Capacitor wraps the built web app in a
native shell and **bundles the web assets inside the APK**, so the game runs
with no network at all — which matters, because the local backend and the
offline question bank need nothing but the device.

## Prerequisites

- JDK 17+ (built and verified against OpenJDK 21)
- Android SDK with `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`
- `ANDROID_HOME` pointing at the SDK, or `android/local.properties` containing
  `sdk.dir=/path/to/android-sdk`

## Debug build — installable immediately

```bash
npm install
npm run android:build          # vite build + cap sync + gradle assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Signed with the standard Android debug key, so it sideloads onto any device
with "install from unknown sources" enabled. Fine for testing; **not** for
distribution — every machine's debug key differs, so an update signed by a
different key will refuse to install over it.

## Release build — for distribution

A release APK must be signed with a key you keep. Generate one **once** and
never lose it: Play Store updates must be signed by the same key forever.

```bash
keytool -genkey -v -keystore maskoff-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias maskoff
```

Put the credentials in `android/keystore.properties` (git-ignored):

```properties
storeFile=../maskoff-release.jks
storePassword=...
keyAlias=maskoff
keyPassword=...
```

Then wire the signing config into `android/app/build.gradle` and run
`./gradlew assembleRelease` (APK) or `bundleRelease` (AAB — what the Play
Store wants). Version numbers live in `android/app/build.gradle` as
`versionCode` / `versionName`; bump `versionCode` on every upload.

## What the native layer adds

| Concern | Web build | Android build |
| --- | --- | --- |
| Story export | `navigator.share` → download fallback | Native share sheet via `@capacitor/share`, image written to cache with `@capacitor/filesystem` |
| Haptics | `navigator.vibrate` patterns | Platform haptic engine via `@capacitor/haptics` |
| Fonts | self-hosted woff2 | same files, bundled in the APK |
| Backend | same | same |

Android WebView supports neither `navigator.share` with files nor
`<a download>`, so without the native plugins the Persona Hub's share button
would be dead. `src/lib/share.ts` picks the right path at runtime; the web
build never loads the plugins.

## Regenerating icons and splash

`node gen-icons.mjs` rasterizes `public/icon.svg` into every launcher density,
the adaptive-icon foreground (inset to the 66% safe zone the launcher masks
to), and the splash drawables. Requires `npm i -D playwright`.

## Known limits of this build

- **Not verified on a device.** The build environment has no hardware
  virtualization, so no emulator could boot. The bundled web app is covered by
  the browser walkthrough (`npm run test:e2e`), and the APK is structurally
  verified (`aapt2 dump badging`, `apksigner verify`), but the native shell
  itself — splash, share sheet, haptics — has not been exercised on real
  hardware. Install it and check those three first.
- `versionCode` is 1. Bump before any second distribution.
- No push notifications yet; the 20:00 / 21:00 beats rely on the user opening
  the app.
