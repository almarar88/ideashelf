# MaskOff AI — مَفْضوح

A daily social deduction game for a friend group. One dilemma drops at 20:00,
everyone answers privately and bets on what the others chose, and at 21:00 the
whole group's results open at the same second with an AI Roast Master calling
out the hypocrites.

---

## What this is, and what it isn't

The brief asked for a native Android app (Flutter / React Native / Jetpack
Compose). **This is a mobile-first installable PWA in React + TypeScript**, and
that substitution was deliberate:

- The build environment has no Flutter, Dart, or Android SDK, so native code
  written here could not be compiled, run, or verified — it would be untested
  code shipped with a claim it works.
- The repository is already a React + Vite + TypeScript + Tailwind project.
- Everything the brief's game loop actually needs — synchronized reveal,
  realtime sync, haptics, a story-export share sheet into Instagram and
  WhatsApp, installability — is available to a PWA on Android.

**What you lose versus native:** no Play Store listing, no push notifications
on iOS (Android web push works), and haptics are limited to `navigator.vibrate`
patterns rather than fine-grained Taptic-style feedback.

**The port path is short.** All game rules, scoring, scheduling, the AI engine
and the prompts are plain TypeScript with no DOM dependency
(`src/lib/`, `src/ai/`, `src/types/`), and every screen talks to one `Backend`
interface. A Flutter or Compose client re-implements the views and the same
Edge Functions and schema serve it unchanged.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5174
```

It runs with **no backend and no API key**. The default config
(`VITE_BACKEND=local`, `VITE_AI_TRANSPORT=off`) uses an offline simulator and
a built-in question bank.

Because the real game only does one thing per day, there is a **simulation
drawer** (the ✦ button, top corner) to move the clock:

| Control | Effect |
| --- | --- |
| افتح السؤال الآن / Open now | Moves the drop into the past |
| عبّي إجابات الباقي / Fill others | Generates deterministic answers for the rest of the squad |
| اكشف الآن / Reveal now | Sets the reveal 5 seconds out, so you can watch the countdown land |
| جولة جديدة / New round | Discards today's round and generates a fresh dilemma |

Open two browser tabs to watch realtime sync: the local backend broadcasts over
`BroadcastChannel`, so a submission in one tab appears in the other immediately.

```bash
npm test           # 29 unit tests — scheduling, scoring, dedupe, JSON validation
npm run build      # typecheck + production bundle
```

---

## Architecture

```
src/
├── ai/            AIClient — model calls, validation, anti-repetition, fallbacks
│   ├── prompts.ts     re-export of the Edge Functions' prompts (single source)
│   ├── gemini.ts      transports, retry loop, schema enforcement
│   ├── json.ts        strict JSON extraction + zod validation
│   ├── dedupe.ts      the infinite-questions engine
│   └── fallbacks.ts   offline question bank + deterministic roast
├── backend/       one interface, two implementations
│   ├── types.ts       the Backend contract every screen codes against
│   ├── local/         offline simulator (localStorage + BroadcastChannel)
│   └── supabase/      production adapter (Postgres + Realtime)
├── state/         AuthContext · GroupContext · GameContext (GameState + LiveSync)
│   └── useServerClock.ts   clock-offset correction
├── lib/           scoring · time · i18n · haptics
├── components/    UI kit + game components
└── screens/       Vault · Dilemma · Showdown · PersonaHub · Onboarding

supabase/
├── schema.sql     tables, RLS, streak settlement
└── functions/
    ├── _shared/prompts.ts   ← the AI system prompts live here
    ├── daily-drop/          question generation
    └── roast/               roast generation
