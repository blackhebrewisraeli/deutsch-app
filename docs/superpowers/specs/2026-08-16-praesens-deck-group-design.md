# Präsens deck group — drill the du-form

**Status:** design, ready for a plan
**Date:** 2026-08-16
**Branch target:** `main` (currently `1ed1529`, 1333 tests)

---

## 1 · What this is

The fourth drill over already-shipped data, after Artikel (#105), Plural (#106)
and Perfekt (#107). The lexicon stores all six present-tense persons for 472
verbs; `formatVerb` prints one of them and nothing asks for any.

This spec adds a **Präsens** deck group: show the infinitive, type the
**du-form** — "treffen" → **"triffst"**, "fahren" → **"fährst"**.

**Read §5 before building this.** It is the weakest of the four drills and the
measurements say so plainly. It is still worth shipping, but not for the reason
the first three were.

## 2 · The facts that shape this — all verified

**F1 — how much each person actually teaches.** Measured over 468 verbs, against
a naive "stem + regular ending" rule:

| person | derivable by rule | equals the infinitive |
|---|---|---|
| ich | 73% | 0% |
| **du** | **49%** | 0% |
| er | 55% | 0% |
| wir | 80% | **80%** |
| ihr | 64% | 0% |
| sie | 80% | **80%** |

**`du` is the least derivable person**, which is why it is the one drilled.
`wir` and `sie` are the bare infinitive four times in five and are excluded on
those grounds alone.

The rule used is deliberately crude — it does not model the epenthetic `-e-`
after `d`/`t` (`arbeiten → du arbeitest`), so it *under*-counts derivability.
The true mechanical share is higher than the table shows, not lower.

**F2 — the interesting subset cannot carry a deck.** Stem-vowel changes are the
real content (`fahren → fährst`, `treffen → triffst`). Per level:

| | stem-changers | of |
|---|---|---|
| A1 | **13** | 47 |
| A2 | 61 | 128 |
| B1 | 131 | 297 |

`autoDecks.population.test.js` enforces `MIN_CARDS = 40`. **A1's 13 is far
below it**, so an irregulars-only group cannot exist at A1 without either
dropping that level or lowering a guard that exists for good reason. Ruled out.
§5 records what it would take.

**F3 — the du-form decks are viable but thin.** Verbs carrying a `du` form:

| deck | cards |
|---|---|
| A1 | **45** |
| A2 | 127 |
| B1 | 296 |

A1 clears `MIN_CARDS` **by five** — thinner than Perfekt's seven. Any import
that drops six A1 verbs turns the population test red.

**F4 — the card leaks the answer, again.** `formatVerb` prints the `er` line,
and `er` shares the stem change with `du` for every irregular verb:

| card shows | answer |
|---|---|
| `er: erhält` | `erhältst` |
| `er: trifft` | `triffst` |
| `er: fährt` | `fährst` |

So the one line the card renders hands over precisely the 30% of cards that are
not mechanical. `conceal: ['verb']` is mandatory, exactly as in #107.

**F5 — `has: 'verb'` is not the answerable set here.** Four verbs have a
`present` block with no `du` form. `auto.has` currently tests a top-level field,
so it cannot express "has a du form". See §3.2.

## 3 · Design

### 3.1 Fixed person per deck, not per card

The deck asks for `du` on every card. The alternative — a person chosen per card
— was rejected: it makes the expected answer non-deterministic for a given card
id, which the SRS assumes is stable, and it needs new UI to show which person is
being asked.

A fixed person also means the label carries the question: **"Type the du-form"**.

### 3.2 `auto.has` learns dotted paths

`resolveAutoDeck` currently does `cards.filter((c) => c[auto.has])`. It gains a
path walk so a deck can name a nested field:

```js
auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb.present.du' }
```

This is a two-line generalisation of an existing mechanism, not a new one, and
it makes the selector exact — the four verbs without a `du` form are excluded
rather than served as cards with no answer. Existing `has: 'plural'` and
`has: 'verb'` usages are unaffected: a path without dots is the current
behaviour.

### 3.3 Grading and concealment

Identical to #106/#107, deliberately: `exactMatch` against
`pack.validation.target`, no `fuzzyMatch`, no "almost" band. A du-form differing
by one letter is a different word, and the keyboard substitutions (`fährst` typed
`faehrst`) are already folded by the target rules.

`conceal: ['verb']` per F4. `CardFace` needs no change — #107 added the guard.

**No `markLearned`**, for the fourth time and the same reason.

### 3.4 The deck triple is generated, not repeated

#107 was merged past a failing SonarCloud duplication gate (12.6%, limit 3%),
and the recorded conclusion was that **the gate is a ratio** — three
near-identical deck objects are a bigger share of a small PR. This is another
small PR, so the three decks are built from a map:

```js
...['A1', 'A2', 'B1'].map((level, i) => ({
  id: `praesens-${level.toLowerCase()}`,
  name: `${level} du-Form`,
  icon: ['🟢', '🔵', '🟣'][i],
  group: 'Präsens',
  auto: { by: 'cefr', level, pos: 'verb', has: 'verb.present.du' },
})),
```

Nine lines instead of twenty-one, and it states the actual relationship: these
are one deck at three levels. **This is not expected to clear the gate on its
own** — #107's arithmetic put the deck objects at roughly a third of the
duplication — so the PR may still go red on the test-suite similarity. That is a
known, accepted outcome, not a surprise to rediscover.

Names are "A1 du-Form" etc., distinct from every existing deck label; the
name-uniqueness guard from #106 enforces it.

## 4 · Out of scope

- Drilling `ich`, `er` or `ihr`. Adding persons multiplies decks without
  multiplying content; `du` is the informative one (F1).
- An irregulars-only group (F2) — see §5.
- Präteritum, Konjunktiv, imperatives: not in the lexicon.
- Any `localStorage` key change.

## 5 · Why this is the weakest of the four, stated plainly

The first three drills worked because their content is **arbitrary**. There is
no rule that derives `die` from *Uhr*, `Städte` from *Stadt*, or `getroffen`
from *treffen* — you either know it or you don't, which is exactly what
spaced repetition is for.

**Present tense is mostly rule-governed.** At least half of du-forms are
"stem + st", and a learner who knows that rule gains nothing from being asked
again. This drill is therefore roughly half busywork by construction, and the
crude rule in F1 means the real figure is worse.

Two things make it worth shipping anyway:

1. **The SRS makes deck triviality self-correcting.** Mechanical cards are
   answered right, jump boxes and space out fast; the stem-changers come back.
   The learner converges on the 30% that matters without the deck having to
   pre-select it.
2. `du` is the person where the stem change actually surfaces, and it is the
   form a learner produces most in conversation.

**The stronger version, if it is ever wanted:** have the importer store a
`stemChange` boolean per verb, then select on it. That needs an importer change
and an index regeneration — the #105 shape — and it still cannot support an A1
deck at 13 cards. Worth doing only if A1 is dropped or the corpus grows.

## 6 · Risks

**A1 has five cards of headroom** (F3), the thinnest of any deck in the app.

**The `du` ending collides with the answer for weak verbs**: "leben" → "lebst"
is derivable, so a learner may feel the deck is trivial before the SRS has
spaced the easy cards out. Nothing to fix; a consequence of §5.

**Deck quality is inherited**: `stunden`, `beamten` and `schweren` are in the
lexicon and will appear.

## 7 · Verification

- Existing suite green with **no changes to any existing test**.
- `auto.has` path walking unit-tested: a dotted path, a plain field (unchanged
  behaviour), and a path whose intermediate is missing.
- A test that the drill's decks contain **only** cards carrying a `du` form.
- The negative assertion: no `er:` or `Perfekt:` line on a Präsens card.
- Browser: A1 du-Form shows 45 cards, no verb lines, `triffst` accepted for
  treffen, `treffst` rejected, no LEARNED badge.
