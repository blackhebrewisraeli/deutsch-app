# Streak & Daily-Goal "Drama" — Design

- **Date:** 2026-06-24
- **Status:** Approved (design direction); pending spec review → implementation plan
- **Author:** Claude Code (brainstormed with Semion)
- **Area:** Gameplay / reward loop — engine-level, language-blind

## 1. Context & motivation

The backend (sync, auth, security) has had heavy investment; the experience layer
lagged. We chose to invest in the **gameplay & reward loop**, and within that the
**streak + daily-goal "drama"** — the come-back-every-day retention loop.

Diagnosis of today's loop:

- The streak is a **login streak**, not a practice streak: it increments on app
  open regardless of whether any exercise is done ([App.jsx:233](../../../src/App.jsx)).
- The "protect your streak" cue is **dead code**: `streakPulsing`
  ([App.jsx:295](../../../src/App.jsx)) can never be true in-session because
  `lastVisit` is set to today on mount.
- **One miss resets to 1** ([App.jsx:236](../../../src/App.jsx)) — no grace.
- Milestones are sparse/arbitrary (confetti only every 7th day,
  [App.jsx:86](../../../src/App.jsx)); the daily-goal climb is invisible during play.
- Reward systems (XP, levels, 11 achievements, goal ring) are surfaced in the
  **Stats tab** (a place you visit), not the loop (a thing you feel).

The reward **mechanics** already exist and are cleanly derived (XP from the `daily`
log). The work is to make the streak **honest** and to move the **drama into the
moment of play**.

## 2. Chosen direction

**High-stakes (Duolingo-style)**, tuned to feel deliberate/premium rather than
nagging. Locked decisions:

| #   | Decision         | Choice                                                                  |
| --- | ---------------- | ----------------------------------------------------------------------- |
| —   | Intensity        | High-stakes: practice-derived streak + visible stakes + multiplier + freeze |
| D1  | Qualifying day   | A day counts only when **that day's XP ≥ the daily goal**               |
| D2  | Freeze economy   | **Auto**: earn 1 per 7-day run, hold max 2, auto-spend on a missed day  |
| D3  | Multiplier→level | **Yes**, via a sync-safe **bonus-XP** counter stored per-day in `daily` |

## 3. Design principles

1. **Built to keep changing (first-class).** The project is under active
   development; gameplay must stay easy to evolve. **All balance knobs live in one
   tunables module** (`src/lib/gameConfig.js`) — mirroring how `theme.js`
   centralizes design tokens and `packs/` centralizes content. Tuning the game =
   editing one file. Reward logic is **pure, modular functions** behind clear
   interfaces so new mechanics slot in without rewiring.
2. **Derive, don't store.** Streak, freezes, and multiplier are **derived** from
   history wherever possible; only the minimal irreducible state is stored.
   (Matches how XP/levels already work.)
