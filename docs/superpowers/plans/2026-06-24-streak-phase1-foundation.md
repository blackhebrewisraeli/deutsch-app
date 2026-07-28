# Streak & Daily-Goal Drama — Phase 1: Foundation (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the streak honest — derived from practice history instead of an app-open counter — introducing a `gameConfig` tunables module and a pure `streak.js`. No new UI or "drama" yet.

**Architecture:** Add `src/lib/gameConfig.js` (central balance knobs) and `src/lib/streak.js` (pure derivation). The buggy login-streak increment in `App.jsx` is replaced by `currentStreak(daily, goal, today)`. `stats.streak` becomes a **recomputed cache** of that derived value, so existing readers (header, `gamificationContext`, `getTodaySnapshot`) stay unchanged. `bestStreak` is tracked and seeded once (from history or the prior login-streak) so no record is lost.

**Tech Stack:** React 18, Vitest 2 (`globals: false`) + RTL, inline styles. No new dependencies.

## Global Constraints

- Tests: Vitest with `globals: false` — every test imports `{ describe, it, expect }` from `'vitest'`. Co-locate `*.test.js` next to source.
- Engine code (`src/lib/*`) stays **language-blind** — no German specifics.
- All balance knobs live in `gameConfig.js` — no magic numbers in `streak.js` or components.
- Date keys are local-date `'YYYY-MM-DD'` via `stats.todayKey`.
- Never bypass `.husky/pre-commit`. Work lands on branch `feat/streak-daily-goal-drama` → PR.

**Design decision (documented deviation from spec §5.3):** The spec prefers "derive, never store." Phase 1 keeps `stats.streak` as a recomputed *cache* of the derived value to minimize blast radius (readers unchanged). It is recomputed on load and on every `deutsch:progress` from the synced `daily` log, so it self-heals cross-device — no merge hazard. Pure derivation of all readers can be revisited in a later phase.

---

### Task 1: gameConfig tunables module

**Files:**
- Create: `src/lib/gameConfig.js`
- Create: `src/lib/gameConfig.test.js`
- Modify: `src/lib/gamification.js:9-11` (move the three constants out; re-export them)

**Interfaces:**
- Produces: `XP_PER_VERDICT`, `GOAL_PRESETS`, `DEFAULT_GOAL`, `QUALIFYING_DAY` from `gameConfig`.

- [x] **Step 1: Write the failing test** — `src/lib/gameConfig.test.js`

```js
import { describe, it, expect } from 'vitest';
import { XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL, QUALIFYING_DAY } from './gameConfig';

describe('gameConfig', () => {
  it('exposes XP per verdict', () => {
    expect(XP_PER_VERDICT).toEqual({ correct: 10, almost: 6, wrong: 3 });
  });
  it('exposes goal presets and the default', () => {
    expect(GOAL_PRESETS).toEqual({ casual: 20, regular: 50, serious: 100 });
    expect(DEFAULT_GOAL).toBe(50);
  });
  it('uses a goal-based qualifying-day rule', () => {
    expect(QUALIFYING_DAY).toBe('goal');
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run src/lib/gameConfig.test.js` → FAIL (`Failed to resolve import "./gameConfig"`).

- [x] **Step 3: Create `src/lib/gameConfig.js`**

```js
// gameConfig — central game-balance tunables. Change a knob here and it
// propagates. Mirrors theme.js (design tokens) and packs (content): one place
// to tune the game so gameplay stays easy to evolve.
export const XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 };
export const GOAL_PRESETS = { casual: 20, regular: 50, serious: 100 };
export const DEFAULT_GOAL = 50;

// A day counts toward the streak when its XP reaches the daily goal.
export const QUALIFYING_DAY = 'goal';
```

- [x] **Step 4: Move the constants in `gamification.js`.** Replace lines 9-11 (the three `export const` declarations) with a re-export, and import `XP_PER_VERDICT` for `xpForDay`:

```js
// near the top, after the existing imports:
import { XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL } from './gameConfig';
export { XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL };
```

(Leave `xpForDay`, `totalXp`, `todayXp`, `levelFromXp`, achievements, and `gamificationContext` unchanged — they keep using `XP_PER_VERDICT`, now imported.)

- [x] **Step 5: Run to verify** — `npx vitest run src/lib/gameConfig.test.js src/lib/gamification.test.js` → PASS (re-export keeps existing gamification tests green).

- [x] **Step 6: Commit** — `git add src/lib/gameConfig.js src/lib/gameConfig.test.js src/lib/gamification.js && git commit -m "feat(streak): add gameConfig tunables; move XP/goal constants"`

---

### Task 2: `streak.qualifies()`

**Files:**
- Create: `src/lib/streak.js`
- Create: `src/lib/streak.test.js`

**Interfaces:**
- Consumes: `xpForDay` from `gamification.js` (no cycle — gamification does not import streak).
- Produces: `qualifies(day, goal): boolean`.

