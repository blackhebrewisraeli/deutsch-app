# Freezes from cumulative quest completions — extend the replay, add no inventory

- **Date:** 2026-08-31
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Depends on:** `2026-08-31-quest-targets.md` — **must land first** (§2.4).
- **Predecessor:** `2026-08-30-gamification-expansion.md` (#205–#207), which parked this.

---

## 1 · What this is

Streak freezes are currently earned one way: survive seven consecutive qualifying days. This epic
lets quest completions earn them too.

The brief asked how to "unify the derived replay with a stored reward inventory without introducing
state drift." **The answer is that no inventory is needed, and the hybrid the question imagines
already exists in the codebase.**

---

## 2 · Ground truth (verified 2026-08-31, against code and production)

### 2.1 The freeze feature has never once fired in production

| | |
| --- | --- |
| days recorded in `stats_daily` | 12 |
| days meeting the 50 XP goal | **3** |
| longest consecutive qualifying run | shorter than `FREEZE.earnEveryDays` (7) |
| freezes ever earned | **0** |
| days ever rescued | **0** |

`simulateFreezes` grants one freeze per 7 **consecutive** qualifying days. Three qualifying days
have ever existed, and never adjacently. The ❄️ indicator has shown 0 for the life of the app.

> The qualifying-day count is 3, not the 4 measured earlier in the session: zeroing the 400 XP
> settlement-test artifact on 2026-08-30 dropped that day from 408 XP to 8, below the goal. The
> artifact had been manufacturing a qualifying day.

This reframes the epic. It is not "add a second faucet to a working economy" — it is **the first
route by which a freeze can realistically be obtained at all**, because the existing route requires
a week-long run that the freeze is supposed to protect. Today you must not need a freeze in order
to earn one.

The UI for this is already built and correct: `App.jsx:957` renders `❄️{count}`, gated on
`> 0`. **No component needs to change** — the indicator has simply never had a value to draw.

### 2.2 The derived/stored hybrid already exists — and it is a ratchet

`streak.js`:

```js
export function reconcile(state, today) {
  const sim = simulateFreezes(daily, goal, today);
  const frozenDays = { ...(g.frozenDays ?? {}), ...sim.frozenDays };   // UNION, never replace
  ...
}
```

`sync/merge.js` already carves `frozenDays` out of the whole-blob settings LWW:

```js
// gamification.frozenDays union + bestStreak max — a freeze or record earned
// on one device can't be dropped by the other device's older LWW write.
```

So today: the **balance** is derived from scratch on every read, and the **spend record**
(`frozenDays`) is stored, union-merged locally *and* across devices, and can only ever grow. That
is exactly the shape the brief was reaching for, and it was built two epics ago.

### 2.3 Quest completion is already a pure function of data that already syncs

`questHistory({ daily, userId })` reconstructs every past day's quest set from
`seedFor(userId, day)` and grades it against that day's counters. `daily` is additively merged;
`userId` is the account. **Both already sync, so a quest-derived freeze needs no new stored state
of any kind.**

### 2.4 It cannot be sized until the quest-target fix lands

The companion spec measures that a steady learner completes **0.93 of 3** quests a day under
today's targets, with 0.3 % perfect days. Any reward keyed on quests would essentially never pay
out. **Choosing a grant rate against the current targets would be calibrating to a bug.**

### 2.5 Summary

| Question asked | Verified answer |
| --- | --- |
| How do we store a reward inventory? | **We don't.** §2.3 — it's derivable. |
| How do we unify derived and stored? | **Already unified.** §2.2 — grant derived, spend ratcheted. |
| Where's the state drift? | **Not between devices.** Across catalogue *versions* — §4.2. |
| New table / column / migration? | **None.** |

---

## 3 · Design A — extend the replay

### 3.1 One new parameter, no new state

```js
simulateFreezes(daily, goal, upTo, { userId })
```

The function already walks the calendar forward from first activity to `upTo`. It gains a second
accumulator on that same walk: quest completions for each day, graded exactly as `questHistory`
grades them — `pickQuests(seedFor(userId, day))` against that day's counters and the same trailing
baseline. Every `FREEZE.earnPerQuests` cumulative completions grants a freeze, subject to the
existing `maxHeld` cap.

**D1: one pass, not two.** `questHistory` is deliberately a single fold — calling `deriveQuests` per
day re-scans and re-sorts the whole day map, O(n²), inside a function App evaluates during render.
The merged walk must preserve that. This is the one place the plan can quietly regress performance.

**D2: no storage, no column, no migration, no sync change.** If the plan finds it needs any of
these, the design has drifted and should stop.

### 3.2 The existing faucet stays

Quest grants are **additional**, not a replacement. The 7-consecutive-day rule keeps rewarding
consistency; quests reward engagement on days that don't hit the goal. They are different virtues
and the cap bounds the total either way.

---

## 4 · Design B — drift, which is the real question

### 4.1 Between devices: none, by construction

Inputs are `daily` (additive merge), `goal` and `userId`. Two devices holding the same merged
`daily` derive the same balance with nothing shared. This is the whole reason not to store an
inventory: a stored counter would need its own merge rule, and "number of freezes" is neither
LWW-safe (a stale device clobbers a grant) nor union-safe (it's a quantity, not a set).

### 4.2 Across catalogue versions: real, and this is the dangerous one

`questHistory` already documents it:

> changing QUEST_CATALOGUE retroactively changes what past days would have asked for, so this count
> can move.

Today that is harmless — it feeds a badge count, and App only ever **adds** to
`gamification.achievements`. Nothing can be taken away.

**Feeding it into freezes breaks that safety.** A catalogue edit could retroactively remove a
grant, un-rescue a bridged day, and **shorten a streak the learner has already seen**. That is
destructive, silent, and invisible to every multi-device test — it is a *time* drift, not a sync
drift.

### 4.3 The ratchet already resolves it — for the spend

Because `reconcile` unions the fresh simulation into stored `frozenDays`, and `mergeSettings` unions
it across devices, **a day once rescued stays rescued forever**, regardless of what a later
catalogue would compute. So:

| | source of truth | can it move? |
| --- | --- | --- |
| **grant** (how many earned) | derived | yes — and that's fine |
| **spend** (which days were rescued) | stored `frozenDays`, union | **no — only grows** |

The derived side may move; the stored side wins when they disagree. That is the unification, and it
needs no new machinery.

**D3: the plan must verify the ratchet actually holds under a catalogue change**, not assume it.
The union is in `reconcile`, and `reconcile` runs on day rollover — the plan should confirm there is
no path where a fresh `simulateFreezes` result reaches `frozenDays` *without* the union.

### 4.4 Residual: the unspent balance can still tick down

The ratchet protects rescued days, not the ❄️×N indicator. A catalogue change could drop a held
balance from 2 to 1 with no user action.

**D4: accept it, and do not fix it with storage.** A stored "freezes earned ever" floor is exactly
the inventory this design avoids, bought for a cosmetic indicator. Mitigate with discipline instead:
treat `QUEST_CATALOGUE` as **append-only** — never edit an existing entry's `id`, `target` or
`progress` in place; add a new entry and retire the old one. Add a test that pins a set of seeds and
fails if any existing entry's derived output changes, so an in-place edit is caught in CI rather
than in someone's streak.

> Note the interaction: the companion quest-target spec **does** change two targets in place. That
> is safe only because it lands *before* quest history feeds anything subtractive. This ordering is
> not a nicety — it is the reason the target fix must merge first.

---

## 5 · The number

`FREEZE.earnPerQuests = 14`, alongside `earnEveryDays` and `maxHeld` in `gameConfig.js`.

Measured against the proposed targets, 60 days, 200 seeded users:

| learner | completions/day | 1 freeze per 14 → |
| --- | --- | --- |
| steady, 10/day | 2.27 | one every **6.2 days** |
| varied, 6–14/day | 1.93 | one every **7.3 days** |

Both land on the existing 1-per-7-days cadence, so the second faucet **matches** the first rather
than flooding it — and `maxHeld = 2` still bounds the stock regardless of flow. 7 and 10 were also
measured (one per 3.1 and 4.4 days) and are too fast.

**This number is calibrated against a simulation, not against production**, because production has
one learner with 12 recorded days. It is a starting value to revisit, and the plan should say so
rather than presenting 14 as measured fact.

---

## 6 · What this epic does NOT need

- **No new stored state**, no inventory, no counter. §2.3.
- **No migration or schema change.**
- **No sync or merge change.** `frozenDays` already has its union carve-out. Any apparent need for
  one is a signal the design has drifted.
- **No change to `pickQuests`, the seed, or `questHistory`'s contract.**
- **No UI work.** The ❄️ indicator already exists and is already correct (§2.1).
- **No XP.** Quests grant no XP today (that was deliberate — `bonusXp` *is* league XP, and the best
  week on record is 206). A freeze is not XP and does not touch the league.

---

## 7 · Explicitly out of scope

- **Manual freeze spending.** Freezes are auto-spent by the forward walk. Letting a learner choose
  which day to rescue would make the spend a stored decision, which is a different epic.
- **Buying freezes**, or any other reward currency.
- **Showing quest history in the UI.** The count exists; surfacing it is separate.
- **Retiring the 7-consecutive-day rule.** §3.2.

---

## 8 · Testing

- **Stage it red.** A test that a learner with N quest completions holds a freeze must be observed
  failing before `earnPerQuests` exists. Five tests failing at one shared gate is one proven
  assertion, not five.
- **Determinism across devices**: same `(daily, goal, userId)`, two independent calls, identical
  `frozenDays` and balance. This is the property that replaces an inventory, so it must be asserted
  directly, not implied.
- **The ratchet survives a catalogue change.** Simulate a rescued day, mutate the catalogue so the
  grant no longer happens, re-run `reconcile`, and assert the day is **still rescued**. This is the
  single most important test in the epic — it is the one that proves §4.3, and the failure it guards
  against is a silently shortened streak. **Stage it red against a `reconcile` that replaces rather
  than unions.**
- **One pass, not n².** Assert `deriveQuests` is not called per-day inside the walk — or measure
  that the walk's cost is linear in recorded days. D1 is the kind of regression that ships green.
- **The cap still binds**: many completions cannot exceed `maxHeld`.
- **A freeze earned by quests actually bridges a miss**, and the streak survives — the end-to-end
  behaviour, not just the counter.
- **The existing faucet is unaffected**: the 7-consecutive-day path grants exactly what it does
  today with `userId` absent, so a signed-out learner's freezes do not change.
- **Fixture check before asserting**: the day map must be rich enough to *express* the failure —
  enough days, real counters, and a genuine miss to bridge. Ask what the fixture would need to
  contain to fail, and enrich it before writing the assertion.

---

## 9 · Phasing

| # | PR | Depends on | Visible |
| --- | --- | --- | --- |
| 0 | **quest-target fix** (separate spec) | — | yes |
| 1 | `simulateFreezes` takes `userId`, grants on cumulative completions; `earnPerQuests` in config | 0 | no |
| 2 | Thread `userId` through `reconcile` / `freezesAvailable` callers in App and stats | 1 | **yes** (❄️ can be non-zero) |

Phase 1 is pure and testable with no UI. Phase 2 is the wiring, and is where the stale-closure risk
lives: `userId` must be read at call time, not captured — the gamification epic already shipped a
bug where an empty-deps `applyProgress` evaluated quests against the guest seed.

---

## 10 · Open questions

1. **Is 14 right?** §5 — simulated, not observed. Revisit with real data.
2. **Should a quest-earned freeze be visually distinct** from a streak-earned one? Probably not
   worth the copy, but the learner going from ❄️×0 (forever) to ❄️×1 deserves *some* acknowledgement.
3. **Should `maxHeld` rise from 2** now that freezes are obtainable at all? Deliberately not
   proposed here — one change to the economy at a time, and the cap is what stops both faucets from
   compounding.
4. ~~Does the ❄️ indicator have a home?~~ **Answered — yes.** `App.jsx:957` renders `❄️{count}` with
   a `${count} streak freeze(s) held` title, gated on `game.freezes > 0`. The UI has been correct
   and complete since it shipped; it has simply never had a non-zero value to draw (§2.1). Nothing
   to build — this epic makes an existing indicator visible for the first time.
