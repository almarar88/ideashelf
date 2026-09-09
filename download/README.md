# Download

`alcode-trips.apk` — Android debug build of Alcode Trips.

- Package `app.alcodetrips.mobile`, Android 5.1 (API 22) and newer.
- **Debug build**, so it is signed with the standard debug key. Android will
  warn about installing from an unknown source; that warning is expected here.
  A Play Store release needs a release build signed with your own keystore —
  see the README.

A binary in git is not a normal habit; this one is here so the app can be
installed straight from a phone. Attaching it to a GitHub Release instead keeps
the repository small and gives every build its own version, which is the better
home for it once there is more than one.

Rebuild it yourself at any time:

```bash
npm run android:build
```
