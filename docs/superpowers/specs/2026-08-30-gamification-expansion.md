# Gamification & Engagement Expansion — daily quests, and what already exists

- **Date:** 2026-08-30
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Predecessors:** `2026-08-29-dashboard-and-settings-design.md` (MissionBoard),
  `2026-08-30-deck-scoped-learned-words.md` (`learned_by_deck`, shipped in #204).

---

## 1 · What this is

The brief names three things: **streaks**, **dynamic daily quests**, and **achievement milestones**.
Two of them already ship. This design covers the one that does not, extends the one that is
genuinely thin, and — because the question was asked explicitly — prices a reward structure against
the live XP economy rather than guessing at it.

It also reports a **live defect found while measuring that economy** (§2.5). It is not part of this
epic and should be looked at on its own.

---

## 2 · Ground truth (verified 2026-08-30, against code, the shipped lexicon, and production)

### 2.1 Streaks are complete. There is no streak work here

`lib/streak.js` already ships `qualifies`, `currentStreak`, `bestStreakFromHistory`,
`crossedMilestone`, `simulateFreezes`, `freezesAvailable`, `reconcile` and `multiplier`, with
`STREAK_MILESTONES`, `FREEZE` and `MULTIPLIER_TIERS` as tunables in `gameConfig.js`. The freeze/drama
arc landed across four phases.

Anything this epic does with streaks is a **new surface onto existing logic**, never new logic.

### 2.2 Achievements are already declarative — 12 of them

```js
{ id: 'streak7', category: 'streak', name: 'Wochenheld', icon: '🔥', test: (c) => c.streak >= 7 }
```

Twelve badges across four categories (streak, volume, mastery, league), tested against a
`gamificationContext`. `isOneStepAway` already drives the `badge-near` mission, so any badge added
gets "nearly there" nudging for free.

**Adding milestones is adding array entries and widening the context. It is not building a system.**

### 2.3 The seam: signals already collected, already synced, never read

| Signal | Read today by | Unused for |
| --- | --- | --- |
| `daily[day].byTab` | `trial.js` (tabsSampled), Stats | any quest or badge |
| `daily[day].byLevel[lvl][verdict]` | `AccuracyByLevel`, `xpCore` | accuracy / level-targeted goals |
| `srs` boxes 1–4 | nothing — only `box === 5` via `masteredCount` | "move cards out of box 1" |
| `learned_by_deck` | nothing in gamification (shipped #204) | per-deck milestones |
| `weekly_xp` | one mission (`league-position`) | league-tied goals |

`applyEvent` already writes `byTab` and `byLevel[level][verdict]` on **every answer**, and the whole
`daily` map already syncs. A quest over these costs one pure module and zero storage.

### 2.4 The XP economy is one shared function, and `bonusXp` reaches the league 1:1

```js
// lib/xpCore.js — "Single source for the daily-XP formula, used by both
// gamification.js (client) and the league weekly-XP helper (server)."
export function xpForDay(day) { /* Σ byLevel verdicts × XP_PER_VERDICT */ return xp + (day.bonusXp ?? 0); }
```

`weeklyXpFromRows` (server) calls **the same `xpForDay`**. So `bonusXp` is not a side channel: every
point written there lands in `weekly_xp` and moves league standings.

Two writers exist today — the streak multiplier inside `applyEvent`, and the 50 XP league-winner
bonus in `leagueRewards.js`.

**Any quest reward routed through `bonusXp` inflates the leagues by construction.** §4 is built
around that fact.

### 2.5 ⚠ Found while measuring: 1,900 unearned bonus XP sits in the current league week

Not part of this epic. Reported because it was found and it matters.

| | |
| --- | --- |
| current league period start | `2026-08-24` |
| `bonusXp` recorded in that period | **1,900** |
| answers recorded in that period | **0** |
| highest `weekly_xp` the league has ever recorded | **206** |
| standings last touched | `2026-08-23` — *before* the period began |

Six days carry round-number bonuses (900, 300, 200, 200, 200, 100) with **zero answers**. Neither
existing writer can produce that: the multiplier scales off answers, and the league bonus is 50 per
win.

**The origin is unknown to me** — most plausibly manual testing, since the dates track recent
development. What is certain is the consequence: `refresh` has not run since the period began, so
the next call computes `weeklyXpFromRows` = **1,900** for that member, roughly **9× the best week
the league has on record**, from no practice at all.

Two things follow. First, someone should decide whether to clear those six `bonusXp` values before
the next refresh. Second, and structurally: **the `bonusXp` channel is unguarded**, and it is
precisely the channel a naive quest reward would use.

### 2.6 Server load today is one weekly cron

`vercel.json` schedules exactly one job — `/api/v1/league/settle`, Mondays. Everything else in the
gamification stack is derived on the client from data that already syncs.

**This epic should add zero crons, zero endpoints and zero tables.** §3 shows why it can.

### 2.7 Summary

| Question | Verified answer |
| --- | --- |
| Build streaks? | **No** — complete, including freezes and multipliers. |
| Build an achievement system? | **No** — declarative and extensible; add entries. |
| Build daily quests? | **Yes** — the one genuinely new thing. |
| New tables / crons / endpoints? | **None.** Quests derive from data already synced. |
| Can quests grant XP? | **Not through `bonusXp`** — it is league XP (§2.4), and the league is far too small (§4.2). |

---

## 3 · Design A — daily quests as a pure function

### 3.1 A quest is derived, never stored

```
deriveQuests({ userId, todayKey, day, srs, learnedByDeck, decks }) → [{ id, target, progress, tab }]
```

Two inputs decide **which** quests today holds: a seed and the catalogue. Everything else decides
**how far along** they are.

```
seed  = hash(`${userId ?? deviceId}:${todayKey}`)
quests = pick(QUEST_CATALOGUE, seed, QUEST_COUNT)
```

Consequences worth being explicit about, because they are the whole argument:

- **Stable within a day.** The same seed all day, so the board cannot reshuffle under the reader's
  finger — the mistake `missions.js` already documents and avoids.
- **Identical across devices** without syncing anything: same user, same day, same set.
- **Offline by construction.** No network is consulted to know what today's quests are.
- **Nothing new is persisted**, so nothing new can desync. Given the last two epics were spent on
  LWW and union-merge semantics, the best property of this design is that it does not participate.

### 3.2 Progress is read, not written

Every quest's progress is a pure read over `daily[todayKey]`, which already syncs:

| Quest | Progress source |
| --- | --- |
| "Answer 10 cards" | `day.total` |
| "Practise in 3 different tabs" | `Object.values(day.byTab).filter(n => n > 0).length` |
| "Get 5 right at B1" | `day.byLevel.b1.correct` |
| "Clear your due pile" | `getDueCount(srs, decks, now)` |
| "Finish a deck" | `deckProgressFor(...)` |

**No quest needs a counter of its own.** That is what keeps this out of the sync engine entirely.
A quest whose progress cannot be derived from an existing counter should be cut rather than given
storage — that rule is the design's load-bearing constraint.

### 3.3 Guests

`userId` is absent for signed-out learners. Seed on a device-local id (or `todayKey` alone) — the
cross-device property is vacuous when there is only one device, and quests then work in the trial
exactly as they do for account holders.

### 3.4 Where it plugs in

`deriveQuests` as a **sibling** of `deriveMissions`, not an extension of it. Same purity contract,
same "ids and counts, never copy", copy in the pack.

The reason is scheduling semantics: missions rank by **urgency** under `MISSION_CAP = 5`, and quests
are about **variety**. Folding quests into that list lets a "practise in 3 tabs" quest push
`srs-due` off the board — a strictly worse product. One presentation layer, two derivations.

---

## 4 · Design B — the reward structure

The brief asks for rewards that do not destabilise the league. The measurement makes the answer
sharper than expected.

### 4.1 What the league can absorb

The highest `weekly_xp` ever recorded is **206**, and the average is 103.

Three daily quests at a modest 10 XP each is `3 × 10 × 7 = 210` XP a week — **more than the best
week the league has ever seen, earned without answering a single card.** There is no "small" XP
reward at this scale. The league is too young for quest XP, and no cap that is worth winning is also
small enough to be safe.

**Decision R1: quests grant no XP.** Not capped XP, not fractional XP — none, while the league is
this size. Revisit only when a real week's XP makes a cap meaningful.

### 4.2 What they grant instead

**Badges — the primary reward.** The `ACHIEVEMENTS` array is already declarative, already surfaced
in `BadgeGrid`, and already nudged by `badge-near`. A "completed 10 daily quests" badge is one array
entry plus one context field. **Zero economy impact, zero new state, zero server load.** This is the
whole recommendation for phase 1.

**Streak freezes — attractive, and more expensive than it looks.** I proposed these before reading
`simulateFreezes`, and the code corrects me: **freezes are derived, not stored.**

```js
export function freezesAvailable(state, today) {
  return simulateFreezes(state.daily ?? {}, goal, today).freezes;  // a pure replay of history
}
```

There is no freeze counter to increment. Granting one means introducing stored state and
reconciling it against a function that recomputes the number from scratch — **two sources of truth
for one value**, which is the drift `leagueZones.js` exists to prevent. It is doable (extend
`simulateFreezes` to fold in granted freezes as history events), but it is a design in its own right.

**Decision R2: freezes are phase 3, not phase 1**, and only with `simulateFreezes` extended so the
count stays single-sourced.

Second-order effect to state now: a freeze protects a streak, and streak length drives the XP
`multiplier` (up to 2.0×). So freezes touch the economy indirectly. `FREEZE.maxHeld = 2` bounds it,
but the link should be acknowledged rather than discovered later.

### 4.3 If XP is ever required anyway

It cannot go through `bonusXp` (§2.4). It would need a field `xpForDay` does not read — which also
means it would not count toward **level**, since `totalXp` uses the same function. Splitting them
breaks the "single source for the daily-XP formula" that `xpCore.js` exists to be, and puts client
and server on different definitions of XP.

**Recorded as rejected, with the reason**, so it is not rediscovered as a good idea later.

---

## 5 · Design C — achievement milestones over the unused signals

New badges need no machinery, only new context fields. Candidates, each from §2.3:

- **Breadth** — practised in all five tabs in one day (`byTab`).
- **Precision** — a day with ≥ 10 answers and zero `wrong` at B1 (`byLevel`).
- **Graduation** — N cards moved out of box 1 (`srs`, boxes currently unread).
- **Completionist** — a deck fully learned (`learned_by_deck`, currently unread).
- **Consistency** — N daily quests completed.

**One hard rule.** Mastery badges must read **SRS**, never `learnedWords`. `masteredCount` is
deck-scoped and correct; the flat map still over-marks — 25.1% of card ids appear in more than one
deck that can mark a word learned, until the phase-4 cleanup in the deck-scoping epic. A badge wired
to the flat map grants itself early. `words25`/`words50` already get this right; new badges must
match them.

---

## 6 · Explicitly out of scope

- **The 1,900 XP anomaly (§2.5).** Reported, not fixed. It needs a decision about existing data.
- **Guarding `bonusXp`.** The channel is unvalidated. Worth its own look, and a prerequisite if R1
  is ever revisited.
- **Phase-4 of deck-scoping** (stop mirroring, prune the flat map). Unrelated, still parked.
- **Any new table, cron or endpoint.** If the design appears to need one, that is a signal it has
  drifted from §3.2.

---

## 7 · Testing

- **Determinism across devices, not merely stability.** Assert two independent calls with the same
  `(userId, todayKey)` produce the identical set — that is the assertion that fails the moment
  someone reaches for `Math.random()`. Assert a *different* day produces a different set, or the
  first test passes against a constant.
- **Progress derivation per quest type**, against a `daily` fixture built from `applyEvent` rather
  than hand-written — a hand-written counter shape can drift from the real one and would not notice.
- **The economy guard, as an executable assertion:** run a full day of quest completions and assert
  `xpForDay` and `weeklyXpFromRows` are **unchanged**. That is R1 turned into a test, and it is the
  one that fails if someone later routes a reward through `bonusXp`.
- **Badge sources** — assert every new mastery badge moves with `srs`, and does **not** move when
  only `learnedWords` changes. Stage it red against a version reading the flat map.
- **Quests never crowd out missions** — assert `MISSION_CAP` still yields `srs-due` when a full
  quest set is open.

---

## 8 · Phasing

| # | PR | New storage | Server | Visible |
| --- | --- | --- | --- | --- |
| 1 | `lib/quests.js` — catalogue, seeded selection, progress derivation + tests | none | none | no |
| 2 | Quest board on Home, copy in the pack | none | none | **yes** |
| 3 | Quest-completion badges + the new context fields (§5) | none | none | yes |
| 4 | *(optional)* freezes as a reward, with `simulateFreezes` extended (§4.2) | one field | none | yes |

1 → 2 → 3 strictly ordered. Phase 4 is optional and should not be started until 1–3 have shipped and
the freeze-as-history design is written.

---

## 9 · Open questions

1. **How many quests a day, and do they refresh at local or UTC midnight?** `todayKey` is the
   existing day boundary; quests should use it rather than inventing a second one.
2. **What happens to an incomplete quest at midnight?** Silently replaced is simplest and matches
   "derived, not stored" — but it is a product call, and "you were 1 away" is a real nudge lost.
3. **Difficulty against real behaviour is currently unmeasurable.** Production has one account
   averaging **4 answers a day** (max 22). "Answer 10 cards" would be unachievable on a typical day
   for that learner. Targets should be **relative to recent activity** rather than absolute, or the
   board becomes a wall of failures. This is the single largest unknown in the design.
4. **Should §2.5's 1,900 XP be cleared before the next `refresh`?** Not this epic's call, but it
   wants an owner.
