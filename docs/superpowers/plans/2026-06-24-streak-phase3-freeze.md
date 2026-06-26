# Streak & Daily-Goal Drama — Phase 3: Streak Freeze (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** A missed day no longer kills the streak when a freeze is available. Freezes are auto-earned (1 per 7-day run, hold ≤2) and auto-spent on a miss. The only stored freeze state is `gamification.frozenDays` (which days a freeze rescued) — **union-merged** for sync safety; everything else is derived.

**Architecture:** `streak.js` gains a pure forward simulation `simulateFreezes(daily, goal, upTo)` → `{ frozenDays, freezes }` (walks the calendar, earning/spending freezes). `reconcile()` and `freezesAvailable()` are thin wrappers. `currentStreak` / `bestStreakFromHistory` gain a `frozenDays` arg that bridges rescued days. App runs `reconcile` on day-rollover and shows `❄️×N`. `merge.js` + `adapters.js` carry `frozenDays` (union) and `bestStreak` (max).

## Global Constraints

- Tests: Vitest `globals: false`. All knobs in `gameConfig`. Land on `feat/streak-drama-phases-2-4`.
- `frozenDays` is the canonical stored freeze state; `freezes` count is always derived (sync-safe).
- Sync is OFF in prod — these merge changes are correctness-for-later.

---

### Task 1: `FREEZE` config

**Files:** `src/lib/gameConfig.js` (+ test)

- [ ] Test: `expect(FREEZE).toEqual({ earnEveryDays: 7, maxHeld: 2 })`.
- [ ] Implement: `export const FREEZE = { earnEveryDays: 7, maxHeld: 2 };`
- [ ] Run → PASS. Commit `feat(streak): FREEZE config`.

---

### Task 2: `frozenDays` bridging in `currentStreak` / `bestStreakFromHistory`

A rescued day counts like a qualifying day. Add an optional `frozenDays` arg (default `{}` — back-compat).

**Files:** `src/lib/streak.js` (+ test)

- [ ] **Tests** (add to `streak.test.js`):

```js
it('currentStreak bridges a missed day that was frozen', () => {
  const d = { '2026-06-08': qual, '2026-06-09': miss, '2026-06-10': qual };
  expect(currentStreak(d, 50, '2026-06-10')).toBe(1); // without freeze: gap
  expect(currentStreak(d, 50, '2026-06-10', { '2026-06-09': true })).toBe(3); // bridged
});
it('bestStreakFromHistory bridges frozen days', () => {
  const d = { '2026-06-01': qual, '2026-06-02': miss, '2026-06-03': qual };
  expect(bestStreakFromHistory(d, 50, { '2026-06-02': true })).toBe(3);
});
```

- [ ] **Implement:** add a `counts(daily, frozenDays, goal, key)` helper = `qualifies(daily[key], goal) || !!frozenDays[key]`. Thread `frozenDays = {}` through both functions, replacing the `qualifies(...)` checks with `counts(...)`. (For `bestStreakFromHistory`, the candidate days become `Object.keys({ ...daily, ...frozenDays })` filtered by `counts`.)
- [ ] Run → PASS. Commit `feat(streak): frozenDays bridging in currentStreak/bestStreak`.

---

### Task 3: `simulateFreezes(daily, goal, upTo)` — the engine

Forward-walk the calendar from the first activity day up to (excluding) `upTo`, earning a freeze every `earnEveryDays` qualifying days (cap `maxHeld`) and spending one to bridge a miss; a miss with no freeze breaks the run (and resets the freeze balance). Returns `{ frozenDays, freezes }`.

**Files:** `src/lib/streak.js` (+ test)

- [ ] **Tests:**

