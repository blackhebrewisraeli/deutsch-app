# Entry flow, level in settings, and XP by level

**Status:** design, ready for a plan
**Date:** 2026-08-17
**Branch target:** `main` (currently `d6f96e0`, 1417 tests)

---

## 1 · What this is

Three changes to how someone enters the app, split into three PRs.

The reported problem was "opening the domain drops me straight into a practice
page instead of the entry screen, and it forces dark mode." Both halves of that
turned out to be wrong about the cause, and §2 records what is actually true.
The changes below are still the ones wanted — they are just not the fixes the
report implied.

- **PR A — entry gate + entry-screen theming.** The Welcome gate stops being a
  once-per-device event and becomes a function of whether an account session
  exists. The two entry screens stop inverting the theme.
- **PR B — level in settings.** A Level picker in the Stats tab, so a
  signed-in user can change difficulty without signing out.
- **PR C — XP by level.** A per-level XP multiplier, for account holders only.

PR B is not optional polish. PR A takes the level picker away from returning
signed-in users; PR B is where they get it back.

## 2 · The facts that shape this — all verified

**F1 — the entry flow already exists and already works.** A fresh visit to
production renders `WelcomeGate` (Continue with Google / Create account / Sign
in / "Try it first — free"), and choosing any of them leads to `SplashScreen`'s
"What's your level?" Verified in a browser with empty storage against
https://deutsch-app-dusky.vercel.app. Nothing needs to be built; the gating
condition is what is wrong.

**F2 — one localStorage key hides both screens forever.** `deutsch-onboarded`
is written once by `SplashScreen` (`SplashScreen.jsx:16`) and read by both
gates:

| site | expression |
|---|---|
| `App.jsx:297` | `showGate = !localStorage.getItem('deutsch-onboarded')` |
| `App.jsx:407` | `showSplash = !localStorage.getItem('deutsch-onboarded')` |

The key is device-local and never cleared, so signing out does not bring the
screens back. That is exactly the reported symptom.

**F3 — nothing forces dark mode; the entry screens invert the theme.**
`resolveThemeMode` (`themeMode.js:85`) resolves explicit preference → OS
`prefers-color-scheme` → dark, and only reaches that last fallback when
`matchMedia` is unavailable. The inversion is in the screens themselves:

| token | CSS var | role |
|---|---|---|
| `COLORS.ink` | `var(--c-fg)` | foreground |
| `COLORS.paper` | `var(--c-ground)` | background |

`WelcomeGate.jsx:16-17` sets `background: COLORS.ink; color: COLORS.paper` —
background painted with the foreground token. `SplashScreen.jsx:49` does the
same for its first stripe. The screens are therefore always the **opposite** of
the resolved theme: a light OS yields a dark gate. Confirmed by screenshot on a
light-mode machine.

**F4 — `recordEvent` already carries `level` and already has a bonus channel.**
`recordEvent(tab, level, verdict)` (`stats.js:235`) computes
`bonus = round(base × (mult − 1))` from the streak multiplier and stores it in
`daily`. All eight call sites already pass `level`:

`ChatTab.jsx:124`, `VocabTab.jsx:172,183,205`, `AlphabetTab.jsx:100`,
`translate/TileExercise.jsx:49`, `translate/TypingExercise.jsx:51`,
`translate/BlankExercise.jsx:54`.

A level multiplier needs no new argument, no new storage field, and no call-site
change.

**F5 — `mayHaveSession()` already answers "could this be a guest?" for free.**
`auth.js:131` scans localStorage for an `sb-*-auth-token` key and fails open.
It exists so guests never download the 207KB Supabase chunk; here it also
distinguishes "definitely a guest" from "loading, probably signed in."

**F6 — four tests use `deutsch-onboarded` as a skip-onboarding fixture.**
`App.test.jsx:43,90,235,307`. They will have to change; see §7.

## 3 · Decisions taken

