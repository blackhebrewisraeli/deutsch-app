# Quest targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the volume and breadth daily quests completable by a learner with a steady habit, by changing two target expressions in `QUEST_CATALOGUE` and guarding the rule that keeps them completable.

**Architecture:** Quests are derived, never stored — `deriveQuests` reads `QUEST_CATALOGUE` and the already-synced `daily` map on every render. So this epic is two expressions in one array literal plus tests. No migration, no schema change, no sync change, no new module, no component touched.

**Tech Stack:** Plain ES modules under `src/lib/`, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-quest-targets.md` — read §2 (ground truth) and §3 (design) before Task 1. The plan implements §3.1 (D1), §3.2 (D2) and §6 (testing).

## Global Constraints

- **`.husky/pre-commit` runs `npx lint-staged` AND the full `npm test`.** A task therefore can never end on a red test — each task stages its red, fixes it, and commits green. **Never use `--no-verify`**, and never `git -c core.hooksPath=...`, which silently skips husky 9's real hook path.
- **`main` takes no direct pushes.** Branch protection has `enforce_admins: true` and 4 required checks. Work on a branch and open a PR.
- **One PR for all three tasks** (spec §7). There is no phase 2, and the freezes epic must NOT be bundled in — it depends on this landing first and its payout rate must be measured against the fixed targets.
- **The rule this epic establishes, to defend in review:** *a relative target must never exceed 1.0× the baseline it derives from.* A multiplier above 1 applied to a self-referential baseline is always a treadmill.
- **Do not change** `pickQuests`, `hashSeed`, `seedFor`, `recentBaseline`, `baselineFrom`, `QUEST_COUNT`, `MIN_TARGET`, `BASELINE_DAYS`, or any `progress` function. Spec §4: all correct.
- **Do not add a fifth quest group** and **do not make `recentBaseline` skip zero-activity days.** Both are explicitly out of scope (spec §5, §8.2).
- **Copy stays in the pack.** A catalogue entry carries an id, a target and a way to measure — never a word the learner reads. `quests.test.js` has a guard that enforces this.

---

## File Structure

Two files. Nothing is created.

| File | Responsibility | Change |
| --- | --- | --- |
| `src/lib/quests.js` | The catalogue and the derivation. | Two `target` expressions (`:110`, `:126`) and two comment blocks. |
| `src/lib/quests.test.js` | The whole quest suite (54 tests today). | Three tests added; one stale comment corrected. |

`src/lib/stats.js` is read-only here — `TABS` and `applyEvent` are imported, never modified.

---

## Pre-flight: what was already measured (2026-09-01, on `main` @ `dbc95b6`)

Recorded so no one re-derives it, and so the "Expected: FAIL" lines below are known-true rather than assumed. Every test body in this plan was run against today's code and against the fix before the plan was written.

**The defect, reproduced independently of the spec.** 200 seeded learners, a steady profile of 10 answers/day split over `vocab` + `translate`, all correct, 14 days of history:

| | current (`1.2×` / 3 tabs) | after the fix (`1.0×` / 2 tabs) |
| --- | --- | --- |
| volume quest completed, when drawn | **0.0 %** (0 of 143 learners) | **100.0 %** |
| quests completed per day (of 3) | 1.16 | **2.52** |
| perfect days | **0.0 %** | 51.6 % |

**These are not the spec's §3.3 numbers** (0.93 → 2.27/day, 0.3 % → 27 % perfect) and they are not supposed to match: the spec does not state its fixture's verdict mix, and this one is all-correct, which makes the accuracy quest free. The *direction and the headline are confirmed* — the volume quest is completed by literally nobody with a steady habit. **Do not assert a specific percentage in any test.** Spec §6 says "well above zero"; the tests below assert exactly that.

**Fallout check: there is none.** With both catalogue lines changed, the full suite is **2446/2446 green, 195/195 files**. No component test, badge test, or `gamificationContext` test depends on the broken targets.

**One landmine, already located.** `src/lib/quests.test.js:393` — *"does NOT hand out a clean sweep every day for a steady learner"* — asserts `perfectDays < 5`. Measured under the fix: `perfectDays` is still `1`, so **the assertion keeps passing**. But its comment explains the result by the treadmill — *"a learner doing exactly their usual amount is asked for a little more"* — which is precisely the behaviour this epic removes. Task 3 rewrites that comment. Do not delete the test.

---

## Task 1: The volume multiplier goes to 1.0

Implements spec §3.1 (D1).

**Files:**
- Modify: `src/lib/quests.js:110`
- Test: `src/lib/quests.test.js` (add to the existing `describe('deriveQuests', ...)` block, which ends at `:300`)

**Interfaces:**
- Consumes: `deriveQuests({ userId, todayKey, daily })` → `Array<{id, target, progress, done, tab}>`; `applyEvent(daily, dayKey, tab, level, verdict)` → a new `daily` map, already imported at `quests.test.js:14`.
- Produces: a module-scope helper `steadyHistory(days)` in `quests.test.js`, reused by no other task (Tasks 2 and 3 are pure catalogue reads).

- [ ] **Step 1: Write the failing test**

Add this helper directly beneath the existing `answers` helper (`quests.test.js:28-29`), so it sits with the other fixtures:

```js
// The spec's §2.4 steady learner: 10 answers a day, every day, over two tabs.
// Built with the real applyEvent for the same reason dayWith is — a
// hand-written counter shape can drift from what the app stores.
function steadyHistory(days) {
  let daily = {};
  for (let i = 1; i <= days; i += 1) {
    const key = `2026-07-${String(i).padStart(2, '0')}`;
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, key, 'vocab', 'a1', 'correct');
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, key, 'translate', 'a1', 'correct');
  }
  return daily;
}
```

Add this test inside `describe('deriveQuests', ...)`, after the existing `'scales targets off recent activity rather than a flat number'` test:

```js
  it('lets a steady learner complete the volume quest — 1.2x made it unreachable', () => {
    // The bug this epic exists for: base is the learner's own median, so a
    // target of 1.2x base is a treadmill that speeds up as they walk. Measured
    // before the fix, 143 of 200 seeded learners were offered this quest and
    // exactly ZERO could ever finish it.
    //
    // Many seeds, not one: the quest set is seeded per (user, day), so a single
    // userId is one sample and proves nothing about the population.
    const daily = steadyHistory(14);
    let offered = 0;
    let completed = 0;
    for (let u = 0; u < 200; u += 1) {
      const volume = deriveQuests({ userId: `u${u}`, todayKey: '2026-07-14', daily }).find(
        (q) => q.id === 'answer-cards',
      );
      if (!volume) continue;
      offered += 1;
      if (volume.done) completed += 1;
    }
    // Assert the denominator too: "0 completed of 0 offered" and "0 of 143"
    // print identically at the assertion below, and only one of them is a bug.
    expect(offered).toBeGreaterThan(20);
    expect(completed).toBe(offered);
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/quests.test.js -t 'volume quest'`

Expected: **FAIL** — `AssertionError: expected +0 to be 143 // Object.is equality`. The `offered` assertion passes (the quest is drawn 143 times); the `completed` assertion is what fails, at zero. If instead `offered` is what fails, the fixture is wrong, not the code — stop and fix the fixture before touching `quests.js`.

- [ ] **Step 3: Change the multiplier**

`src/lib/quests.js:110`, inside the `answer-cards` entry — from:

```js
    target: (base) => Math.max(MIN_TARGET, Math.round(base * 1.2)),
```

to:

```js
    target: (base) => Math.max(MIN_TARGET, Math.round(base)),
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/quests.test.js -t 'volume quest'`
Expected: **PASS** (`completed === offered === 143`).

Then run the whole file: `npx vitest run src/lib/quests.test.js`
Expected: **PASS**, 55 tests. The pre-flight measured every one of the existing 54 as unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quests.js src/lib/quests.test.js
git commit -m "fix(quests): the volume target is the learner's median, not 1.2x it"
```

---

## Task 2: Breadth asks for two tabs, not three

Implements spec §3.2 (D2).

**Files:**
- Modify: `src/lib/quests.js:126`
- Test: `src/lib/quests.test.js` — the breadth test goes in `describe('the catalogue itself', ...)` (`:315-352`); the perfect-day test goes in `describe('deriveQuests', ...)`, beside Task 1's, since it needs the `steadyHistory` fixture

**Interfaces:**
- Consumes: `QUEST_CATALOGUE` (already imported); the `dayWith(events)` helper at `quests.test.js:19`, which returns a `daily` map keyed by `'2026-08-30'`; and `steadyHistory(days)` **from Task 1** — do not redefine it.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Add inside `describe('the catalogue itself', ...)`:

```js
  it('clears breadth on two tabs, and still fails on one', () => {
    // Breadth is about the shape of a day, not its size. Two tabs rules out a
    // single-surface day; three demanded the learner scatter across
    // three quarters of the app daily, which a focused habit never does.
    const breadth = QUEST_CATALOGUE.find((q) => q.id === 'practise-tabs');
    const twoTabs = dayWith([
      ['vocab', 'a1', 'correct'],
      ['translate', 'a1', 'correct'],
    ])['2026-08-30'];
    const oneTab = dayWith([['vocab', 'a1', 'correct']])['2026-08-30'];

    expect(breadth.progress(twoTabs)).toBeGreaterThanOrEqual(breadth.target());
    expect(breadth.progress(oneTab)).toBeLessThan(breadth.target());
  });
```

Add this second test directly beneath it. It is spec §6's "the steady learner reaches a perfect day", and it belongs in **this** task rather than Task 1: measured, perfect days run **0 % on today's code, 16 % with only Task 1 landed, and 48 % once breadth is fixed too**. Only this task's change gets it past the threshold.

```js
  it('lets a steady learner clear the whole board, which two dead groups prevented', () => {
    // The board draws 3 of 4 groups a day. With volume AND breadth both
    // unreachable, a steady learner needed the draw to drop one dead group and
    // was still left holding the other — a perfect day was arithmetically
    // impossible. Measured across these 200 seeds: 0% before this epic, 16%
    // with the volume fix alone, 48% with both.
    //
    // Deterministic, not statistical: the same 200 userIds on the same day
    // always draw the same boards, so this threshold cannot flake. It sits with
    // ~15 points of margin on either side of the two outcomes it separates.
    const daily = steadyHistory(14);
    let perfect = 0;
    for (let u = 0; u < 200; u += 1) {
      const board = deriveQuests({ userId: `u${u}`, todayKey: '2026-07-14', daily });
      if (board.length > 0 && board.every((q) => q.done)) perfect += 1;
    }
    expect(perfect).toBeGreaterThan(60);
  });
```

- [ ] **Step 2: Run both tests and watch them fail**

Run: `npx vitest run src/lib/quests.test.js -t 'clears breadth'`
Expected: **FAIL** — `AssertionError: expected 2 to be greater than or equal to 3`.

Run: `npx vitest run src/lib/quests.test.js -t 'clear the whole board'`
Expected: **FAIL** — `expected 32 to be greater than 60` (32 = 16 % of 200, the Task-1-only state).

**These two share a gate.** Both go green on the same one-line change, so they are *one* proven assertion between them, not two — the second exists because spec §6 asks for the end-to-end outcome to be asserted, not because it independently proves the fix.

Note the second assertion (a one-tab day must still fail) passes both before and after — it is there to stop the fix from sliding to `1`, which would make the quest free. It is not the staged red.

- [ ] **Step 3: Change the target**

`src/lib/quests.js:126`, inside the `practise-tabs` entry — from:

```js
    target: () => Math.min(3, TABS.length),
```

to:

```js
    target: () => Math.min(2, TABS.length),
```

Leave the `Math.min(…, TABS.length)` cap alone: it is what keeps the target honest if `TABS` ever shrinks.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/quests.test.js -t 'clears breadth'`
Expected: **PASS**

Then: `npx vitest run src/lib/quests.test.js` → **PASS**, 57 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quests.js src/lib/quests.test.js
git commit -m "fix(quests): breadth asks for two tabs, which a focused day can reach"
```

---

## Task 3: The invariant guard, and the comments that still describe the treadmill

Implements spec §6's catalogue guard, and corrects the two comment blocks that now state the opposite of what the code does. The guard is what stops the multiplier creeping back above 1.0 in a future PR.

**Files:**
- Modify: `src/lib/quests.js:17-22` (the `TARGETS ARE RELATIVE` header block)
- Modify: `src/lib/quests.test.js:393-401` (the stale comment inside `describe('questHistory', ...)`)
- Test: `src/lib/quests.test.js` (add to `describe('the catalogue itself', ...)`)

**Interfaces:**
- Consumes: `QUEST_CATALOGUE`, `MIN_TARGET` — both already imported at `quests.test.js:2-13`.
- Produces: nothing new.

- [ ] **Step 1: Write the guard**

Add inside `describe('the catalogue itself', ...)`, directly after the existing `'every entry floors its own target at MIN_TARGET…'` test:

```js
  it('never sets a target above the baseline it derives from', () => {
    // THE RULE. A multiplier above 1.0 on a self-referential baseline is a
    // treadmill: the learner's own median rises to meet the target, and the
    // target rises with it, so the stable state is failure. This is what the
    // 1.2x volume quest was, and it is what a future edit must not re-introduce.
    //
    // Swept across a range of baselines, not one value: a violating multiplier
    // can hide at base=2, where every entry's MIN_TARGET floor is doing the work.
    for (const q of QUEST_CATALOGUE) {
      for (const base of [MIN_TARGET, 3, 4, 5, 8, 10, 17, 40, 100]) {
        expect(q.target(base), `${q.id} at base=${base}`).toBeLessThanOrEqual(base);
      }
    }
  });
```

- [ ] **Step 2: Prove the guard has teeth, in both directions**

This test is **green the moment you write it**, because Tasks 1 and 2 already landed. A test that has never been observed red proves nothing, so mutate the code twice and watch it fail each time. Spec §6 requires both.

Mutation A — restore the volume multiplier:

```bash
sed -i '' 's/Math.max(MIN_TARGET, Math.round(base)),/Math.max(MIN_TARGET, Math.round(base * 1.2)),/' src/lib/quests.js
npx vitest run src/lib/quests.test.js -t 'never sets a target above'
```
Expected: **FAIL** — `answer-cards at base=3: expected 4 to be less than or equal to 3`.

```bash
git checkout -- src/lib/quests.js
```

Mutation B — restore the breadth target:

```bash
sed -i '' 's/Math.min(2, TABS.length),/Math.min(3, TABS.length),/' src/lib/quests.js
npx vitest run src/lib/quests.test.js -t 'never sets a target above'
```
Expected: **FAIL** — `practise-tabs at base=2: expected 3 to be less than or equal to 2`.

```bash
git checkout -- src/lib/quests.js
```

If either mutation leaves the guard green, the guard is inert — fix it before continuing. Confirm `git status` is clean of `quests.js` changes before Step 3.

- [ ] **Step 3: Correct the comment that still teaches the treadmill**

`src/lib/quests.js`, the `TARGETS ARE RELATIVE` block at `:17-22`. Append the rule so the next person to add a quest reads it in the file rather than in a spec:

```js
// TARGETS ARE RELATIVE
//
// Production averages 4 answers a day. A flat "answer 10 cards" would be
// unreachable on a typical day, and a board of unreachable goals is worse than
// no board. Targets scale off the learner's own recent activity, with a floor
// so a returning learner is not handed a target of zero.
//
// AND NEVER ABOVE 1.0x THE BASELINE. The volume quest shipped at 1.2x the
// learner's own median, which is a treadmill: doing more raises the median,
// which raises the target. Its stable state was failure, for exactly the
// habit-builder the streak system exists to reward — 0 of 143 seeded steady
// learners could ever complete it. The catalogue guard in quests.test.js
// enforces `target(base) <= base` so this cannot come back quietly.
```

- [ ] **Step 4: Correct the stale test comment**

`src/lib/quests.test.js:393-401`. The assertion is correct and still passes — measured `perfectDays === 1` under the fixed targets — but its comment explains the result by the treadmill. Replace the comment body, keeping the `it(...)` title and the assertion exactly as they are:

```js
  it('does NOT hand out a clean sweep every day for a steady learner', () => {
    // Not because the targets out-run the learner — they no longer do — but
    // because the board draws 3 of 4 groups, and the focus quest asks for half
    // the learner's whole median IN ONE TAB. A day spread over four tabs clears
    // volume, accuracy and breadth and still misses focus. Five identical days
    // are not five perfect days.
    const r = questHistory({ daily: historyOf(bigDay(), 5), userId: 'u1' });
    expect(r.perfectDays).toBeLessThan(5);
  });
```

- [ ] **Step 5: Run the whole file, then the whole suite**

Run: `npx vitest run src/lib/quests.test.js`
Expected: **PASS**, 58 tests.

Run: `npm test`
Expected: **PASS**, **195 files / 2450 tests**. Pre-flight measured 195/2446 green under the two-line fix, and this plan adds 4 tests to an existing file and creates none — so the *file* count must not move. If it did, you created a file this plan does not call for.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quests.js src/lib/quests.test.js
git commit -m "test(quests): guard the rule that a target never exceeds its baseline"
```

---

## Opening the PR

- [ ] **Push and open the PR**

```bash
git push -u origin fix/quest-targets-reachable
```

```bash
gh pr create --title "fix(quests): the volume quest is completable by a steady learner" --body "$(cat <<'EOF'
## Summary
- The volume quest asked for **1.2x the learner's own trailing median**, so a learner with a steady habit could never complete it — the median rises to meet any sustained increase, and the target rises with it. Measured before the fix: of 200 seeded steady learners, 143 were offered the quest and **0** could finish it, on any day.
- Breadth asked for 3 of 4 tabs daily; a focused two-tab habit never cleared it either. Two of four quest groups were dead, while the board draws 3 of 4 groups a day.
- Volume now targets `1.0x` the median (a median means roughly half the learner's days meet it — completable on a typical-or-better day, not free). Breadth asks for 2 tabs.
- A catalogue guard now enforces the general rule: **`target(base) <= base` for every entry**, swept across nine baselines. A multiplier above 1.0 on a self-referential baseline is always a treadmill; this fails loudly if one comes back.

Measured effect on the steady learner: volume completion **0% -> 100%**, quests/day **1.16 -> 2.52**. The varied learner barely moves — this is not a difficulty cut across the board.

No migration, no schema change, no sync change: quests are derived and stored nowhere.

Spec: `docs/superpowers/specs/2026-08-31-quest-targets.md`
Plan: `docs/superpowers/plans/2026-09-01-quest-targets.md`

## Test plan
- [ ] `npm test` green (195 files / 2450 tests)
- [ ] The guard was proven red in both directions — restoring `1.2` fails it, restoring `3` fails it
- [ ] Home board: a learner with history sees a volume target equal to their median, not above it
EOF
)"
```

- [ ] **Wait for checks before merging.** `BLOCKED` usually just means the 4 required checks are still running. Poll the rolled-up state rather than reading the checks list, which omits commit statuses like Vercel:

```bash
gh pr checks --watch
```

---

## Not in this PR

- **The freezes epic** (`docs/superpowers/specs/2026-08-31-freezes-from-quests.md`). It depends on these targets, and bundling it would mean shipping a reward whose payout rate was measured against the broken numbers. Start it only once this is merged.
- **`recentBaseline` skipping zero-activity days** (spec §5, §8.2) — it makes quests harder exactly when someone is returning from a lapse. Open question, needs usage data.
- **A fifth quest group** (spec §5) — a content decision that changes every learner's board.
- **Whether volume should sit at 0.9x rather than 1.0x** (spec §8.1) — revisit when there is more than one production learner.
