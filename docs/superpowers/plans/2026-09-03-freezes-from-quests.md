# Freezes from quest completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let cumulative daily-quest completions earn streak freezes, so a freeze is obtainable without already having the week-long streak the freeze exists to protect.

**Architecture:** `simulateFreezes` already walks the calendar forward from first activity to `upTo`. It gains a second accumulator on that same walk — quest completions per recorded day, graded exactly as `questHistory` grades them — and grants a freeze every `FREEZE.earnPerQuests` cumulative completions, subject to the existing `maxHeld` cap. **No new stored state, no column, no migration, no sync change, no UI work.** The grant is derived; the spend (`frozenDays`) is already stored and union-merged, which is the ratchet that makes a derived grant safe.

**Tech Stack:** Plain ES modules under `src/lib/`, React in `src/App.jsx`, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-freezes-from-quests.md` — read §2 (ground truth), §3 (design A), §4 (drift) and §8 (testing) before Task 1. Its dependency, `2026-08-31-quest-targets.md`, **has landed** (PR #226, `f173a90`).

## Global Constraints

- **No new stored state, no inventory, no counter, no migration, no schema change, no sync/merge change.** `frozenDays` already has its union carve-out in `sync/merge.js`. **If a task finds it needs any of these, the design has drifted — stop and report rather than adding one** (spec §6, D2).
- **No change to `pickQuests`, `seedFor`, or `questHistory`'s contract**, and no change to `QUEST_CATALOGUE` entries.
- **No UI work.** `src/App.jsx:998` already renders `❄️{game.freezes}` gated on `> 0`, and `:245` already fires a "Freeze genutzt / Streak gerettet" toast when one is spent. The indicator has simply never had a non-zero value to draw.
- **No XP.** Quests grant no XP; `bonusXp` is league XP. A freeze does not touch the league.
- **One pass, not n².** The merged walk must stay linear in recorded days. `questHistory` is deliberately a single fold; calling `deriveQuests` per day would re-scan and re-sort the whole day map inside a function App evaluates during render (spec D1).
- **`.husky/pre-commit` runs `npx lint-staged` AND the full `npm test`.** A task never ends red. **Never `--no-verify`**, never `git -c core.hooksPath=...`.
- **`main` takes no direct pushes** (`enforce_admins: true`, 4 required checks). Branch + PR.
- **Two PRs, in order** (spec §9). Tasks 1-3 are Phase 1 (pure, no visible change). Task 4 is Phase 2 (the wiring, where ❄️ can finally be non-zero).

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/lib/gameConfig.js` | Tunable game constants. | `FREEZE` gains `earnPerQuests: 14`. |
| `src/lib/quests.js` | Quest catalogue + derivation. | **Export `baselineFrom`** (today it is module-private). No logic change. |
| `src/lib/streak.js` | Streak + freeze derivation. | `simulateFreezes` and `reconcile` take an options bag; the walk gains a quest accumulator. |
| `src/lib/streak.test.js` | Freeze/streak tests (20 tests today). | New fixture + the epic's tests. |
| `src/lib/quests.test.js` | Quest tests (58 today). | One append-only catalogue guard. |
| `src/App.jsx` | The two call sites. | Thread `userId` (Task 4 only). |

Nothing is created.

---

## Pre-flight: what was measured before this plan was written (2026-09-03, `main` @ `f173a90`)

The core change was prototyped and run. These numbers are observed, not predicted.

**The feature works and is calibrated about where the spec said.** Fixture: 14 consecutive days, 10 answers each (5 `vocab` + 5 `translate`, all correct), built with the real `applyEvent`.

| scenario | result |
| --- | --- |
| goal 50 (every day qualifies) | 33 quest completions over 14 days = **2.36/day**; 2 freezes granted, both held (cap) |
| goal 500 (**no** day qualifies, so only quests can grant) | 2 freezes granted and **both spent bridging misses** — `frozenDays` has 2 entries |