```js
import { simulateFreezes } from './streak';

const days = (...keys) => Object.fromEntries(keys.map((k) => [k, qual]));

describe('simulateFreezes', () => {
  it('earns one freeze after a 7-day run', () => {
    const d = days('2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07');
    const r = simulateFreezes(d, 50, '2026-06-08'); // process 06-01..06-07
    expect(r.freezes).toBe(1);
    expect(r.frozenDays).toEqual({});
  });
  it('spends a freeze to bridge a single missed day', () => {
    // 7 qual days (earns 1 freeze), then a gap on 06-08, then nothing
    const d = days('2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07');
    const r = simulateFreezes(d, 50, '2026-06-09'); // 06-08 is a miss
    expect(r.frozenDays).toEqual({ '2026-06-08': true });
    expect(r.freezes).toBe(0);
  });
  it('breaks the run when a miss has no freeze to spend', () => {
    const d = days('2026-06-01','2026-06-02'); // only 2 qual days, no freeze earned
    const r = simulateFreezes(d, 50, '2026-06-05'); // 06-03/06-04 missed
    expect(r.frozenDays).toEqual({});
    expect(r.freezes).toBe(0);
  });
});
```

- [ ] **Implement:**

```js
import { FREEZE } from './gameConfig';

// Forward calendar walk from the first activity day to `upTo` (exclusive),
// auto-earning/spending freezes. Pure; deterministic from daily+goal.
export function simulateFreezes(daily, goal, upTo) {
  const keys = Object.keys(daily).sort();
  if (keys.length === 0) return { frozenDays: {}, freezes: 0 };
  let run = 0;
  let freezes = 0;
  const frozenDays = {};
  for (let d = keys[0]; d < upTo; d = nextKey(d)) {
    if (qualifies(daily[d], goal)) {
      run += 1;
      if (run % FREEZE.earnEveryDays === 0) freezes = Math.min(freezes + 1, FREEZE.maxHeld);
    } else if (freezes > 0) {
      freezes -= 1;
      frozenDays[d] = true; // bridge — run survives
    } else {
      run = 0;
      freezes = 0; // run broke; freezes reset with it
    }
  }
  return { frozenDays, freezes };
}
```

(Add a `nextKey(key)` helper — the inverse of `prevKey`.)

- [ ] Run → PASS. Commit `feat(streak): simulateFreezes engine`.

---

### Task 4: `reconcile()` + `freezesAvailable()`

**Files:** `src/lib/streak.js` (+ test)

- [ ] **Tests:**

```js
import { reconcile, freezesAvailable } from './streak';

it('reconcile produces frozenDays + bestStreak + lastReconcileDay', () => {
  const d = days('2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07');
  const state = { daily: d, gamification: { goal: 50, frozenDays: {}, bestStreak: 0, lastReconcileDay: '2026-06-07' } };
  const r = reconcile(state, '2026-06-09'); // 06-08 missed, one freeze bridges it
  expect(r.frozenDays).toEqual({ '2026-06-08': true });
  expect(r.lastReconcileDay).toBe('2026-06-09');
  expect(r.bestStreak).toBeGreaterThanOrEqual(7);
});
it('freezesAvailable reflects the earned balance', () => {
  const d = days('2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07');
  const state = { daily: d, gamification: { goal: 50 } };
  expect(freezesAvailable(state, '2026-06-08')).toBe(1);
});
```

- [ ] **Implement:**

```js
export function reconcile(state, today) {
  const daily = state.daily ?? {};
  const g = state.gamification ?? {};
  const goal = g.goal ?? 50;
  const sim = simulateFreezes(daily, goal, today);
  const frozenDays = { ...(g.frozenDays ?? {}), ...sim.frozenDays };
  const best = Math.max(g.bestStreak ?? 0, bestStreakFromHistory(daily, goal, frozenDays));
  return { frozenDays, bestStreak: best, lastReconcileDay: today };
}

export function freezesAvailable(state, today) {
  const daily = state.daily ?? {};
  const goal = state.gamification?.goal ?? 50;
  return simulateFreezes(daily, goal, today).freezes;
}
```