- [x] **Step 1: Write the failing test** — `src/lib/streak.test.js`

```js
import { describe, it, expect } from 'vitest';
import { qualifies } from './streak';

// 5 correct = 50 XP; 4 correct = 40 XP
const day = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } } });

describe('qualifies', () => {
  it('is true when the day reaches the goal XP', () => {
    expect(qualifies(day(5), 50)).toBe(true);
  });
  it('is false below the goal', () => {
    expect(qualifies(day(4), 50)).toBe(false);
  });
  it('is false for a missing day', () => {
    expect(qualifies(undefined, 50)).toBe(false);
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run src/lib/streak.test.js` → FAIL.

- [x] **Step 3: Create `src/lib/streak.js`**

```js
// Streak derivation — pure, I/O-free. The streak is DERIVED from the daily log
// (consistent with how XP/levels work), never stored as a running counter.
import { xpForDay } from './gamification';

// A calendar day qualifies toward the streak once its XP reaches the goal.
export function qualifies(day, goal) {
  return xpForDay(day) >= goal;
}
```

- [x] **Step 4: Run to verify** — `npx vitest run src/lib/streak.test.js` → PASS.

- [x] **Step 5: Commit** — `git add src/lib/streak.js src/lib/streak.test.js && git commit -m "feat(streak): qualifies(day, goal)"`

---

### Task 3: `streak.currentStreak()`

**Files:**
- Modify: `src/lib/streak.js`, `src/lib/streak.test.js`

**Interfaces:**
- Produces: `currentStreak(daily, goal, today): number`.

- [x] **Step 1: Add failing tests** to `streak.test.js`

```js
import { currentStreak } from './streak';

const qual = { byLevel: { a1: { correct: 5, almost: 0, wrong: 0 } } }; // 50 XP
const miss = { byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } } }; // 0 XP

describe('currentStreak', () => {
  it('counts consecutive qualifying days ending today', () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': qual };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(3);
  });
  it("keeps the prior run alive while today hasn't qualified yet", () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': miss };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('breaks at a gap', () => {
    const d = { '2026-06-07': qual, '2026-06-09': qual, '2026-06-10': qual }; // 06-08 missing
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('is 0 when neither today nor yesterday qualifies', () => {
    expect(currentStreak({ '2026-06-08': qual }, 50, '2026-06-10')).toBe(0);
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run src/lib/streak.test.js` → FAIL (`currentStreak is not a function`).

- [x] **Step 3: Implement** — add to `streak.js`:

```js
// Previous local-date key ('YYYY-MM-DD' → the day before). UTC math avoids DST drift.
function prevKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function currentStreak(daily, goal, today) {
  let count = 0;
  // Today is "in progress": if it hasn't qualified yet, start from yesterday so
  // the prior run stays alive until midnight.
  let key = qualifies(daily[today], goal) ? today : prevKey(today);
  while (qualifies(daily[key], goal)) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}
```

- [x] **Step 4: Run to verify** — `npx vitest run src/lib/streak.test.js` → PASS (all 7).

- [x] **Step 5: Commit** — `git add src/lib/streak.js src/lib/streak.test.js && git commit -m "feat(streak): currentStreak(daily, goal, today)"`

---

### Task 4: `streak.bestStreakFromHistory()`

**Files:**
- Modify: `src/lib/streak.js`, `src/lib/streak.test.js`

**Interfaces:**
- Produces: `bestStreakFromHistory(daily, goal): number` — longest consecutive qualifying run ever.

- [x] **Step 1: Add failing tests** to `streak.test.js`

```js
import { bestStreakFromHistory } from './streak';

describe('bestStreakFromHistory', () => {
  it('finds the longest qualifying run', () => {
    const d = {
      '2026-06-01': qual, '2026-06-02': qual, '2026-06-03': qual, // run of 3
      '2026-06-05': qual, '2026-06-06': qual,                     // run of 2
    };
    expect(bestStreakFromHistory(d, 50)).toBe(3);
  });
  it('is 0 with no qualifying days', () => {
    expect(bestStreakFromHistory({ '2026-06-01': miss }, 50)).toBe(0);
  });
});
```

- [x] **Step 2: Run to verify it fails** — `npx vitest run src/lib/streak.test.js` → FAIL.

- [x] **Step 3: Implement** — add to `streak.js`:

```js
export function bestStreakFromHistory(daily, goal) {
  const days = Object.keys(daily)
    .filter((k) => qualifies(daily[k], goal))
    .sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    run = prev && prevKey(key) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}
```

- [x] **Step 4: Run to verify** — `npx vitest run src/lib/streak.test.js` → PASS.

- [x] **Step 5: Commit** — `git add src/lib/streak.js src/lib/streak.test.js && git commit -m "feat(streak): bestStreakFromHistory(daily, goal)"`

---

### Task 5: Wire the derived streak + bestStreak into `App.jsx`