2.36 completions/day against `earnPerQuests = 14` is **one freeze per 5.9 days**, against the spec's predicted 6.2. The existing faucet's cadence is 7. They match, as §5 intended.

**Three findings the spec does not mention. All three are load-bearing.**

1. **`baselineFrom` is not exported from `quests.js`.** It is module-private. The merged walk needs it to reproduce `questHistory`'s trailing-window baseline. Task 1 exports it.

2. **The existing `streak.test.js` fixtures cannot express this feature.** They are hand-written `{ byLevel: { a1: { correct: 5 } } }` objects with **no `total` and no `byTab`**. Measured: 14 days of that fixture yields **6** quest completions, not 0 — the accuracy quest reads `byLevel` and passes, while volume, breadth and focus all read fields the fixture lacks and score 0. Six is under the threshold of 14, so **a test written on the old fixture shows no freeze and looks like a working negative**. Every test in Tasks 1-3 must build days with the real `applyEvent`.

3. **`src/App.jsx` has a temporal-dead-zone trap on the Task 4 wiring.** `useAuth()` is at `:345` and `userIdRef` at `:350`, but `deriveGame` is invoked at `:136` by `useState(deriveGame)` — during the first render, before either exists. Reading `userIdRef` inside `deriveGame` throws `ReferenceError: Cannot access 'userIdRef' before initialization` and white-screens the app. `reconcile`'s call site at `:222` is inside a `useEffect`, so it is safe. Task 4 handles the two sites differently for this reason.

**One existing line that looks like a bug and is not.** In `simulateFreezes`'s run-break branch, `freezes = 0` is unreachable-as-written: the branch is the `else` of `freezes > 0`, so `freezes` is already 0. It is a no-op. **Do not "fix" it, and do not rely on it to wipe quest-earned freezes** — quest freezes are never wiped, they are spent bridging.

---

## Rulings this plan makes, which the spec leaves open

Each is a decision an implementer would otherwise have to guess at.

**R1 — a signed-out learner earns no quest freezes.** When `userId` is absent the walk skips quest grading entirely. Spec §8 requires that "a signed-out learner's freezes do not change", and `seedFor(undefined, day)` would otherwise happily grade a guest against the `'guest'` seed and change their balance. *Tension worth knowing:* guests DO see and complete quests, so this denies them a reward they can see themselves earning. It is the conservative reading, it keeps the change strictly additive, and signing in grants retroactively. Revisit as a product question, not a bug.

**R2 — the quest grant is applied before the qualify/spend branch**, so a freeze earned on a missed day can bridge that same day. This is what makes the feature reach the learner the spec is aiming at — the one who engages daily without hitting 50 XP. Measured: the goal-500 fixture bridges 2 days precisely because of this ordering.

**R3 — cumulative quest counters never reset**, including on a run break. "Cumulative completions" in §3.1 means over all history, matching `questHistory`. Only `run` resets.

---

## Task 1: The merged walk — `simulateFreezes` grants on cumulative quest completions

Implements spec §3.1 and D1. This is Phase 1's core.

**Files:**
- Modify: `src/lib/gameConfig.js:22`
- Modify: `src/lib/quests.js` (one `export` keyword)
- Modify: `src/lib/streak.js:76-95` (`simulateFreezes`) and `:99-107` (`reconcile`)
- Test: `src/lib/streak.test.js`

**Interfaces:**
- Consumes: `pickQuests(catalogue, seed, count?)`, `seedFor(userId, todayKey)`, `QUEST_CATALOGUE`, `BASELINE_DAYS`, and `baselineFrom(totals)` — all from `./quests.js`; `applyEvent(daily, dayKey, tab, level, verdict)` from `./stats.js`.
- Produces, for Tasks 2 and 4:
  - `simulateFreezes(daily, goal, upTo, opts?)` where `opts` is `{ userId?: string | null }`, returning `{ frozenDays: Record<string, true>, freezes: number }` — **the return shape does not change**.
  - `reconcile(state, today, opts?)` with the same `opts`, returning `{ frozenDays, bestStreak, lastReconcileDay }` — unchanged shape.
  - `freezesAvailable(state, today, opts?)` with the same `opts`, returning `number`.
  - A module-scope test helper `questfulDays(startDay, days)` in `streak.test.js`.

