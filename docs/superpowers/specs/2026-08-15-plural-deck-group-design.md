# Plural deck group — drill noun plurals

**Status:** design, ready for a plan
**Date:** 2026-08-15
**Branch target:** `main` (currently `7fe813d`, 1307 tests)

---

## 1 · What this is

The sibling of the Artikel group (#105). **2,635 of 2,863 nouns carry a
`plural`** — 92.0%, and `CardFace` already prints it as a "PL: …" line. Like the
article before #105, it is shown and never asked for.

German plural is the second arbitrary thing a learner has to memorise per noun:
seven productive patterns (`-e`, `-er`, `-(e)n`, `-s`, zero, plus umlaut on any
of them) with no reliable rule from the singular. Recognising "Städte" is easy;
producing it is the skill.

This spec adds a **Plural** deck group: show the singular, type the plural.

## 2 · The facts that shape this — all verified against the code

**F1 — coverage is high but not total, and it varies by level.**

| level | nouns | with plural | |
|---|---|---|---|
| A1 | 607 | **580** | 96% |
| A2 | 876 | **815** | 93% |
| B1 | 1,380 | **1,240** | 90% |

The 228 without one are mass nouns, proper nouns and import gaps. They must not
appear in the deck — a card with no answer is unanswerable, not merely dull.

**F2 — the index cannot filter them out.** Index rows are
`{ id, rank, cefr, pos, tags, chunk }` after #105. There is no `plural` and no
`hasPlural`. `selectRows` would return 607 for A1 where only 580 are answerable.
See §3.2 — this is the one structural decision in this spec.

**F3 — the plural is stored as the full plural form**, not a suffix and not
articled: `Jahr → Jahre`, `Stadt → Städte`, `Platz → Plätze`, `Uhr → Uhren`.
So the expected answer is exactly `card.plural`.

**F4 — `validation.target` exists and has no consumer.** Phase 1.2 shipped it
and nothing has ever read it; the only references in `src/` are the shape
validator and two comments. The German pack declares
`{ trim, caseFold, stripCombiningMarks: false, replacements: [ß→ss, ä→ae, ö→oe, ü→ue] }`
— the substitutions German itself defines for keyboards lacking the characters.

Checked against the real rules:

| typed | expected | matches | why that is right |
|---|---|---|---|
| `Staedte` | `Städte` | **yes** | a US keyboard cannot type ä |
| `Stadte` | `Städte` | **no** | the umlaut *is* the plural marker |
| `Jahren` | `Jahre` | **no** | a different plural, not a typo |

This drill is `validation.target`'s first real consumer, which is what it was
built for: typed **target-language** input, as opposed to `ANSWER`, which grades
typed English.

**F5 — the existing typed path grades leniently, and must not be copied.**
`submitTyped` uses `fuzzyMatch(card.en, typed, ANSWER)` with
`dist === 0 ? 'correct' : dist <= 2 ? 'almost'`. That is right for recalling an
English gloss and wrong here. See §3.3.

**F6 — the Artikel work left the seams in place.** `#105` added the `pos`
modifier, `card.lemma`, a `display` override on `CardFace`, and the
`isArtikel` routing in `VocabTab`. This slots in beside it.

## 3 · Design

### 3.1 Three decks, and what the card shows

`DECK_GROUPS` gains `'Plural'`; `AUTO_DECKS` gains `plural-a1|a2|b1` at
**580 / 815 / 1,240** cards.

The card shows the **full singular including its article** — "das Jahr" — which
is `card.de`, the default. No `display` override, unlike Artikel.

Showing the article is deliberate: it is not the answer here, and gender is a
real cue. Measured over the shipped lexicon:

| article | dominant plural classes |
|---|---|
| **die** (1,083) | `-en` 56%, `-n` 34% — **90% in two classes** |
| der (1,058) | zero 30%, `-e` 26%, umlaut 26% — spread |
| das (494) | `-e` 35%, zero 24%, `-s` 15% — spread |

So for the largest gender the article narrows the answer to two shapes, and for
the other two it narrows it barely at all. Hiding it would withhold a cue the
language genuinely gives and make the drill harder than German is.

### 3.2 The answerable-card filter lives after resolution, not in the index

This is the structural decision. `selectRows` filters the index; the index has
no plural information (F2). Two options:

**(a) Add `hasPlural` to the index.** Symmetric with #105's `pos`. But `pos` was
worth it because selection *cannot* proceed without it — chunks would have to be
fetched to know what to fetch. Here the chunks are already loaded by the time
the question arises, so an index field buys nothing at fetch time and costs
~60 KB on top of the +52.6 KB `pos` just added.

**(b) Post-filter the resolved cards.** `resolveAutoDeck` already has every
entry in hand when it maps to cards. Dropping the ones with no `plural` costs
one `.filter()` and zero bytes.

**Decision: (b).** Deck definitions gain an optional `auto.has`, naming a field
the resolved card must carry:

```js
auto: { by: 'cefr', level: 'A1', pos: 'noun', has: 'plural' }
```

`selectRows` ignores `has` — it cannot honour it — and `resolveAutoDeck` applies
it after `resolveCard`. **Filtering is split across two places, and that is
inherent, not sloppy:** `pos` is knowable from the index, `plural` is not. The
plan must put that reasoning in a comment at both sites, because the next reader
will otherwise "tidy" one into the other.

**Consequence to accept:** `autoDecks.population.test.js` asserts
`selectRows(index, deck.auto).length >= 40`, which measures the pre-filter count
— 607, not 580. It still passes, but it is measuring the wrong number for these
decks. The plan should extend that test to resolve `has` decks properly rather
than leave a test that looks like it covers something it does not.

### 3.3 Grading: exact after normalisation, with no "almost"

```js
normalizeText(typed, pack.validation.target) === normalizeText(card.plural, pack.validation.target)
```

**No `fuzzyMatch`, no `almost` band**, diverging from `submitTyped` (F5) on
purpose. In plural morphology a single letter *is* the answer: `Jahren` is one
edit from `Jahre` and would score "almost", teaching that a wrong plural is
nearly right. The legitimate variance — an umlaut typed as `ae` — is already
absorbed by the normalisation, so what remains after it is genuinely wrong.

`VerdictPanel` therefore only ever shows `correct` or `wrong` here, and a wrong
answer offers AGAIN alone, which is already its behaviour for `result === 'wrong'`.

The answer echoed back is **`die ` + the plural** — "die Jahre" — because the
plural article is invariant and seeing the full form is what makes it stick.
The `die` comes from the pack, not a literal: it is
`grammar.pluralArticle`, a new one-line grammar field. A pack whose language has
no plural article leaves it undefined and gets the bare form.

### 3.4 What it does not do

**No `markLearned`**, for the same reason as #105: `learnedWords` is keyed by
`card.id` with no notion of which skill was shown, and knowing a plural is not
knowing the word. The SRS separates the decks by id.

**`TypedAnswer` is reused**, not duplicated — but its `aria-label` and
placeholder say "Type the English meaning", which would be wrong here. It gains
optional `label`/`placeholder` props defaulting to today's strings, so no
existing call site or test changes.

## 4 · Out of scope

- **Plural-pattern classification** ("which class is this?"). Interesting, but it
  needs the class *derived* from lemma+plural, which is a morphology problem with
  a long tail. Different feature.
- **Backfilling the 228 missing plurals.** A content problem for the importer.
- **Genitive, comparatives, verb tenses.** Same shape, later, if this lands well.
- **Any `localStorage` key change.** New deck ids reuse the existing `srs` map.

## 5 · Risks

**Typing German on a phone.** The keyboard substitutions cover ä/ö/ü/ß, which is
the whole of what a US layout cannot produce. Nothing else in German needs it.

**580/815/1,240-card decks are large.** Same as Artikel and the CEFR decks; the
SRS queue is what makes deck size tolerable.

**The split filter (§3.2) is the thing most likely to be "fixed" wrongly** by a
future reader who sees `pos` handled in `selectRows` and `has` handled elsewhere.
Comments at both sites, and a test that fails if `has` is ever honoured in
`selectRows` against an index that cannot support it.

## 6 · Verification

- Existing suite green with **no changes to any existing test** except
  `autoDecks.population.test.js`, which §3.2 requires extending. If anything else
  needs editing, stop and re-open this spec.
- `normalizeText`-based grading proved on the three F4 cases.
- A test that a `has: 'plural'` deck yields only cards carrying a plural, against
  the **real shipped artifacts**, not a fixture.
- Browser: pick A1 Plural, confirm the card shows "das Jahr", type `Jahre` →
  correct; type `Jahren` → wrong, answer echoes "die Jahre"; type `Staedte` for
  Stadt → correct. Confirm no LEARNED badge on a correct answer.