Recorded here because each was chosen against a stated alternative.

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | Gate shows whenever there is **no account session** | Gate on literally every load, including signed-in; gate once per browser session |
| D2 | Level picker shows **whenever the gate flow completes**; signed-in users change level in settings | Level picker on every entry for everyone; level picker stays first-run-only |
| D3 | XP multiplier **per level**, compounding with the streak multiplier | Multiplier with leagues excluded; flat XP with a bigger daily goal per level |
| D4 | Multiplier applies to **account holders only** | Everyone, guests included |
| D5 | Entry screens **follow** the theme | Leave the inversion; force the whole app to light |

**D3 has a known cost, accepted.** Weekly leagues rank on this XP
(`lib/leagues.js`), so a B1 user out-earns an A1 user doing identical work and
will climb faster. The 50 XP daily goal is also reached ~33% sooner at B1.

## 4 · PR A — entry gate and entry-screen theming

### 4.1 Gate condition

`deutsch-onboarded` is no longer read. The gate becomes:

```
showGate = !gateDismissedThisLoad
        && isAuthConfigured()
        && (authStatus === 'anonymous'
            || (authStatus === 'loading' && !mayHaveSession()))
```

Each clause is load-bearing:

- **`!gateDismissedThisLoad`** — component state, not storage. A guest who
  clicks "Try it first" reaches the app for this page load and sees the gate
  again next visit, which is the whole point of the change.
- **`isAuthConfigured()`** — with no Supabase env (local dev, CI) the gate would
  render with nothing but a "continue" link. That is the dead-affordance bug PR
  #79 already fixed once. Skip the gate entirely there. Because nothing then
  completes a gate flow to raise `showSplash`, the initialiser below seeds it
  true instead, so an unconfigured environment gets the level picker on every
  load — which is what "every new session" means where no session exists.
- **`authStatus === 'anonymous'`** — the settled guest case.
- **the `loading && !mayHaveSession()` clause** — `useAuth` starts at
  `'loading'` for everyone and settles on the first effect, which runs after
  paint. Without this clause a guest sees one frame of the app before the gate.
  With it, a device holding no auth token gets the gate on the first paint,
  while a device that might have a session renders the app and never blinks.

`showSplash` moves to `useState(() => !isAuthConfigured())` and is set true when
the gate flow completes — three entry points, all existing:

| trigger | handler |
|---|---|
| guest continues | `handleGuest` (`App.jsx:300`) |
| sheet sign-in / create | `handleAuthDone` (`App.jsx:301`) |
| OAuth return | `AuthCallbackLanding onSignedIn` → `handleAuthDone` (`App.jsx:332`) |

A returning signed-in user therefore sees neither screen, which is D1 and D2.

`deutsch-onboarded` keeps being written by `SplashScreen`. AGENTS.md forbids
renaming or migrating storage keys, and an unread write costs nothing.

### 4.2 Entry-screen theming

`WelcomeGate` and `SplashScreen` swap the inverted pair for the ordinary one:
ground for backgrounds, foreground for text. The red and gold accent stripes
stay — the German flavour is the brand, and accents are fills with `accentOn`
ink, which is already correct in both modes.

The scoped `.welcome-guest:focus-visible` rule (`WelcomeGate.jsx:45`) currently
outlines in `COLORS.paper` because it sits on a dark slab. On a ground-coloured
background it must become `COLORS.ink` or the focus ring disappears.

The repo's rendered-DOM contrast sweep runs in CI, so the new pairings are
verified there rather than by eye.

## 5 · PR B — level in settings

A `LevelPicker` in `src/components/gamification/`, built on the existing
`SegmentedPicker` exactly as `GoalPicker` is:

```
{ key: 'a1', label: 'Beginner',     detail: 'A1' }
{ key: 'a2', label: 'Elementary',   detail: 'A2' }
{ key: 'b1', label: 'Intermediate', detail: 'B1' }
```