- [ ] Run → PASS. Commit `feat(streak): reconcile + freezesAvailable`.

---

### Task 5: App wiring — reconcile on rollover, pass frozenDays, freeze UI

**Files:** `src/App.jsx`, `src/components/UI.jsx` (StatBlock freeze indicator — optional minimal)

- [ ] Import `reconcile`, `freezesAvailable` (extend streak import).
- [ ] In `applyProgress`, after computing `g`, run reconcile once per new day:

```js
if (g.lastReconcileDay !== tKey) {
  const rec = reconcile(s, tKey);
  nextG.frozenDays = rec.frozenDays;
  nextG.lastReconcileDay = rec.lastReconcileDay;
  // (bestStreak still maxed below; rec.bestStreak folded in)
}
const frozenDays = nextG.frozenDays ?? g.frozenDays ?? {};
```

- [ ] Update the `tStreak`/`histBest` lines to pass `frozenDays`:
  `currentStreak(s.daily ?? {}, g.goal, tKey, frozenDays)` and `bestStreakFromHistory(s.daily ?? {}, g.goal, frozenDays)`.
- [ ] Update `deriveGame` to pass frozenDays + expose `freezes`:
  `streak: currentStreak(daily, goalXp, todayKey(), s.gamification?.frozenDays ?? {})`, `freezes: freezesAvailable(s, todayKey())`.
- [ ] Freeze toast: when `Object.keys(rec.frozenDays).length > Object.keys(g.frozenDays ?? {}).length` (a freeze was just spent) → push `{ kind: 'freeze', title: 'Freeze genutzt', sub: 'Streak gerettet', icon: '❄️' }` (non-firstRun only).
- [ ] Header: show `❄️ {game.freezes}` next to the streak when `game.freezes > 0` (small span in the header, near `StatBlock STREAK`).
- [ ] Run `npm test` → PASS. Commit `feat(streak): reconcile on rollover; frozen-day bridging; freeze UI`.

---

### Task 6: Sync merge — `frozenDays` union, `bestStreak` max

**Files:** `src/lib/sync/merge.js` (+ test)

- [ ] **Test** (extend `merge.test.js`): two settings blobs with different `frozenDays`/`bestStreak` → merged `frozenDays` is the union, `bestStreak` is the max.
- [ ] **Implement:** in `mergeSettings`, after the `learnedWords` union, also union `frozenDays` and take `Math.max` of `bestStreak`, attaching both to the returned object (mirror the learnedWords pattern; skip when neither side has them).
- [ ] Run → PASS. Commit `feat(streak): sync-merge frozenDays (union) + bestStreak (max)`.

---

### Task 7: Sync adapters — carry the new fields

**Files:** `src/lib/sync/adapters.js` (+ test)

- [ ] **Test** (extend `adapters.test.js`): `settingsToRow` includes `frozenDays`/`bestStreak`/`lastReconcileDay`; `settingsFromRow` reads them back into `gamification`.
- [ ] **Implement:** add `frozenDays`, `bestStreak`, `lastReconcileDay` to the `data` object in `settingsToRow` (from `local.gamification`) and into `gamification` in `settingsFromRow`.
- [ ] Run `npm test` → PASS. Commit `feat(streak): sync adapters carry frozenDays/bestStreak/lastReconcileDay`.

---

## Self-Review

- **Spec coverage:** freeze earn/hold/spend ✅ (Tasks 1,3,4) · frozenDays bridging ✅ (Task 2) · reconcile on rollover ✅ (Task 5) · freeze celebration + ❄️ UI ✅ (Task 5) · sync union/max ✅ (Tasks 6,7).
- **Derived freezes:** only `frozenDays` is stored; `freezes` always recomputed → sync-safe.
- **Types:** `simulateFreezes→{frozenDays,freezes}`, `reconcile→{frozenDays,bestStreak,lastReconcileDay}`, `currentStreak(daily,goal,today,frozenDays)` consistent across tasks + App.
