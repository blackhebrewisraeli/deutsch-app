# Grade the meaning drill against every gloss

**Status:** design, ready for a plan
**Date:** 2026-08-16
**Branch target:** `main` (currently `0bae74e`, 1357 tests)

---

## 1 · The bug

The typed meaning drill — the app's main loop — grades against **one** gloss:

```js
const { distance: dist } = fuzzyMatch(card.en, typedAnswer, ANSWER);   // VocabTab.jsx:158
```

`card.en` is `entry.en[0]`. `resolveCard` also preserves the full array as
`card.glosses`, and **no component reads it**.

`die Uhr` ships `["hours, o'clock", "clock, watch", "meter; gauge"]`. Measured
against the real grader:

| typed | verdict | distance |
|---|---|---|
| `clock` | **WRONG** | 9 |
| `watch` | **WRONG** | 13 |
| `clock, watch` | **WRONG** | 11 |
| `hours, o'clock` | correct | 0 |

A learner who answers "clock" for *Uhr* is told they are wrong.

**48% of entries — 2,037 of 4,201 — carry more than one gloss.** So the app
marks correct answers wrong across roughly half its vocabulary, using data it
already ships.

This is not a missing feature. It is the core exercise being wrong.

## 2 · The facts that shape the fix

**F1 — glosses are synonym runs, not single words.** Over 7,679 shipped glosses:

| separator | share |
|---|---|
| `,` | 36% |
| `;` | 6% |
| `·` | 3% |
| `/` | 1% |

So "accept any whole gloss" is **not sufficient**: typing `clock` would still
fail against the gloss `clock, watch` (distance 7). The answer set has to be the
glosses *split on those separators*.

**F2 — 8% of glosses are prose**, e.g. *"To confirm a preceding statement by
someone else: really, actually, indeed"*. Splitting these produces one junk
fragment plus several valid ones (`actually`, `indeed`). The junk is harmless —
nobody types it — and §3.3 explains why erring this way is right.

**F3 — the importer already trims glosses for answerability.**
`scripts/import-lexicon/cleanGloss.js` strips grammar labels and parentheticals
and caps synonym runs at `MAX_SYNONYMS = 3`. The remaining structure is
deliberate, so this fix reads what the importer chose to keep rather than
re-cleaning it.

**F4 — authored preset cards already carry `glosses`.** `resolveDecks` gives
`{ en: 'Hello', glosses: ['Hello'] }`, so one code path covers both card kinds.
A guard is still cheap.

**F5 — the widening is modest.** Accepted answers per card go from 1.0 to **2.7
on average**; the widest is `kassieren` at 15 (`to collect money`, `to earn`,
`cash in`, `to receive`, `get`, …). This is not a blanket loosening.

**F6 — the multiple-choice path is not affected.** `chooseOption` compares
`choice === card.en`, and the options are other cards' `en` values, so identity
is correct there: the learner is picking among displayed strings, not recalling.
Leave it alone.

## 3 · Design

### 3.1 One helper, in the engine

`src/lib/matching.js` gains:

```js
export function bestGlossMatch(glosses, given, rules = ANSWER)
```

returning the **minimum** `fuzzyMatch` distance across the candidate set, so the
existing `0 → correct`, `≤2 → almost`, else `wrong` bands keep working
unchanged. Only the candidate set widens.

`matching.js` is the right home: Phase 1.2 established that **the engine owns
matching against the user's language** while the pack owns target-language
rules. The glosses are English; splitting them on punctuation is engine work.

### 3.2 The candidate set

```
glosses → split on [,;·/] → trim → drop empties → dedupe
```

Plus the whole unsplit gloss, so `hours, o'clock` still matches exactly as it
does today. **Nothing that grades correct now may grade wrong after this** —
that is the regression bar in §6.

### 3.3 Err toward accepting

The asymmetry is not symmetric, and the design leans on that deliberately.

**A false rejection is expensive**: the learner is told a correct answer is
wrong, loses the card to the "again" queue, and learns nothing — the exact
failure this bug already produces 48% of the time.

**A false acceptance is cheap**: a self-study SRS with no score and no
competition; the worst case is a card spacing out slightly early, and it will
come back.

So the split is deliberately generous, and junk fragments from prose glosses
(F2) are accepted collateral rather than something to engineer away.

### 3.4 Show the meanings the learner did not give

Once several answers are right, the verdict should teach the rest. `VerdictPanel`
receives `answer={card.en}` today; for the meaning drill it becomes the full
gloss list, joined — "hours, o'clock · clock, watch · meter; gauge".

This is the part that turns the fix from "stops being wrong" into "teaches
more", and it is why the fix is worth doing beyond correctness.

**Scope guard:** the drills table (#108) owns `answer` for the four grammar
drills. This changes only the non-drill branch — the `: card.en` fallback.

## 4 · Out of scope

- Re-running the importer or changing `cleanGloss.js`. F3 — the trimming is
  already deliberate; this reads what it produced.
- The multiple-choice path (F6).
- The four grammar drills. Their answers are single-valued by nature.
- Showing all glosses on the **card face**. That would print the answer above the
  question — the mistake #105 and #106 both shipped. Verdict only.
- Any `localStorage` key change.

## 5 · Risks

**Over-acceptance on prose glosses.** "not X, but Y" style glosses split into
fragments that are not standalone meanings. Rare, and §3.3 says why it is the
right way to be wrong.

**`kassieren` accepts 15 answers.** A learner typing `get` is graded correct for
a verb that mostly means "to collect money". That is the source data's breadth,
not the grader's fault; the alternative is the current behaviour, which rejects
`to earn` as well.

**The verdict line can get long.** Three glosses of synonym runs is a wide
string on a 375px screen. The plan should check it wraps rather than overflowing
— the sideways-scroll bug in #90 came from exactly this kind of assumption.

## 6 · Verification

- **The regression bar: every answer that grades correct today still does.** A
  test over a sample of real shipped entries asserting `glosses[0]` always
  matches itself under the new grader.
- Unit tests for `bestGlossMatch`: the `die Uhr` table from §1 inverted (all four
  now accepted), the `almost` band preserved at distance ≤2, an empty/absent
  gloss list falling back to `card.en`, and dedupe.
- A `VocabTab` test that typing a **non-primary** gloss grades correct — the bug
  this fixes, stated as a test.
- No existing test may change. `VocabTab.test.jsx`'s typed-answer cases use
  `card.en`, which still grades correct by §3.2.
- Browser at 375px: answer a multi-gloss card with a secondary meaning, confirm
  correct, and confirm the verdict's gloss list wraps without horizontal scroll.