Rendered in `StatsTab` beside Daily goal, under a `SectionLabel`. Picking writes
`deutsch-level`, calls `stampSettings()`, and lifts to `App`'s `level` state —
the same three steps `SplashScreen.handleSelect` already performs, so the write
path should be extracted to one helper rather than duplicated.

Once PR C lands, `detail` gains the multiplier (`'A1 · ×1'`) for account
holders, so the gamification incentive is visible at the point of choice. That
is a PR C change to a PR B component, not a second component.

## 6 · PR C — XP by level

In `gameConfig.js`, beside `MULTIPLIER_TIERS`:

```js
export const LEVEL_MULTIPLIERS = { a1: 1, a2: 1.25, b1: 1.5 };
```

`recordEvent` folds it into the existing bonus channel (F4):

```
levelMult = entitled ? (LEVEL_MULTIPLIERS[level] ?? 1) : 1
mult      = streakMult × levelMult
bonus     = round(base × (mult − 1))
```

Storage shape is unchanged: `daily` still holds per-verdict counts plus one
`bonus` number, and `xpCore` still derives base XP from the counts. The `mult`
already returned by `recordEvent` now includes the level factor, so the existing
"+XP" flourish shows the larger number with no UI change.

**Entitlement (D4).** `recordEvent` is a plain function in `lib/` with no access
to React state, and threading an auth prop to five components to reach eight
call sites is churn. Instead a small `lib/xpEntitlement.js` holds an in-memory
flag with a setter, which `App` calls when `authStatus` resolves:

```js
setLevelBoostEnabled(authStatus === 'authenticated');
```

This is the pattern `setSoundEnabled` (`sound.js:6`) already uses in this
codebase. It defaults to `false`, so a guest and a test both get flat XP unless
something opts in. It is deliberately **not** written into
`deutsch-app-state-v1`: that blob syncs, and an entitlement derived from the
local session must not travel between devices.

**A guest who registers** starts earning boosted XP from that moment. Already-
banked XP is not recomputed — `daily` stores realised numbers, and rewriting
history would change past days' goal-qualification and therefore the streak.

## 7 · Testing

**PR A.** The four fixtures in F6 stop working, because the condition they
target no longer exists. They become an auth-status fixture instead — the tests
themselves assert rendered DOM, so only the setup changes. New cases:

- guest (no token, auth configured) → gate renders
- gate dismissed → splash renders → app renders
- `authStatus === 'authenticated'` → neither screen, app renders directly
- auth not configured → no gate, splash renders
- `authStatus === 'loading'` with `mayHaveSession()` true → app renders, no gate
  flash
- second visit as a guest → gate renders again (the regression this PR exists
  to prevent)

For the screens: assert the background resolves to the ground token, not the
foreground one. Written as a **negative assertion** — `background` must not be
`var(--c-fg)` — because that is the exact defect, and an assertion that only
checks "some token" would pass against the inverted version too.

**PR B.** Picking a level writes `deutsch-level`, stamps settings, and changes
the level the practice tabs receive.

**PR C.** Unit tests on the multiplier arithmetic per level; that an
unentitled caller gets flat XP; that entitlement × streak compose
multiplicatively rather than additively; and that an unknown or missing level
falls back to ×1 rather than `NaN`.

**Fixture warning.** A fixture that cannot express the failure has hidden four
bugs in this repo already. For PR C specifically, any test fixture must contain
at least two different levels and a streak long enough to make `streakMult > 1`
— with one level and no streak, the composed and the flat implementations are
indistinguishable.

## 8 · Out of scope

- Rebalancing leagues for the D3 skew. Measure first, after real data exists.
- Per-level daily goals.
- Making the level picker part of the account rather than the device
  (`deutsch-level` is device-local; that is Phase 4 storage work).
- Any change to `resolveThemeMode`'s default — the OS remains the source of
  truth for light versus dark.