- [ ] **Step 1: Export the baseline helper**

`src/lib/quests.js`, the line reading `function baselineFrom(totals) {` — add `export`:

```js
/** Median of a set of day totals, floored — the shared rule for every target. */
export function baselineFrom(totals) {
```

Nothing else in that file changes. This is additive: `questHistory` and `recentBaseline` keep using it exactly as before.

- [ ] **Step 2: Add the config constant**

`src/lib/gameConfig.js:22` — from:

```js
export const FREEZE = { earnEveryDays: 7, maxHeld: 2 };
```

to:

```js
// earnEveryDays: the original faucet — 7 consecutive qualifying days.
// earnPerQuests: the second faucet — cumulative daily-quest completions. 14 is
// calibrated against a SIMULATION, not production (which has one learner and 12
// recorded days): a steady learner completes ~2.3 quests/day, so 14 lands one
// freeze per ~6 days, matching the 7-day cadence of the original faucet rather
// than flooding it. Revisit with real data. maxHeld bounds the stock either way.
export const FREEZE = { earnEveryDays: 7, maxHeld: 2, earnPerQuests: 14 };
```

- [ ] **Step 3: Write the failing test**

Add this fixture at module scope in `src/lib/streak.test.js`, beneath the existing `week` helper. `applyEvent` is NOT yet imported there — add `import { applyEvent } from './stats';` beside the existing `./streak` import.

```js
// Days rich enough to COMPLETE quests. The hand-written `qual` fixture above
// carries only `byLevel`, so volume/breadth/focus quests all score 0 against it
// and 14 days of it yields 6 completions — under the threshold, which makes a
// missing feature look like a working negative. These are built with the real
// applyEvent: 10 answers a day over two tabs.
function questfulDays(startDay, days) {
  let daily = {};
  for (let i = 0; i < days; i += 1) {
    const k = `2026-06-${String(startDay + i).padStart(2, '0')}`;
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, k, 'vocab', 'a1', 'correct');
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, k, 'translate', 'a1', 'correct');
  }
  return daily;
}
```

Then add this `describe` block at the end of the file:

```js
describe('freezes earned from quest completions', () => {
  // goal 500 is deliberately unreachable: 10 correct answers is 100 XP, so NO
  // day qualifies and the 7-consecutive-day faucet grants nothing. Any freeze
  // here can only have come from quests, which is what isolates the new path.
  const QUEST_ONLY_GOAL = 500;

  it('earns freezes from quests alone, on days that never meet the XP goal', () => {
    const daily = questfulDays(1, 14);
    const r = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    // 33 completions over 14 days / earnPerQuests 14 = 2 grants, and each is
    // spent bridging the miss on the day it lands (see R2 in the plan).
    expect(Object.keys(r.frozenDays).length).toBe(2);
  });

  it('grants nothing extra to a signed-out learner', () => {
    // R1: no userId means no quest grading at all, so the guest balance is
    // exactly what it is today. This is the guard on "strictly additive".
    const daily = questfulDays(1, 14);
    const guest = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15');
    expect(guest).toEqual({ frozenDays: {}, freezes: 0 });
  });

  it('is deterministic — the property that replaces a stored inventory', () => {
    const daily = questfulDays(1, 14);
    const a = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    const b = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    expect(a).toEqual(b);
  });

  it('depends on the user, because their quest sets did', () => {
    const daily = questfulDays(1, 14);
    const u1 = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    const u2 = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u2' });
    expect(u1.frozenDays).not.toEqual(u2.frozenDays);
  });

  it('never exceeds maxHeld, however many quests are cleared', () => {
    // 28 full days accrue EIGHT grants between the two faucets (four from the
    // 7-day run, four from quest completions) and only maxHeld are ever held.
    // Asserted as an equality, not `<=`: measured, an uncapped walk reaches 8,
    // so `<=` would also pass on a broken cap that simply never granted.
    //
    // upTo is the day AFTER the last recorded day on purpose. Walking further
    // makes every unrecorded day a miss, which spends the held freezes bridging
    // them and lands the balance back at 0 — where `<=` passes for the wrong
    // reason entirely. This test was written that way first and caught here.
    const daily = questfulDays(1, 28);
    const r = simulateFreezes(daily, 50, '2026-06-29', { userId: 'u1' });
    expect(r.freezes).toBe(FREEZE.maxHeld);
  });

  it('bridges a real miss, and the streak survives it', () => {
    // The end-to-end claim, not the counter: 14 qualifying+questful days, then a
    // genuine miss, then a qualifying day. The miss must be rescued and the run
    // must span it.
    const daily = { ...questfulDays(1, 14), '2026-06-15': miss, ...questfulDays(16, 1) };
    const r = simulateFreezes(daily, 50, '2026-06-17', { userId: 'u1' });
    expect(r.frozenDays['2026-06-15']).toBe(true);
    expect(currentStreak(daily, 50, '2026-06-16', r.frozenDays)).toBe(16);
  });
});
```

