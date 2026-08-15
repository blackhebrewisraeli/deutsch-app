# Perfekt deck group — drill the German perfect tense

**Status:** design, ready for a plan
**Date:** 2026-08-15
**Branch target:** `main` (currently `116cdca`, 1321 tests)

---

## 1 · What this is

The third of the "shipped data that does no teaching work" drills, after
Artikel (#105) and Plural (#106).

**472 of 473 verbs carry a full `verb` block** — every present-tense person plus
`partizip2` and `aux`. `formatVerb` prints two lines of it on every verb card,
and nothing has ever asked for any of it.

This spec adds a **Perfekt** deck group: show the infinitive, type the perfect —
"treffen" → **"hat getroffen"**, "folgen" → **"ist gefolgt"**.

## 2 · The facts that shape this — all verified

**F1 — the data is complete and the drill has real content.** Measured over the
shipped lexicon:

| | count | share |
|---|---|---|
| verbs with a participle | 472 / 473 | 99.8% |
| **strong** (participle in `-en`) | **149** | **32%** |
| weak (participle in `-t`) | 323 | 68% |
| `aux: sein` | 37 | 8% |
| `er`-form with a stem-vowel change | 141 | 30% |

A third of the participles are strong and cannot be derived from the
infinitive — `treffen → getroffen`, `bewegen → bewogen`, `übernehmen →
übernommen`. That is the content.

**F2 — an auxiliary-only drill was considered and rejected.** At 8% `sein`,
always answering "hat" scores 92%. The auxiliary rides along inside the full
perfect form instead, where the participle carries the difficulty.

**F3 — the decks are much smaller than the noun drills, and A1 is thin.**

| deck | cards | chunks |
|---|---|---|
| A1 | **47** | 2 of 9 |
| A2 | 128 | 4 of 9 |
| B1 | 297 | 5 of 9 |

`autoDecks.population.test.js` enforces `MIN_CARDS = 40`. **A1 clears it by
seven.** That is a real constraint: any future import that drops a handful of A1
verbs turns this deck red. Called out again in §5.

**F4 — `has: 'verb'` selects exactly the answerable set, today.** Every entry
with a `verb` block has a `partizip2` (0 exceptions), and the single verb
without a block is `ausgeliefert` — a participle the importer mislabelled as a
verb. The equivalence is a property of the current data, not a guarantee, so §3.4
pins it with a test rather than trusting it.

**F5 — the card currently prints the answer twice over.** `formatVerb` renders
the display-person line *and* the perfect line:

```
er: trifft
Perfekt: hat getroffen        ← the answer, verbatim
```

**F6 — `conceal` already exists** (#106) and takes a list precisely because a
third drill was expected.

## 3 · Design

### 3.1 The leak checklist — run before anything else

Two drills in a row shipped to the browser printing their own answer, so this
section is a checklist, not prose. Every field `CardFace` renders, and its
verdict for this drill:

| renders | leaks the perfect? | action |
|---|---|---|
| `display ?? card.de` — the infinitive | no, it *is* the question | keep |
| `card.ipa` | no | keep |
| `card.plural` | n/a — verbs have none | — |
| **`formatVerb(card.verb)` → `er:` line** | **yes, partially** | **conceal** |
| **`formatVerb(card.verb)` → `Perfekt:` line** | **yes, verbatim** | **conceal** |
| `card.examples[0].de` | rarely — an example may contain the perfect | **accept the risk**, see §5 |

The `er:` line leaks more than it looks. For weak verbs "er macht" hands over
the stem of "gemacht" outright; for strong verbs it hints at the vowel. Both
lines come from one `formatVerb` call, so **`conceal: ['verb']` drops the
block** — there is no case for keeping one and hiding the other.

`CardFace` gains a `!hidden('verb')` guard on that block, matching the `ipa` and
`plural` guards already there.

### 3.2 Three decks

`DECK_GROUPS` gains `'Perfekt'`; `AUTO_DECKS` gains `perfekt-a1|a2|b1`:

```js
auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb' }
```

Names are **"A1 Verbs" / "A2 Verbs" / "B1 Verbs"** — distinct from the CEFR
group's bare "A1", Artikel's "A1 Nouns" and Plural's "A1 Plurals". #106 shipped
a collision here and three tests caught it; the name-uniqueness guard added then
will catch a repeat.

### 3.3 What is asked, and how it is graded

The card shows the **infinitive** ("treffen"). The learner types the **full
perfect**: auxiliary + participle, "hat getroffen".

Requiring the auxiliary is deliberate even though it is 92% predictable (F2).
The drill is "form the perfect", and in German that *is* both parts; accepting a
bare "getroffen" would quietly teach that the auxiliary is optional, which is
exactly the error that produces "ich bin getroffen".

Graded with `exactMatch` against `pack.validation.target`, as the plural drill
is — **not** `fuzzyMatch`. `hat getroffen` vs `hat getroffen` differing by one
letter is a different word, not a near miss. The expected string is built by the
engine from pack data, reusing the existing `formatVerb` logic rather than a
second implementation:

```js
grammar.auxiliaries[verb.aux] + ' ' + verb.partizip2   // "hat" + "getroffen"
```

When `grammar.auxiliaries[verb.aux]` is undefined — an auxiliary the pack does
not declare — `formatVerb` already falls back to a participle-only line. The
drill must apply the **same** rule: expect the bare participle. One helper,
used by both, so the card and the drill can never disagree about what the
perfect of a verb is.

### 3.4 The invariant this rests on

`has: 'verb'` is only the right selector while every verb block carries a
`partizip2` (F4). `src/packs/lexiconSample.test.js` guards the shipped artifacts
already; it gains one assertion: **every entry with `verb` has a non-empty
`partizip2`**. If a future import breaks that, the test fails loudly instead of
the drill serving a card with no answer.

### 3.5 What it does not do

**No `markLearned`**, for the third time and the same reason: `learnedWords` is
keyed by `card.id` with no notion of which skill was shown.

**No present-tense drill.** 141 verbs (30%) have a stem-vowel change and that is
a genuine second drill — `geben → du gibst`. It needs a person picked per card
and a decision about the 79% of forms that equal the infinitive (`wir`, `sie`),
which is its own design. Out of scope here.

## 4 · Out of scope

- Präteritum — not in the lexicon at all.
- Separable-prefix handling beyond what the data already stores
  (`anbieten → er bietet an` is stored correctly and just works).
- Backfilling `ausgeliefert`, or removing the odd verbs the importer picked up
  (`stunden`, `beamten`). Content problems, not feature problems.
- Any `localStorage` key change.

## 5 · Risks

**A1 has seven cards of headroom** (F3). If an import drops A1 verbs the
population test goes red — which is the test doing its job, but it will look
like an unrelated failure. Worth a comment in the deck definition.

**Example sentences may contain the perfect.** `card.examples[0].de` is Tatoeba
text; a sentence for "treffen" could contain "getroffen". Concealing examples
would strip a genuinely useful cue from every card to prevent an occasional
leak, so this is **accepted, not fixed** — and recorded here so the next reader
knows it was a decision. Worth revisiting with a measurement if it turns out to
be common.

**Deck quality is inherited.** A1's 47 cards are whatever the importer labelled
A1; `stunden` and `beamten` are in the lexicon. The drill cannot be better than
its content.

## 6 · Verification

- Existing suite green with **no changes to any existing test**. If one needs
  editing, stop and re-open this spec.
- The shared perfect-form helper unit-tested on: a weak verb, a strong verb, a
  `sein` verb, and one whose auxiliary the pack does not declare.
- `lexiconSample.test.js`'s new invariant (§3.4) run against the real artifacts.
- A test that the card renders **neither** verb line when the deck is a Perfekt
  deck — the negative assertion the last two drills lacked.
- Browser: pick A1 Verbs, confirm no `er:` or `Perfekt:` line; type the correct
  perfect → correct with no LEARNED badge; type the participle alone → wrong.