3. **Sync-safe by construction.** New persisted state uses accumulative merge
   (additive / union / max), never bare LWW — so cross-device never silently drops
   progress (the #44 `learnedWords` lesson).
4. **YAGNI.** No speculative plugin framework. Centralized config + clean seams give
   the extensibility we need now; richer mechanics (quests, leagues, combos) are out
   of scope but easy to add later against these seams.
5. **Language-blind / engine-level.** Gamification stays free of German specifics;
   it reads deck data only through the existing `activePack` interface.
6. **Accessible & calm.** Honor `prefers-reduced-motion`; celebrations are punchy but
   brief; pressure cues are tasteful, never spammy.

## 4. Tunables — `src/lib/gameConfig.js`

Single source of game-balance truth. Initial values (all tunable):

```js
XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 }; // moved from gamification.js
GOAL_PRESETS   = { casual: 20, regular: 50, serious: 100 };
DEFAULT_GOAL   = 50;
QUALIFYING_DAY = 'goal'; // a day counts when xpForDay >= goal
FREEZE         = { earnEveryDays: 7, maxHeld: 2, autoSpend: true };
MULTIPLIER_TIERS = [ // by current streak length (days)
  { minStreak: 0,  mult: 1.0 },
  { minStreak: 3,  mult: 1.2 },
  { minStreak: 7,  mult: 1.5 },
  { minStreak: 14, mult: 1.75 },
  { minStreak: 30, mult: 2.0 },
];
STREAK_MILESTONES = [3, 7, 14, 30, 50, 100]; // celebration cadence (replaces %7)
```

Existing constants (`XP_PER_VERDICT`, `GOAL_PRESETS`, `DEFAULT_GOAL`) **move here**;
`gamification.js` and the new `streak.js` import from it.

## 5. Data model

### 5.1 Additions

- `daily[d].bonusXp: number` — streak-multiplier bonus earned that day. **Additive**,
  monotonic → rides the existing daily delta-sync with **zero adapter changes**.
  `emptyDayAggregate()` seeds `bonusXp: 0`.
- `gamification.frozenDays: { 'YYYY-MM-DD': true }` — days a freeze rescued.
  **Union-merge**.
- `gamification.bestStreak: number` — record streak. **Max-merge**.
- `gamification.lastReconcileDay: 'YYYY-MM-DD'` — idempotency marker for the
  day-rollover reconcile.

### 5.2 Retired

- `stats.streak` / `stats.lastVisit` increment logic
  ([App.jsx:226-243](../../../src/App.jsx)) — the streak becomes derived. (`stats`
  may remain for `learnedCount`; the streak field is no longer authoritative.)
- The `streak % 7` milestone effect ([App.jsx:84-91](../../../src/App.jsx)).

### 5.3 Derived (never stored)

`currentStreak`, `freezesAvailable`, `multiplier`, and `xpForDay` (now
`base + bonusXp`).

## 6. Core module — `src/lib/streak.js` (pure, I/O-free)

- `qualifies(day, goal)` → `xpForDay(day) >= goal`.
- `currentStreak(daily, frozenDays, goal, today)` → walk days **backward** from
  today; count qualifying days; bridge a non-qualifying day **iff** it's in
  `frozenDays`; stop at the first unbridged gap. Today counts the moment it
  qualifies; until then the streak is the run ending yesterday (still "alive" today).
- `multiplier(streakLen)` → from `MULTIPLIER_TIERS`.
- `freezesAvailable(streakLen, spentInRun)` →
  `clamp(floor(streakLen / earnEveryDays) − spentInRun, 0, maxHeld)` (freezes are
  scoped to the current run).
- `reconcile(state, today)` → **pure**; processes whole days elapsed since
  `lastReconcileDay` (excluding today): for each missed (non-qualifying) day, if a
  freeze is available record it in `frozenDays`, else the run breaks (the walk stops
  there). Returns updated `{ frozenDays, bestStreak, lastReconcileDay }`. **Idempotent.**

`xpForDay` (in `gamification.js`) gains `+ (day.bonusXp ?? 0)`, so
`totalXp` / `todayXp` — and therefore levels — include the bonus.

## 7. Surfaces & moments

### 7.1 Header

- Flame pill: current streak; **pulses when today is unsecured** and a run is at risk
  (revived `streakPulsing`, now = "today not yet qualifying").
- `❄️ ×N` freeze indicator near the flame.
- `GoalRing`: animate `strokeDashoffset` (CSS transition) + a small pop on `met`.

### 7.2 In the play loop (Translate; pattern reusable by other tabs)

- A slim goal strip — `🔥{streak} · {todayXp}/{goal}` — that fills as you answer.
- `FeedbackPanel` shows the multiplier flourish: **`+{base+bonus} ×{mult}🔥`** on
  correct/almost.

### 7.3 Moments (reuse Toast + Confetti + sound)

- Streak **secured** today → "🔥 Streak → N".
- **New record** (`currentStreak > bestStreak`) → "Neuer Rekord!".
- **Milestone reached** (`STREAK_MILESTONES` — 3/7/14/30/50/100) → bigger confetti burst.
- **Multiplier tier-up** → "×1.5 XP-Boost!".
- **Freeze earned** → "❄️ Streak-Freeze".
- **Freeze used** (surfaced next open) → "Freeze used — streak saved" (loss-aversion payoff).
- **At-risk nudge** on open when unsecured → tasteful banner.
- **Lapsed** (returned after a real break) → gentle, non-punishing reset notice.

Sounds reuse `playGoalMet` / `playAchievement` / `playLevelUp` (optional new
`playStreak`). Sound defaults OFF — changing that default is **out of scope** here.

## 8. Data flow

1. Answer → `recordEvent(tab, level, verdict)` ([stats.js](../../../src/lib/stats.js)):
   compute `mult = multiplier(currentStreakLen)` (the established run as of _before_
   today secures), `bonus = round(base × (mult − 1))`,
   write `daily[today].bonusXp += bonus`, dispatch `deutsch:progress` (event unchanged).
2. `App.applyProgress` (existing listener): run `reconcile` once per new day;
   recompute derived streak/level/goal; **diff against previous** to fire the new
   celebration toasts — the exact pattern already used for level/achievement/goal.
   First run backfills silently (no toast flood) and seeds `bestStreak`.
3. Retire the old streak effect + `%7` milestone effect.

## 9. Sync correctness

- `daily[d].bonusXp`: additive delta-sync already handles it (`combine()` walks all
  leaves; counters sum). **No adapter change.**
- `mergeSettings` ([merge.js](../../../src/lib/sync/merge.js)): extend the accumulative
  carve-out (today only `learnedWords`):
  - `frozenDays` → union (word-style).
  - `bestStreak` → `Math.max`.
  - `achievements` → union (**hardens a latent LWW drop present today**).
  - `lastReconcileDay` → keep LWW (reconcile is idempotent, so most-recent is fine).
- `adapters.js` `settingsToRow` / `settingsFromRow`: add `frozenDays`, `bestStreak`,
  `lastReconcileDay`.
- Sync is currently **OFF in prod** — this keeps B2.3 go-live unaffected and correct
  when sync is later enabled.

## 10. Edge cases

- **Goal changes** retroactively re-qualify history (current goal applies to all
  days). Simple, derivable, acceptable; documented behavior.
- **Day boundaries** use local date (`todayKey`) — matches existing behavior.
- **Reconcile idempotency** via `lastReconcileDay`; safe across repeated opens/devices.
- **Cross-device freeze "waste":** after sync, summed daily XP may make a
  previously-missed day qualify on its own; a stale `frozenDays` entry there is
  harmless (the day qualifies regardless).
- **First-run backfill:** derive streak/`bestStreak` from history silently; no
  celebration flood (mirror the existing `firstRun` guard in `applyProgress`).
- **Rollout:** the displayed streak may **drop** (login-streak → practice-streak).
  Seed `bestStreak = max(historicalBest, priorStoredStreak)` so the record is never
  "lost" in the transition.

## 11. Testing

- Pure unit tests (Vitest, `globals:false`) for `streak.js` (qualifying, backward
  walk, freeze bridging, multiplier tiers, `freezesAvailable`, reconcile idempotency,
  goal-change, day boundaries) and `gameConfig` wiring.
- `merge.js` tests for the new carve-outs (frozenDays union, bestStreak max,
  achievements union).
- Component tests: `FeedbackPanel` flourish, header at-risk pulse, in-play goal strip,
  `GoalRing` animation; `prefers-reduced-motion` honored.
- Full suite stays green; lint + `format:check` pass; land via branch → PR → review
  per AGENTS.md.

## 12. Phasing (for the implementation plan)

Shippable in slices, each independently valuable:

1. **Foundation** — `gameConfig` + `streak.js` + derived streak wired into every
   reader (header, `gamificationContext`, Stats snapshot); retire the buggy counter;
   `bestStreak`. (Honesty, no drama yet.)
2. **Surfaces** — in-play goal strip, revived flame/at-risk cue, `GoalRing` animation,
   streak-secured + record celebrations.
3. **Freeze** — earn/hold/auto-spend, `frozenDays`, freeze celebrations, sync carve-outs.
4. **Multiplier + bonus XP** — tiers, per-day `bonusXp`, `FeedbackPanel` flourish,
   tier-up celebration, level integration.

## 13. Out of scope (future, against these seams)

Quests / daily challenges, leagues / social, in-session combos, per-day goal history,
sound-on-by-default. The `gameConfig` + pure-module seams make each an additive change.