`FREEZE` and `currentStreak` must be imported — `currentStreak` already is; add `FREEZE` via `import { FREEZE } from './gameConfig';`.

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npx vitest run src/lib/streak.test.js -t 'earns freezes from quests alone'`
Expected: **FAIL** — `AssertionError: expected 0 to be 2`. `simulateFreezes` ignores the 4th argument today, so no freeze is granted and `frozenDays` is empty.

These tests share one gate: they all go green on the same change, so they are **one** proven assertion between them, not six. The others exist to pin properties the spec names (determinism, the cap, the guest path, the end-to-end bridge), not to add independent proof.

- [ ] **Step 5: Implement the merged walk**

`src/lib/streak.js`. First extend the imports at the top of the file:

```js
import { xpForDay } from './gamification';
import { STREAK_MILESTONES, FREEZE, DEFAULT_GOAL, MULTIPLIER_TIERS } from './gameConfig';
import { QUEST_CATALOGUE, pickQuests, seedFor, baselineFrom, BASELINE_DAYS } from './quests.js';
```

Then replace `simulateFreezes` entirely:

```js
// Forward calendar walk from the first activity day to `upTo` (exclusive).
// TWO faucets, one pass:
//   - every FREEZE.earnEveryDays consecutive qualifying days, and
//   - every FREEZE.earnPerQuests cumulative daily-quest completions
// both grant a freeze, capped at FREEZE.maxHeld, and a freeze is spent to
// bridge a miss. A miss with no freeze breaks the run.
//
// The quest accumulator rides the SAME walk deliberately. Calling deriveQuests
// per day would re-scan and re-sort the whole day map — O(n²) — inside a
// function App evaluates during render. `window` is the trailing baseline,
// mirroring questHistory's `entries.slice(i - BASELINE_DAYS, i)` exactly.
//
// Pure + deterministic from (daily, goal, userId) — which is why a freeze needs
// no stored inventory: two devices holding the same merged `daily` derive the
// same balance with nothing shared.
export function simulateFreezes(daily, goal, upTo, { userId = null } = {}) {
  const keys = Object.keys(daily).sort();
  if (keys.length === 0) return { frozenDays: {}, freezes: 0 };
  let run = 0;
  let freezes = 0;
  let questsDone = 0;
  let questGrants = 0;
  const window = [];
  const frozenDays = {};
  for (let d = keys[0]; d < upTo; d = nextKey(d)) {
    // A signed-out learner earns no quest freezes (R1): seedFor would happily
    // grade them against the 'guest' seed, which would change a guest balance
    // that this epic promises not to touch.
    if (userId != null && Object.prototype.hasOwnProperty.call(daily, d)) {
      const base = baselineFrom(window);
      for (const q of pickQuests(QUEST_CATALOGUE, seedFor(userId, d))) {
        if (q.progress(daily[d]) >= q.target(base)) questsDone += 1;
      }
      window.push(daily[d]?.total ?? 0);
      if (window.length > BASELINE_DAYS) window.shift();
    }
    // Granted BEFORE the qualify/spend branch (R2), so a freeze earned on a
    // missed day can bridge that same day — which is the whole point for a
    // learner who engages daily without reaching the XP goal.
    while (Math.floor(questsDone / FREEZE.earnPerQuests) > questGrants) {
      questGrants += 1;
      freezes = Math.min(freezes + 1, FREEZE.maxHeld);
    }
    if (qualifies(daily[d], goal)) {
      run += 1;
      if (run % FREEZE.earnEveryDays === 0) freezes = Math.min(freezes + 1, FREEZE.maxHeld);
    } else if (freezes > 0) {
      freezes -= 1;
      frozenDays[d] = true; // bridge — the run survives
    } else {
      run = 0;
      freezes = 0; // run broke; freezes reset with it
    }
  }
  return { frozenDays, freezes };
}
```

Then thread the option through the two callers in the same file:

```js
export function reconcile(state, today, { userId = null } = {}) {
  const daily = state.daily ?? {};
  const g = state.gamification ?? {};
  const goal = g.goal ?? DEFAULT_GOAL;
  const sim = simulateFreezes(daily, goal, today, { userId });
```

```js
export function freezesAvailable(state, today, { userId = null } = {}) {
  const daily = state.daily ?? {};
  const goal = state.gamification?.goal ?? DEFAULT_GOAL;
  return simulateFreezes(daily, goal, today, { userId }).freezes;
}
```

Leave the rest of both functions exactly as they are.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run src/lib/streak.test.js`
Expected: **PASS** — the 6 new tests plus the 20 that were already there.

If `'grants nothing extra to a signed-out learner'` fails, the `userId != null` guard is missing and guests are being graded against the `'guest'` seed.

- [ ] **Step 7: Add the one-pass guard**

D1 is the regression that ships green — nothing about correctness catches it. Add this to the same `describe` block:

```js
  it('grades quests inline rather than calling deriveQuests per day', () => {
    // D1. deriveQuests re-derives the baseline by re-scanning the whole day map,
    // so one call per day makes this walk O(n²) inside a function App evaluates
    // during render. The walk must use pickQuests + a rolling window instead.
    // A static check, because the cost only shows up on a large day map and a
    // timing assertion would flake on a loaded machine.
    expect(streakSource).not.toMatch(/deriveQuests/);
  });
```

with this at the top of the file, beside the other imports:

```js
import { readFileSync } from 'node:fs';
const streakSource = readFileSync(new URL('./streak.js', import.meta.url), 'utf8');
```

- [ ] **Step 8: Prove the one-pass guard has teeth**

It is green when written. Mutate `src/lib/streak.js` — add `deriveQuests` to the import list from `./quests.js` — and run:

`npx vitest run src/lib/streak.test.js -t 'grades quests inline'`
Expected: **FAIL**. Then `git checkout -- src/lib/streak.js` and confirm `git status` shows it unmodified. Record the failure text.

- [ ] **Step 9: Run the full file and commit**

Run: `npx vitest run src/lib/streak.test.js` → **PASS**, 27 tests (20 existing + 6 + the one-pass guard).

```bash
git add src/lib/gameConfig.js src/lib/quests.js src/lib/streak.js src/lib/streak.test.js
git commit -m "feat(streak): quest completions earn freezes on the same calendar walk"
```

---

## Task 2: Prove the ratchet survives a catalogue change

Implements spec §4.3 and D3. The spec calls this "the single most important test in the epic": it is what stops a future catalogue edit from silently un-rescuing a day and shortening a streak the learner has already seen.

**Files:**
- Test only: `src/lib/streak.test.js`

**Interfaces:**
- Consumes: `reconcile(state, today, { userId })` from Task 1; `questfulDays(startDay, days)` from Task 1.
- Produces: nothing.

- [ ] **Step 1: Write the test**

Add to `src/lib/streak.test.js`, inside the existing `describe('reconcile + freezesAvailable', ...)` block:

```js
  it('keeps a day rescued even when nothing would grant that freeze today', () => {
    // §4.3, the ratchet. The GRANT is derived and may move when the catalogue
    // changes; the SPEND is stored and unions, so it only ever grows. A day the
    // learner already saw rescued must stay rescued forever — otherwise a
    // catalogue edit retroactively shortens a streak, silently, with no user
    // action and nothing in any multi-device test to catch it.
    //
    // '2026-05-01' is not in `daily` at all, so NO simulation over this state
    // could ever produce it. It can only survive by being unioned in.
    const state = {
      daily: questfulDays(1, 3),
      gamification: { goal: 50, frozenDays: { '2026-05-01': true }, bestStreak: 0 },
    };
    const r = reconcile(state, '2026-06-05', { userId: 'u1' });
    expect(r.frozenDays['2026-05-01']).toBe(true);
  });
```

- [ ] **Step 2: Prove it has teeth — it is green when written**

`reconcile` already unions, so this passes immediately and therefore proves nothing yet. Break the union and watch it fail.

Mutate `src/lib/streak.js` — in `reconcile`, change:

```js
  const frozenDays = { ...(g.frozenDays ?? {}), ...sim.frozenDays };
```

to:

```js
  const frozenDays = { ...sim.frozenDays };
```

Run: `npx vitest run src/lib/streak.test.js -t 'keeps a day rescued'`
Expected: **FAIL** — `expected undefined to be true`.

Then restore: `git checkout -- src/lib/streak.js`, and confirm `git status` shows it unmodified before continuing. **Record the exact failure text.** If it does not fail, the test is not reaching the union and is worthless.

- [ ] **Step 3: Confirm there is no path that skips the union**

D3 says to verify this rather than assume it. Search for every write to `frozenDays`:

```bash
grep -rn "frozenDays" src --include="*.js" --include="*.jsx" | grep -v test
```

Expected: writes occur only in `streak.js` (`simulateFreezes` building its own local map, and `reconcile` doing the union) and in `App.jsx` around `:219-226`, where `nextG.frozenDays` is assigned either `rec.frozenDays` (post-union) or the previous value unchanged. Confirm in your report that no other site assigns a raw `simulateFreezes(...).frozenDays` into stored state. If one exists, that is a Critical finding — report it rather than fixing it.

- [ ] **Step 4: Run the file and commit**

Run: `npx vitest run src/lib/streak.test.js` → **PASS**, 28 tests.

```bash
git add src/lib/streak.test.js
git commit -m "test(streak): a rescued day survives a catalogue that no longer grants it"
```

---

## Task 3: Pin the catalogue so an in-place edit is caught in CI

Implements spec §4.4 (D4). The ratchet protects rescued days but not the unspent balance — a catalogue edit can still drop ❄️×2 to ❄️×1 with no user action. The spec's chosen mitigation is discipline plus a guard, **not** stored state.

**Files:**
- Test only: `src/lib/quests.test.js`

**Interfaces:**
- Consumes: `QUEST_CATALOGUE` — already imported in that file.
- Produces: nothing.

- [ ] **Step 1: Write the guard**

Add to `src/lib/quests.test.js`, inside `describe('the catalogue itself', ...)`:

```js
  it('is append-only — an existing entry never changes what it derives', () => {
    // Quest history is replayed from the CURRENT catalogue, so editing an entry
    // in place retroactively changes what past days asked for. Once freezes are
    // derived from that history, an in-place edit can silently drop a learner's
    // held balance. The rule: never edit an existing entry's id, target or
    // progress — add a new entry and retire the old one.
    //
    // These are the values as shipped. A deliberate change to the economy
    // updates this pin in the same commit, which is exactly the review moment
    // this test exists to force.
    const FOCUS = [2, 2, 2, 3, 4, 5, 9, 20, 50];
    const PINNED = {
      'answer-cards': [2, 3, 4, 5, 8, 10, 17, 40, 100],
      'get-correct': [2, 2, 2, 3, 5, 6, 10, 24, 60],
      'practise-tabs': [2, 2, 2, 2, 2, 2, 2, 2, 2],
      'focus-chat': FOCUS,
      'focus-alphabet': FOCUS,
      'focus-vocab': FOCUS,
      'focus-translate': FOCUS,
    };
    const bases = [2, 3, 4, 5, 8, 10, 17, 40, 100];

    const ids = QUEST_CATALOGUE.map((q) => q.id);
    for (const id of Object.keys(PINNED)) {
      expect(ids, `entry ${id} was REMOVED — retire, do not delete`).toContain(id);
    }
    for (const q of QUEST_CATALOGUE) {
      if (!PINNED[q.id]) continue; // a newly appended entry is fine
      expect(bases.map((b) => q.target(b)), `entry ${q.id} changed in place`).toEqual(PINNED[q.id]);
    }
  });
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `npx vitest run src/lib/quests.test.js -t 'append-only'`
Expected: **PASS**. The pinned values were computed from the shipped catalogue.

- [ ] **Step 3: Prove it has teeth, in both directions**

Green when written, so mutate twice.

Mutation A — edit an entry in place:
```bash
sed -i '' 's/Math.max(MIN_TARGET, Math.round(base \* 0.6))/Math.max(MIN_TARGET, Math.round(base * 0.7))/' src/lib/quests.js
npx vitest run src/lib/quests.test.js -t 'append-only'
```
Expected: **FAIL** — `entry get-correct changed in place`. Then `git checkout -- src/lib/quests.js`.

Mutation B — remove an entry. Temporarily change the `practise-tabs` entry's `id` to `'practise-tabs-v2'` and run the same test.
Expected: **FAIL** — `entry practise-tabs was REMOVED — retire, do not delete`. Then `git checkout -- src/lib/quests.js` and confirm `git status` is clean.

Record both failure texts.

- [ ] **Step 4: Run the file and commit**

Run: `npx vitest run src/lib/quests.test.js` → **PASS**, 59 tests.

```bash
git add src/lib/quests.test.js
git commit -m "test(quests): pin the catalogue so an in-place edit cannot move history"
```

**This is the end of Phase 1.** Open the PR for Tasks 1-3 before starting Task 4 — Phase 1 is pure and invisible, Phase 2 is the wiring that makes ❄️ non-zero, and the spec phases them separately so the derivation can be reviewed on its own.

---

## Task 4 (Phase 2): Thread `userId` through the two call sites

Implements spec §9's Phase 2. **This is where the stale-closure and TDZ risks live.** The two call sites are NOT symmetric — read the pre-flight finding 3 above before starting.

**Files:**
- Modify: `src/App.jsx` — `deriveGame` (~`:118-136`), the `reconcile` call (`:222`), the `setGame` call (`:293`), and one new effect after `:350`
- Test: none added — `src/App.test.jsx` already covers this surface; see Step 5

**Interfaces:**
- Consumes: `freezesAvailable(state, today, { userId })` and `reconcile(state, today, { userId })` from Task 1.
- Produces: nothing.

- [ ] **Step 1: Give `deriveGame` an explicit parameter**

**Do not read `userIdRef` inside `deriveGame`.** It is declared at `:350`; `deriveGame` is invoked at `:136` by `useState(deriveGame)` during the first render, so the reference throws `ReferenceError: Cannot access 'userIdRef' before initialization` and white-screens the app. Pass it in instead.

`src/App.jsx`, the `deriveGame` definition — change the signature and the one call:

```js
  // `userId` is a PARAMETER, not a closure read: this runs as the useState
  // initializer during the first render, before useAuth() and userIdRef exist
  // further down the component. Reading either from here is a TDZ crash.
  const deriveGame = (userId = null) => {
```

and inside it:

```js
      freezes: freezesAvailable(s, todayKey(), { userId }),
```

- [ ] **Step 2: Update the three call sites**

`:136` — the initializer runs before auth settles, so the first render is deliberately the guest value:

```js
  const [game, setGame] = useState(() => deriveGame(null));
```

`:293`, inside `applyProgress` — this is inside a `useEffect`, so `userIdRef` exists and is live:

```js
      setGame(deriveGame(userIdRef.current));
```

`:222`, also inside `applyProgress`:

```js
        const rec = reconcile(s, tKey, { userId: userIdRef.current });
```

**Use `userIdRef.current`, never `user?.id`, at both of these.** `applyProgress`'s effect has empty deps (`}, []`), so a captured `user` would be frozen at its first-render value — the gamification epic already shipped exactly that bug, evaluating quests against the guest seed. The ref is what fixes it.

- [ ] **Step 3: Re-derive when the account changes**

Without this, a learner who signs in keeps the guest ❄️ value until the next progress event. Add this effect immediately after the `userIdRef.current` assignment near `:351`:

```js
  // Freezes are now account-derived, and the first render is always the guest
  // value (deriveGame's initializer cannot see auth). Re-derive when the account
  // settles or changes, or a learner who signs in sees a stale ❄️ until their
  // next answer.
  useEffect(() => {
    setGame(deriveGame(userIdRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
```

- [ ] **Step 4: Verify no other call site was missed**

```bash
grep -n "freezesAvailable\|reconcile(" src/App.jsx
```

Expected: exactly the two call sites above, both now passing `{ userId: ... }`. If a third exists, it was added since this plan was written — report it.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: **PASS**.

This task adds no test of its own, because `src/App.test.jsx` already carries the one that matters. It seeds ~14 qualifying days and asserts `getByTitle(/streak freeze/i)` renders in the header (around `:426`, with the fixture at `:135`). That is a **signed-out** scenario, so it passes only if the original 7-consecutive-day faucet still grants exactly what it grants today with no `userId` — which makes it the regression guard on R1. If it fails, the guest path is no longer additive.

**If any App test fails with `Cannot access 'userIdRef' before initialization`**, Step 1 was not followed and `deriveGame` is reading the ref instead of its parameter.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(streak): freezes are account-derived, so the indicator can finally be non-zero"
```

---

## Opening the PRs

Two PRs, in order. Phase 1 (Tasks 1-3) is pure and changes nothing a learner sees; Phase 2 (Task 4) is what makes ❄️ appear.

- [ ] **Phase 1 PR** — after Task 3:

```bash
git push -u origin feat/freezes-from-quests
```

Title: `feat(streak): quest completions earn freezes (derivation only)`. The body should say: the freeze feature has never once fired in production (0 freezes ever earned, because earning one required the week-long streak it exists to protect); this adds a second faucet on the same calendar walk; no stored state, no migration, no sync change, no UI change; and that `earnPerQuests = 14` is calibrated against a simulation, not production.

- [ ] **Phase 2 PR** — after Task 4, based on Phase 1.

- [ ] **Wait for checks on each**: `gh pr checks --watch`. `BLOCKED` usually just means the 4 required checks are still running.

---

## Not in this PR

- **Manual freeze spending** — freezes are auto-spent by the forward walk; letting a learner choose which day to rescue makes the spend a stored decision, which is a different epic.
- **Buying freezes**, or any reward currency.
- **Raising `maxHeld` from 2** (spec §10.3) — one change to the economy at a time; the cap is what stops both faucets compounding.
- **Retiring the 7-consecutive-day rule** — the two faucets reward different virtues (spec §3.2).
- **Surfacing quest history in the UI**, or distinguishing a quest-earned freeze from a streak-earned one (spec §10.2).
- **Revisiting whether 14 is right** (spec §10.1) — it needs production data that does not exist yet.
