# الشاهد الصامت — The Silent Witness

لعبة غموض وتحقيق عائلية سريعة، مبنية بـ Flutter وجاهزة للتحويل إلى ملف APK.

A fast, pass-and-play Arabic social-deduction game for 3–10 players. One
Detective, one Silent Witness who may only nod, one Culprit hiding in plain
sight, and everyone else under suspicion. A round takes about five minutes and
nobody is ever eliminated.

---

## 1. Build the APK

```bash
# from the repository root
cd silent_witness

flutter pub get
flutter build apk --release
```

The signed APK lands at:

```
build/app/outputs/flutter-apk/app-release.apk
```

Install it on a connected phone with:

```bash
flutter install --release
# or
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

The single APK carries the Flutter engine for all three ABIs. For a much
smaller download, build one APK per architecture instead:

```bash
flutter build apk --release --split-per-abi
```

`app-arm64-v8a-release.apk` is the one to sideload on any phone made in the
last several years.

Measured on the toolchain below:

| Output | Size |
|---|---|
| `app-release.apk` (all ABIs) | 55.4 MB |
| `app-arm64-v8a-release.apk` | 19.9 MB |
| `app-armeabi-v7a-release.apk` | 17.4 MB |
| `app-x86_64-release.apk` | 21.4 MB |

Almost all of that is the Flutter engine itself; the game's own code and
assets come to under 2 MB.

An App Bundle for Google Play:

```bash
flutter build appbundle --release
```

### Optional: build with a Gemini key baked in

```bash
flutter build apk --release --dart-define=GEMINI_API_KEY=YOUR_KEY
```

This is only a convenience. The game is fully playable without it, and a key
can also be pasted into the in-app settings sheet at any time.

### Optional: sign with your own keystore

Without a keystore the release build is signed with the debug key, which is
fine for sideloading but not for Google Play. To use a real key, create
`android/key.properties`:

```properties
storeFile=/absolute/path/to/upload-keystore.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

The Gradle config picks it up automatically; the file is already gitignored.

### Toolchain used

| Component | Version |
|---|---|
| Flutter | 3.47.3 (stable) |
| Dart | 3.13.3 |
| Android Gradle Plugin | 9.1.0 |
| Gradle | 9.3.1 |
| JDK | 17+ (built and verified on 21) |
| compileSdk / targetSdk / minSdk | 36 / 34 / 24 |

**Note on `minSdk`.** The brief asked for `minSdk 21`. Flutter 3.47's Gradle
plugin refuses to build below API 23 and warns below 24
(`DependencyVersionChecker.kt`: `errorMinSdkVersion = 23`,
`warnMinSdkVersion = 24`), so the project ships at **24** — Flutter's own
supported floor, covering Android 7.0 and newer. Change it in
`android/app/build.gradle.kts` if you ever move to an older Flutter.

**Note on `targetSdk`.** Set to **34** exactly as requested. Google Play
requires a higher target for new submissions; raise the one line in
`android/app/build.gradle.kts` when you publish there. Sideloading is
unaffected.

---

## 2. How the game plays

1. **Setup** — pick 3–10 players, optionally type their names, choose a
   category (Family Pranks / Lost Valuables / Kitchen Mystery) and a round
   length (2, 3 or 5 minutes).
2. **Secret roles** — the phone goes around the table. Each player presses and
   holds the fingerprint pad to see their own role, then hides it again.
   Only the Silent Witness is told who the Culprit is.
3. **The briefing** — the case title and description are read aloud to
   everybody. The three clues stay behind a second fingerprint gate, for the
   Silent Witness alone.
4. **The interrogation** — a countdown ring with a ticking-clock loop. The
   Detective spends at most **three** questions on the Silent Witness (who may
   only nod yes / no / I-don't-know, or hold up a silent hint card), and uses
   the rest of the time on everyone else. The Culprit can quietly tap
   **استشارة المحامي** for a ready-made alibi.
5. **The verdict** — the Detective names one suspect, the gavel falls, and the
   real Culprit is revealed with confetti or with a very dark chord.

Score is kept across rounds: Detectives vs. Culprits.

---

## 3. What is in the box

```
silent_witness/
├── assets/
│   ├── cases.json            54 cases, 30 alibis, 17 silent hint cards
│   ├── audio/                6 synthesized sounds (see §5)
│   └── fonts/                Cairo 400 / 700 / 900 (SIL OFL, OFL.txt included)
├── lib/
│   ├── main.dart             loads prefs + case pack, then runs the app
│   ├── app.dart              MaterialApp, Arabic locale, forced RTL
│   ├── core/
│   │   ├── app_theme.dart    the whole noir palette and text scale
│   │   ├── audio_service.dart
│   │   └── providers.dart    Riverpod wiring and SharedPreferences keys
│   ├── models/               role, player, case, settings, state
│   ├── data/
│   │   ├── case_repository.dart   offline pack + no-repeat draw
│   │   └── gemini_service.dart    optional AI, always fails soft
│   ├── controllers/
│   │   └── game_controller.dart   role dealing, timer, verdict, scoring
│   ├── views/                home, setup, roles, briefing, investigation,
│   │                         verdict, result, settings sheet
│   └── widgets/              case-file scaffold, hold-to-reveal, countdown
│                             ring, confetti, role badge
└── test/widget_test.dart     14 tests over the pack, dealing and scoring
```

---

## 4. The AI features

Both are strictly optional and both degrade silently.

| Feature | With a Gemini key | Without |
|---|---|---|
| **Case generator** | Gemini writes a brand-new case (title, story, 3 clues, 3 questions) for the chosen category | A case is drawn from the 54 bundled ones, with no repeat until the category is exhausted |
| **AI defence lawyer** | Gemini writes a fresh witty alibi for the Culprit | An alibi is drawn from the 30 bundled ones |

`GeminiService` returns `null` on any error — no key, no network, timeout, bad
JSON — and the controller falls through to the offline pack. A failed case
generation shows one short notice and the round continues normally.

The model is `gemini-2.5-flash`; change the single `model` constant in
`lib/data/gemini_service.dart` to use another one.

---

## 5. Assets

- **Fonts** — Cairo, instanced at weights 400/700/900 from the upstream
  variable font. Licensed under the SIL Open Font License 1.1;
  `assets/fonts/OFL.txt` ships with it.
- **Audio** — all six WAV files were synthesized from scratch for this project
  (no samples, no licensing to track): a seamless 4-second ambient loop with a
  tick/tock, a gavel strike, a major resolve for a correct verdict, a dark
  minor cluster for a wrong one, a rising suspense sweep, and a UI click.
  Every playback call is wrapped so that a device with no working audio
  backend degrades to a silent — but fully playable — game.

---

## 6. Tests

```bash
flutter analyze     # 0 issues
flutter test        # 14 tests
```

The release APK was built and inspected on this toolchain; `aapt2 dump
badging` on the arm64 output reports `sdkVersion:'24'`,
`targetSdkVersion:'34'`, `application-label:'الشاهد الصامت'` with an English
alternative, and the single INTERNET permission.

The suite checks that the shipped pack really has 50+ playable cases with three
clues and three questions each, that every roster size from 3 to 10 deals
exactly one Detective, one Silent Witness and one Culprit, that only the
Culprit and the innocent suspects are accusable, that the verdict scores
correctly, that the alibi button always returns something, and that the home
screen comes up in Arabic and right-to-left.
