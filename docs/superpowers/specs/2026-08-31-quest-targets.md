# Quest targets — the volume quest is unreachable by construction

- **Date:** 2026-08-31
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Predecessor:** `2026-08-30-gamification-expansion.md` (#205–#207), which shipped daily quests.
- **Successor:** `2026-08-31-freezes-from-quests.md` depends on this landing first.

---

## 1 · What this is

Daily quests shipped in #207 with targets that scale off the learner's own recent activity. The
scaling doctrine is right. One multiplier in it is not: **the volume quest asks for 1.2× the
learner's own median, so a learner with a consistent habit can never complete it — on any day,
ever.**

This is a one-line fix to two catalogue entries. It is written up as a spec because the *reason*
matters more than the diff, and because the measurement that found it should be recorded.

---

## 2 · Ground truth (verified 2026-08-31, by measurement)

### 2.1 The volume quest is a treadmill that speeds up as you walk

```js
{ id: 'answer-cards', target: (base) => Math.max(MIN_TARGET, Math.round(base * 1.2)) }
```

`base` is `recentBaseline` — the median of the trailing 7 recorded days' totals. So the target is
always ~1.2× what the learner actually does.

A learner who answers exactly 10 cards a day has `base = 10` and a target of **12**. They fail.
Tomorrow, still 10, `base` is still 10, target still 12. They fail again. The only way to complete
it is a 20% increase — and if they sustain it, the median rises and the target rises with it.

**The stable state of this quest is failure.** It is not hard; it is unreachable, and it is
unreachable specifically for the habit-builder the whole streak/goal system exists to reward.

### 2.2 The breadth quest asks for 3 of the 4 tabs

```js
{ id: 'practise-tabs', target: () => Math.min(3, TABS.length) }   // TABS.length === 4
```

A learner who works in Vokabeln and Übersetzen — a perfectly normal, focused habit — touches 2. The
quest wants 3 every day. Also never completable, for the same kind of learner.

### 2.3 Two dead groups out of four is worse than it sounds

`pickQuests` draws `QUEST_COUNT = 3` quests, at most one per `group`. There are exactly **four**
groups: `volume`, `accuracy`, `breadth`, `focus`.

Drawing 3 of 4 groups means **exactly one group is dropped each day**. With two of the four
unreachable, a steady learner needs the draw to drop one dead group *and* is still left holding the
other. A perfect day is not merely unlikely — for the steady learner it is arithmetically
impossible on every day where both dead groups are drawn.

### 2.4 Measured, not argued

60 consecutive days, 200 seeded user ids (the quest set is seeded per `(user, day)`, so one user id
is one sample, not the distribution):

| learner | quests completed / day (of 3) | perfect days |
| --- | --- | --- |
| **steady** — 10 answers/day, 2 tabs | **0.93** | **0.3 %** |
| **varied** — 6–14 answers/day, 3 tabs | 1.80 | 14 % |

The steady learner — the one with the *better* habit — does worse on quests than the scattered one.
That inversion is the bug in one line.

### 2.5 The original reasoning was right; only the multiplier overshot

`quests.js` says, correctly:

> Production averages 4 answers a day. A flat "answer 10 cards" would be unreachable on a typical
> day, and a board of unreachable goals is worse than no board.

That is exactly right, and relative targets are the correct response. The error is that `1.2×`
re-creates the very thing it was avoiding: a target above a typical day. It just hides it behind
the learner's own numbers.

---

## 3 · Design

### 3.1 D1 — the volume multiplier goes to 1.0

```js
target: (base) => Math.max(MIN_TARGET, Math.round(base))
```

`base` is a **median**, so by definition roughly half the learner's days meet or beat it. That is
precisely the right bar for a daily quest: completable on a typical-or-better day, not free, and
not a treadmill.

**The rule this establishes, and the one to defend in review: a relative target must never exceed
1.0× the baseline it is derived from.** A multiplier above 1 applied to a self-referential baseline
is always a treadmill; the accuracy (0.6×) and focus (0.5×) quests are safe by this rule, and were
never broken.

### 3.2 D2 — breadth asks for 2 tabs, not 3

```js
target: () => Math.min(2, TABS.length)
```

Two tabs is a genuine breadth ask — it rules out a single-surface day — without demanding the
learner scatter across three quarters of the app daily.

### 3.3 What this is measured to do

Same method as §2.4, with the proposed targets:

| learner | now | proposed | change |
| --- | --- | --- | --- |
| **steady** | 0.93/day · 0.3 % perfect | **2.27/day · 27 % perfect** | **+144 %** |
| **varied** | 1.80/day · 14 % perfect | 1.93/day · 17 % perfect | +7 % |

This is the shape a fix should have: it moves the broken case a long way and the working case
barely at all. It is not a difficulty cut across the board.

---

## 4 · What this epic does NOT need

- **No migration, no schema change, no new column.** Quests are derived and stored nowhere.
- **No sync change.** Nothing about quests participates in merge semantics.
- **No new quest.** The catalogue is fine; two of its targets are not.
- **No change to `pickQuests`, the seed, or the group dedup.** All correct.

---

## 5 · Explicitly out of scope

- **Adding a fifth group.** §2.3 shows 4 groups / 3 draws is tight, and a fifth would loosen it —
  but that is a content decision, not a bug fix, and it would change every learner's board.
- **Excluding zero-activity days from `recentBaseline`.** Real production history has five
  consecutive zero-total days; the median over those floors to `MIN_TARGET`, making targets very
  easy right after a lapse. That is arguably *correct* (gentle re-entry) and changing it makes
  quests harder exactly when someone is returning. Recorded as an open question (§8.2), not
  changed here.
- **Retroactive effects.** Changing targets changes what past days *would have* asked for, so
  `questHistory().completed` moves. Today that only feeds a monotone badge count, so nothing can be
  taken away. This stops being harmless the moment quest history feeds anything subtractive — see
  the freezes spec, §4.2.

---

## 6 · Testing

- **Stage the treadmill red.** A test asserting a steady learner can complete the volume quest must
  be written against today's `1.2×` and observed to FAIL, or it proves nothing. One shared gate,
  one proven assertion — do not count five tests failing at the same gate as five.
- **The invariant, as a catalogue guard:** every relative target satisfies `target(base) <= base`
  for all `base >= MIN_TARGET`. This is the rule from §3.1 expressed as a test, and it fails loudly
  if anyone reintroduces a multiplier above 1. Sweep a range of baselines, not one value.
- **The steady learner reaches a perfect day.** Simulate the §2.4 steady profile across many seeds
  and assert perfect days are well above zero. A single seed is luck, not a measurement — the
  gamification epic already shipped one guard that passed by luck on one seed.
- **Breadth is completable on two tabs**, and still fails on one.
- **Mutation-test both changes**: restore `1.2` → the steady-learner test must fail; restore `3` →
  the breadth test must fail. A target change that no test notices is a target change with no test.
- **The floor still holds**: `MIN_TARGET` is respected at `base = 0` and `base = 1`.

---

## 7 · Phasing

One PR. Two catalogue lines, the invariant guard, and the staged-red regression test.

There is no phase 2. Resist bundling the freezes work into it — that spec depends on this one, and
merging them would mean shipping a reward whose payout rate was measured against the broken targets.

---

## 8 · Open questions

1. **Is 1.0× right, or should volume sit slightly below the median (0.9×)?** 1.0× yields 27 %
   perfect days for a steady learner, which feels healthy. Below 1.0× starts giving the quest away.
   Worth revisiting once there is more than one production learner.
2. **Should `recentBaseline` skip zero days?** §5. It changes what "typical" means, and the honest
   answer needs usage data that does not exist yet.
3. **Should the breadth target itself be relative** — say, "one more tab than you usually touch"?
   Elegant, but it is a treadmill by the exact §3.1 rule, so no.