Replaces the buggy login-streak counter with derivation; `stats.streak` becomes the recomputed cache; revives `streakPulsing`; tracks `bestStreak`.

**Files:**
- Modify: `src/App.jsx` (imports; load effect `226-245`; `applyProgress` `95-171`; `streakPulsing` `294-295`; the `g` default `98-103`)

**Interfaces:**
- Consumes: `currentStreak`, `bestStreakFromHistory`, `qualifies` from `streak.js`; `DEFAULT_GOAL` from `gamification` (already importable); `todayKey` from `stats` (already imported).

- [x] **Step 1: Add imports** near the other `lib` imports:

```js
import { currentStreak, bestStreakFromHistory, qualifies } from './lib/streak';
```

(`DEFAULT_GOAL` and `todayKey` are already imported.)

- [x] **Step 2: Replace the load effect's streak block** (`src/App.jsx:226-245`) so the streak is derived, not incremented:

```js
useEffect(() => {
  const s = loadState();
  if (s) {
    setLearnedWords(s.learnedWords || {});
    const today = todayKey();
    const goal = s.gamification?.goal ?? DEFAULT_GOAL;
    const streak = currentStreak(s.daily ?? {}, goal, today);
    const learnedCount = Object.values(s.learnedWords || {}).filter(Boolean).length;
    setStats({ streak, learnedCount, lastVisit: today });
  } else {
    setStats({ streak: 0, learnedCount: 0, lastVisit: todayKey() });
  }
}, []);
```

- [x] **Step 3: Add `bestStreak: 0` to the `g` default** in `applyProgress` (`src/App.jsx:98-103`):

```js
const g = s.gamification ?? {
  goal: DEFAULT_GOAL,
  soundOn: false,
  achievements: {},
  lastGoalMet: null,
  bestStreak: 0,
};
```

- [x] **Step 4: Recompute streak + bestStreak inside `applyProgress`.** After `const goal = goalProgress(...)` and before `saveState(...)`, add:

```js
const tStreak = currentStreak(s.daily ?? {}, g.goal, tKey);
const histBest = bestStreakFromHistory(s.daily ?? {}, g.goal);
// First run seeds the record from history or the prior (login-era) streak so it
// isn't "lost" when the streak switches to practice-based.
nextG.bestStreak = firstRun
  ? Math.max(g.bestStreak ?? 0, histBest, s.stats?.streak ?? 0)
  : Math.max(g.bestStreak ?? 0, histBest, tStreak);
setStats((prev) => ({ ...prev, streak: tStreak }));
```

(`nextG` already exists; `saveState({ ...s, gamification: nextG })` then persists `bestStreak`. The `setStats` update flows to the existing save effect, refreshing the `stats.streak` cache.)

- [x] **Step 5: Fix `streakPulsing`** (`src/App.jsx:294-295`). Move the existing `const liveState = loadState() ?? {};` (currently line 300) above this line, then:

```js
// Streak at risk: user has a run going but today hasn't qualified yet.
const goalNow = liveState.gamification?.goal ?? DEFAULT_GOAL;
const streakPulsing = stats.streak > 0 && !qualifies((liveState.daily ?? {})[todayKey()], goalNow);
```

- [x] **Step 6: Run the full suite** — `npm test`
  Expected: PASS. No reader changed signature, so `gamification.test.js` and `stats.test.js` stay green; `App.test.jsx` (a11y) is unaffected.

- [x] **Step 7: Manual smoke** — `npm run dev`, open the app: the header 🔥 reflects practice (do exercises to hit the goal → it ticks up), not mere visits; the flame pulses when today's goal isn't met yet.

- [x] **Step 8: Commit** — `git add src/App.jsx && git commit -m "feat(streak): derive the streak from practice history; track bestStreak"`

---

## Self-Review

- **Spec coverage (Phase 1 of §12):** `gameConfig` ✅ (Task 1) · pure `streak.js` with `qualifies`/`currentStreak` ✅ (Tasks 2–3) · derived streak wired into readers via the `stats.streak` cache ✅ (Task 5) · retire the buggy counter ✅ (Task 5, Step 2) · `bestStreak` ✅ (Tasks 4 + 5). Freeze, multiplier, surfaces, and celebrations are **later phases** (own plans).
- **Deferred deliberately:** `frozenDays`, `MULTIPLIER_TIERS`, `STREAK_MILESTONES`, the `%7` milestone retirement, and the in-play goal strip — all Phase 2+.
- **Type consistency:** `currentStreak(daily, goal, today)` and `bestStreakFromHistory(daily, goal)` signatures are used identically in Task 5. `qualifies(day, goal)` consistent throughout.
- **No placeholders:** every step has concrete code/commands.

## Execution Handoff

Phase 1 is small and tightly coupled to one developer's context (the App wiring), so **inline execution** is the natural fit. On completion: full suite green → open a `feat/streak-daily-goal-drama` PR for Phase 1, then plan Phase 2 (Surfaces & moments).
