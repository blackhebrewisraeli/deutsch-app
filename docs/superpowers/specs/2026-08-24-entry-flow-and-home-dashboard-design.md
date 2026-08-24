# Entry flow simplification: theme access, deferred level, and a Home dashboard

**Status:** design, ready for a plan
**Date:** 2026-08-24
**Branch target:** `claude/simplify-theme-picker-tone-removal` (PR #152, not yet merged to `main`) —
this branch depends on that PR's simplified `ThemeChip` (Light/Dark only). Rebase onto `main` once
#152 merges.

---

## 1 · What this is

Three product asks that turned out to be one connected change to the app's entry flow:

1. **Theme access from the first frame.** The Light/Dark toggle should be reachable from the
   moment the app opens, not only after someone has picked guest/account.
2. **The level picker stops blocking entry.** `SplashScreen`'s "What's your level?" is a mandatory,
   full-screen gate today. It should become a deferred, always-available control instead — the
   product owner does not want a dedicated screen for it at all.
3. **A Home dashboard.** Once someone has entered the app (guest or signed-in), there should be a
   recurring landing surface — every app open, not just the first one — rather than dropping
   straight into the Chat tab.

## 2 · Prior art this supersedes

`docs/superpowers/specs/2026-08-17-entry-flow-and-level-xp-design.md` (PR A/B/C, merged) built the
current gate machinery and made an explicit call this design reverses:

> **D2** — Level picker shows **whenever the gate flow completes**; signed-in users change level in
> settings. *(Rejected then: "level picker on every entry for everyone" / "stays first-run-only".)*

D2 is superseded here: the level picker never blocks entry for anyone, guest or signed-in. Verified
against the current code (2026-08-24) that D2's mechanism is exactly what's still live —
`App.jsx`'s `showSplash` still seeds from `!hasStoredLevel()`, `SplashScreen` is still the only way
past it. Nothing has drifted from that spec.

That spec's PR B built a standalone `LevelPicker` in Stats; the codebase has since consolidated
level-switching into `StatusChip` (header XP badge + CEFR chip, one sheet, `LevelSwitcher` inside —
`docs/superpowers/specs` entry for that session is `2026-08-17-entry-flow-and-level-xp-design.md`'s
successor work, not written up as its own spec). That consolidation is **why this change is small**:
the "side-panel control" the product owner is asking for already exists and already works. It's
just unreachable until the blocking gate clears. Confirmed by reading `StatusChip.jsx` directly.

PR C (XP-by-level multiplier) and the theme-mode resolution order are untouched by this design.

## 3 · Facts that shape this — verified against current code

- **`readLevel()` already defaults to `'a1'`** when nothing is stored or storage is corrupt/blocked
  (`levelPref.js:65-72`). `App.jsx`'s `level` state already initializes from it
  (`useState(readLevel)`) and already listens for `LEVEL_CHANGE_EVENT`, which `writeLevel` fires on
  every write — including from `StatusChip`'s `LevelSwitcher`. **No new default-handling code is
  needed anywhere.**
- **`showSplash` is the only thing gating entry on level.** It seeds from `!hasStoredLevel()`
  (`App.jsx:307`) and is separately set `true` by `handleGuest` and `handleAuthDone`. Nothing else
  reads it. `handleSplashComplete` only does `setLevel(chosenLevel); setShowSplash(false)` — the
  `setLevel` call is redundant with the event listener (SplashScreen's `handleSelect` already calls
  `writeLevel` before `onComplete`), so once the gate is gone this whole function is dead code.
- **`WelcomeGate` has no header of its own** — no `ThemeChip`, nothing. It's the only pre-entry
  screen once `SplashScreen` is removed (§5), so "persistent shell everywhere" only actually means
  one extra call site, not a general abstraction.
- **The header's `GoalRing` already renders unconditionally on every tab** at `width >= bp.wide`
  (`App.jsx:706`), not tab-scoped. Once `home` becomes a tab, that ring would sit directly above
  Home's own (bigger) ring — an exact duplicate. §6.3 hides the header ring specifically on the
  `home` tab.
- **`TABS` (the practice-tab constant used for the trial wall and per-tab accuracy) already
  excludes `stats`** — it's defined in `lib/stats.js` as `['chat', 'alphabet', 'vocab',
  'translate']`, a different, smaller array than the local `tabs` list that renders the nav bar.
  `home` gets the same treatment: added to the nav-rendering list, never added to `TABS`. No new
  exclusion mechanism to build.
- **`deutsch-onboarded`** is already unread dead weight (kept only because AGENTS.md forbids
  removing storage keys) — untouched by this change, for the same reason.

## 4 · Decisions taken during brainstorming

| # | Decision | Rejected alternative |
|---|---|---|
| E1 | One persistent theme-access point per pre-entry screen, not a shared `AppShell` component | Building a reusable shell now for a single call site |
| E2 | `SplashScreen` deleted outright | Repurposing its flag-stripe visual as a one-time non-blocking welcome flourish |
| E3 | No-level content defaults silently to A1, no prompt | A dismissible inline nudge pointing at the level control on first practice-tab visit |
| E4 | Home is a recurring landing surface on **every** app open | Home shown once, right after onboarding, then the app resumes the last tab/practice on return visits |
| E5 | Home content is a **progress snapshot only** — `LevelCard` + `GoalRing`/streak | Also including quick-start shortcut tiles per practice tab, or a "continue where you left off" surface |
| E6 | Header's `GoalRing` hides specifically while `tab === 'home'` | Leaving both rings visible (redundant but harmless) |

## 5 · Design A — theme access before entry

Add a `ThemeChip`-style corner control directly to `WelcomeGate.jsx` (top-right, same circular sun
icon, same sheet component — just reused, not rebuilt). No shared shell: `SplashScreen` goes away in
§6, so `WelcomeGate` is the only screen that renders before the main app's own header (which already
has `ThemeChip`).

Placement: `position: absolute, top: 16, right: 16` inside the existing `.entry-screen` container,
matching the sizing/behavior `ThemeChip` already has in the main header.

## 6 · Design B — kill the blocking level gate

### 6.1 Removal

Delete:
- `src/components/SplashScreen.jsx` and `src/components/SplashScreen.test.jsx`
- `showSplash` state, `handleSplashComplete`, the `if (showSplash) return <SplashScreen .../>` render
  branch, the `import SplashScreen` line
- the two `setShowSplash(true)` calls in `handleGuest` and `handleAuthDone`

Nothing else references any of the above (verified: `grep -rn "SplashScreen\|showSplash\|handleSplashComplete" src` after removal must return nothing outside deleted files).

### 6.2 Effect

Once `WelcomeGate` clears (or is skipped because auth isn't configured), the app renders
directly at whatever `readLevel()` returns — `'a1'` for anyone who has never chosen, matching E3.
`StatusChip` in the header is reachable immediately and is the only place level is ever set or
changed, for guests and signed-in users alike.

### 6.3 Header `GoalRing` de-duplication

`App.jsx:706` gains a tab guard:

```diff
- {width >= bp.wide && <GoalRing pct={game.goal.pct} met={game.goal.met} size={48} />}
+ {width >= bp.wide && tab !== 'home' && <GoalRing pct={game.goal.pct} met={game.goal.met} size={48} />}
```

## 7 · Design C — Home dashboard

New file `src/components/HomeTab.jsx`. Composes exactly two existing, already-reused components —
no new data-fetching, no new derived state beyond what `App.jsx` already computes for the header:

- `LevelCard` (`gamification/LevelCard.jsx`) — level, rank, XP-to-next bar, total XP, learned count.
  Already used in `StatsTab`; same props (`lvl`, `totalXp`, `learnedCount`).
- A larger `GoalRing` (`gamification/GoalRing.jsx`) paired with the streak count — same data
  (`game.goal.pct`, `game.goal.met`, `game.streak`) `App.jsx` already threads to the header ring and
  to `GoalStrip`.

Deliberately excluded: `TodaySnapshot` (accuracy breakdown), `Heatmap`, `PerTabBars`,
`AccuracyByLevel`, `ReviewFeed`, `BadgeGrid`, `AccountSection`, `LeaderboardSection` — all stay
exclusive to Stats, keeping Home a quick glance and Stats the deep dive (E5).

### 7.1 Navigation wiring

- `App.jsx`'s local `tabs` render list gets a new first entry: `{ id: 'home', label: 'Home', icon: Home, num: '01' }` (lucide-react `Home` icon), and the existing five entries renumber `02`–`06`.
- `const [tab, setTab] = useState('chat')` becomes `useState('home')`.
- New render branch, using values `App.jsx` already computes for `StatusChip`/`GoalRing`/`GoalStrip`
  (no new derived state):
  ```jsx
  {tab === 'home' && (
    <HomeTab
      lvl={game.lvl}
      totalXp={totalXp(daily)}
      learnedCount={stats.learnedCount ?? 0}
      goalPct={game.goal.pct}
      goalMet={game.goal.met}
      streak={game.streak}
    />
  )}
  ```
  `lvl`/`totalXp`/`learnedCount` are the exact three props `StatsTab` already passes to the same
  `LevelCard` (`StatsTab.jsx:145-149`); `goalPct`/`goalMet` mirror the header's `GoalRing` call
  (`App.jsx:706`); `streak` mirrors `GoalStrip`'s (`App.jsx:840`).
- `home` is **not** added to `lib/stats.js`'s `TABS` constant — it stays excluded from the trial
  wall and per-tab accuracy the same way `stats` already is (§3).

## 8 · Testing

- `WelcomeGate.test.jsx` — new case: renders the Appearance control; clicking it opens the same
  sheet `ThemeChip.test.jsx` already asserts (reuse, not a parallel spec).
- `SplashScreen.test.jsx` — deleted.
- `App.test.jsx`:
  - Every fixture currently seeding `localStorage.setItem('deutsch-level', 'a1')` purely to skip
    the splash can drop that line — `readLevel()` already defaults there — but leaving it is
    harmless, so only touch fixtures that actively assert splash-specific behavior.
  - Splash-specific cases (gate dismissed → splash renders → app renders, etc., per the 2026-08-17
    spec's §7) are removed; replaced with: gate dismissed (or skipped because auth is unconfigured)
    → app renders directly on the `home` tab.
  - Default-tab assertions move from `'chat'` to `'home'`.
  - Nav-order / numbering assertions (`01`–`05` today) shift to `01`–`06`.
  - New case: header `GoalRing` is absent at desktop width while `tab === 'home'`, present on every
    other tab — a negative assertion, since a duplicate ring is exactly the defect being avoided.
  - New case: trial wall never appears on the `home` tab for an exhausted guest, mirroring the
    existing "never walls the Stats tab" case.
- `HomeTab.test.jsx` — new: renders `LevelCard` and `GoalRing`/streak with the props `App.jsx`
  passes; renders nothing else (a negative assertion against `TodaySnapshot`/`Heatmap`/etc. leaking
  in, per E5).

## 9 · Out of scope

- Any change to `LEVEL_MULTIPLIERS`, XP entitlement, or the streak/goal computation itself — this
  design only changes *where* the existing level control is reachable and *what* composes the new
  landing tab, not the underlying game logic.
- A shared `AppShell` abstraction (E1) — revisit if a third pre-entry screen is ever added.
- Quick-start shortcut tiles or "continue where you left off" on Home (E5) — logged as a possible
  follow-up, not building it now.
- Renaming or migrating `deutsch-onboarded` or `deutsch-level` — AGENTS.md forbids storage-key
  changes outside Phase 4.
- Rebalancing the nav bar's mobile icon-only layout for a sixth tab — verify it still fits at
  320px/390px during implementation (existing AGENTS.md narrow-viewport rule), but no new mobile
  nav design is anticipated since `home` is icon-sized like every other entry.