```

---

## The AI engine

### Infinite questions without repetition

Prompting a model for "an original dilemma" does not stop it from producing the
same dilemma next week. Generation is wrapped in three layers
(`src/ai/dedupe.ts`):

1. **Rotation** — the category is chosen least-recently-used, and a freshness
   angle rotates deterministically, so consecutive days cannot rhyme.
2. **Exclusion** — the last 25 question texts are handed to the model as an
   explicit "do not repeat, translate, invert, or paraphrase" block.
3. **Rejection** — whatever comes back is fingerprinted as a normalized
   content-word set and compared by Jaccard overlap against the group's history.
   Above 0.45 it is rejected and re-rolled at a higher temperature with a
   harder constraint.

The fingerprint normalizes Arabic orthography (أ/إ/آ→ا, ة→ه, ى→ي, diacritics)
and strips the و/ف conjunctions and ال article, so "تستلف المال" and
"تستلف مال" are correctly seen as the same topic.

### Strict validation, always-total fallbacks

Every model response goes through `parseStrict`: JSON is extracted (tolerating
a markdown fence or a leading sentence, nothing weirder), then validated
against a zod schema. Beyond schema shape, a question is also rejected if the
options aren't exactly `[A, B]`, if the two options are identical, or if it
duplicates history; a roast is rejected if it names a user id that isn't in the
group.

After 3 failed attempts the offline bank answers instead. **Every AI call path
returns a valid object** — a daily social game cannot have its drop blocked by
a third-party API outage.

### Where the API key lives

| Transport | Key location | Use |
| --- | --- | --- |
| `edge` | Supabase function secret | **Production.** |
| `direct` | Browser env var | Local dev only; refuses to run in a production build. |
| `off` | none | Offline bank only. |

Under `edge`, the client sends only **structured parameters** — language,
category, angle, exclusion list. It never sends prompt text. The function
builds the instructions from its own copy, so a public anon key can't be used
to turn our Gemini quota into a free general-purpose LLM endpoint. User-authored
display names are length-bounded before they reach the prompt.

---

## The synchronized reveal

The reveal is a shared moment, so it cannot be computed from device clocks:

- `reveal_at` is a server-issued timestamp on the round row, identical for
  every client.
- `useServerClock` measures the device's offset against the server with
  round-trip compensation, re-measures every 5 minutes and on tab focus, and
  every countdown reads through it.
- Secrecy is enforced in **Postgres**, not the client: the RLS policy on
  `submissions` returns other members' rows only once `rounds.reveal_at <=
  now()`. A crafted request cannot read the group's answers early.
- Round creation is idempotent via `unique (group_id, day)`, so N clients
  opening the app at 20:00 produce exactly one dilemma.
- The roast is written first-writer-wins (`update ... where roast is null`), so
  every member sees the same text.

---

## Scoring

| Event | Points |
| --- | --- |
| Submitting before the reveal | 10 |
| Each correct read of another member | 25 |
| Reading the entire squad correctly | +50 |

Multiplied by the squad streak (`1 + 0.1 × streak`, capped at 2×). The streak
advances only if **every** member submitted before the reveal — one person
missing breaks it for the group.

Stakes on members who never submitted are excluded from grading, so you aren't
punished for someone else's absence.

---

## Deploying against Supabase

```bash
# 1. Schema
psql "$DATABASE_URL" -f supabase/schema.sql

# 2. Functions — the Gemini key stays here
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-1.5-flash
supabase secrets set ALLOWED_ORIGIN=https://your-domain
supabase functions deploy daily-drop
supabase functions deploy roast

# 3. Client
cp .env.example .env
#   VITE_BACKEND=supabase
#   VITE_AI_TRANSPORT=edge
#   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run build
```

The onboarding screen's identity picker is the local backend's stand-in for
auth. Against Supabase, replace it with a real OTP/OAuth flow — nothing else in
the app changes, because everything reads the session through `AuthContext`.

### Not built, and why

- **Scheduled generation.** Rounds are created lazily when the first member
  opens the app. Pre-generating at 19:55 with `pg_cron` calling `daily-drop`
  would remove the first user's wait. Worth doing before launch.
- **Push notifications** for the 20:00 drop and 21:00 reveal — the loop depends
  on people showing up, so this is the highest-value missing piece.
- **Real invite/join flow.** The schema supports it (`invite_code`); the UI is
  a single seeded demo group.
- **Reaction persistence.** The reaction sheet is local-only; it needs a
  `reactions` table to reach the group.
- The in-function rate limiter is per-instance memory. Put a real limit in
  front of the functions for production traffic.

---

## Design

The visual language follows the supplied dark-UI reference: a near-black canvas
with charcoal-violet raised surfaces, oversized 28–32px radii, pastel accent
tiles carrying dark ink, thin-stroke circular icon badges, a floating pill
navigation bar, chevron progress steppers, colored stat-count tiles, and a
centered modal sheet with an emoji reaction row and a coral CTA.

That reference maps onto the game's screens directly:

| Reference screen | MaskOff screen |
| --- | --- |
| Search home with stacked service cards | **The Vault** — countdown, streak tile, squad status |
| Pastel service card with ↗ action | **The Dilemma Card** — two tappable/swipeable options |
| "My order" with stat chips and stepper | **The Live Showdown** — vote split, stepper, leaderboard |
| "Rate Us" modal | **Roast reaction sheet** |

Semantic colors keep their meaning from the original brief: violet is primary,
green is success, red/coral is alert, yellow marks streaks and urgency.

Arabic (Gulf dialect) and English are both first-class — the document direction
follows the group language, directional glyphs mirror under RTL, and countdowns
and scores stay in Latin tabular numerals so they remain scannable.
