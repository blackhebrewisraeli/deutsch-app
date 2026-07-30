# Flashcard gloss cleanup — design

Date: 2026-07-30 · Branch: `feat/gloss-cleanup` · Base: `main` @ `d227e2b`
Closes: `docs/DEMO_READINESS.md` P1 #14

## Problem

Flashcard answers are raw Wiktionary glosses, rendered verbatim as multiple-choice
options and as the revealed answer. `resolveCard` (`src/packs/resolve.js:9`) sets
`en: entry.en[0]` — the first gloss, untouched. Seen on the live demo:

- a multiple-choice option reading "ARCHAIC FORM OF STANDEN, FIRST/THIRD-PERSON
  PLURAL PRETERITE OF STEHEN"
- the correct answer for *in* being "[WITH DATIVE] IN, INSIDE, WITHIN, AT
  (INSIDE A BUILDING)"

A learner cannot choose between options like these. It is not only untidy — it
makes the exercise unanswerable.

## What the data actually says

Measured across all 4,424 shipped entries (`public/lexicon/chunk-*.json`):

| Symptom | Count | Share |
| --- | ---: | ---: |
| First gloss > 40 chars | 929 | 21.0% |
| First gloss > 60 chars | 446 | 10.1% |
| Contains a bracket or parenthetical | 1,178 | 26.6% |
| Meta-linguistic (`form of`, `preterite`, …) | 46 | 1.0% |

First-gloss length: p50 19 · p75 36 · p90 61 · p99 118 · max 231.

The dominant problem is **length and parentheticals**, not `form of` entries. The
shape is consistent — synonyms first, then a parenthetical gloss:

```
Vorlage → "source material, original, inspiration (the material that is adapted
           into a piece of media or art, e.g. a novel…)"          [231 chars]
in      → "[with dative] in, inside, within, at (inside a building)"
```

### Three distinct problems, not one

Investigation turned up two further causes that a text-only fix would have missed.

**We ship the wrong record for some words.** The Wiktextract export carries
several records per lemma (homographs, separate etymologies). `disambiguateIds`
keeps every colliding record under a distinct id, so *Raum* ships twice:

| id | first gloss |
| --- | --- |
| `n:raum:space` | space |
| `n:raum:alternative-form-of-rahm-cream` | alternative form of Rahm ("cream") |

The source tags that second record's senses `alt-of`. `parseRecord` already drops
senses tagged `form-of` but not `alt-of`, so the junk record survives as its own
flashcard. This is the true cause of the meta-linguistic cards — a tag check, not
a property of the English text.

**370 extra cards come from duplicate surface forms** (333 lemmas appear on more
than one card). Some are junk as above; others are legitimate homographs — `in`
as preposition *and* adjective, `Tag` as "day" *and* "tag (label)".

## Approach

Cleanup happens **at import time**. The fix belongs where the data problem is;
`public/lexicon` then ships clean and smaller, every consumer benefits with no
runtime cost, and the transform is a pure function that unit-tests directly. The
1.8 GB source cache already exists at `.cache/lexicon-raw`, so re-running the
import costs minutes rather than a re-download.

Rejected: cleaning at runtime in `resolveCard` — the bloated text would still
ship, every future consumer would have to remember to clean, and "the answer"
would have two sources of truth. Also rejected: doing both, which would duplicate
the rule across two files that can drift (the codebase already carries one such
duplication, `resolve.js` / `lexiconStore.js`, with a warning comment).

## Design

### A. `scripts/import-lexicon/cleanGloss.js`

One pure function, no dependencies:

```
cleanGloss(raw) → string
```

1. Strip a leading bracketed label: `/^\s*\[[^\]]*\]\s*/`
2. Cut at the first `(` or `[`
3. Cap to the first 3 comma/semicolon-separated synonyms
4. Trim trailing separators and whitespace
5. If the result is empty, fall back to the trimmed raw gloss

Step 5 exists for exactly one shipped entry — *ihn*, whose gloss opens with
`(obsolete) dative of sie; them (indirect object).` and would otherwise clean to
nothing.

Measured effect over the shipped lexicon:

| | before | after |
| --- | ---: | ---: |
| p90 length | 61 | 30 |
| > 40 chars | 929 (21.0%) | 177 (4.0%) |
| > 60 chars | 446 | 66 |

Worked examples:

```
"source material, original, inspiration (the material that is…)"
  → "source material, original, inspiration"
"[with dative] in, inside, within, at (inside a building)"
  → "in, inside, within, at"
"support, assistance, backing, also endorsement"
  → "support, assistance, backing"
```

### B. Drop `alt-of` records

Extend the existing sense filter in `parseRecord` to reject `alt-of` alongside
`form-of`. A record whose senses are all `alt-of` yields no senses and is dropped
whole, exactly as `form-of` records are today.

This removes the junk duplicate without touching the good record: *Raum* keeps
"space" and loses "alternative form of Rahm".

**This replaces a tempting but wrong alternative.** Dropping entries whose glosses
all match a meta-linguistic regex would have deleted 43 entries including **nach**,
**Raum**, **Anteil** and **dies** — common words whose *good* record exists
alongside the junk one. The tag check is precise where the regex is not.

### C. Keep the encyclopedic residue

177 entries (4.0%) have no synonym form at all — their only definition is prose:

```
Volkspartei → "a large political party which is supported by people from various
               economic, regional and religious backgrounds"
Abitur      → "final exams taken by pupils at the end of their secondary education…"
```

These ship as-is. They are real words a learner wants, and a wordy definition is
still a correct one. No truncation, no exclusion from decks. The flashcard UI
already wraps long answers.

## Non-goals

- **Deduping legitimate homographs** (`in` prep/adj, `Tag` day/label). A separate
  product question — recorded as a finding in `DEMO_READINESS.md`, not fixed here.
- **Preferring a shorter later gloss when the first is long.** Measured: this
  rescues 112 entries but degrades them, because Wiktionary orders senses by
  primacy. *Mal* would go from "a mark on the body" to "base"; *Ergebnis* from
  "result, outcome, conclusion" to "earnings, profit". Explicitly rejected so it
  is not re-proposed.
- **Any change to `resolveCard` or the flashcard UI.**
- **Changing the typed-answer matching rule.** `fuzzyMatch` still compares against
  the whole cleaned gloss; accepting any single synonym is a separate change.

## What regenerates

`npm run import:lexicon` (cache present → minutes) rewrites `public/lexicon/*`.

- Entry count drops from 4,424 by the number of `alt-of`-only records. Estimated
  ~43 from the shipped data; the exact figure comes from the import report, and
  the plan's first task verifies which tags the 43 known cases actually carry,
  widening the tag list if some use a different one.
- `README.md` cites "4,424-word" in two places; `docs/DEMO_READINESS.md` cites
  4,418 and 4,424. All need the new figure.
- `src/packs/de/autoDecks.population.test.js` asserts `toBeGreaterThanOrEqual`, so
  it tolerates the shrink. Deck counts in
  `docs/superpowers/specs/2026-07-13-autodecks-real-data-design.md` become stale
  by a few entries; that is historical record, left alone.

## Testing

- `scripts/import-lexicon/cleanGloss.test.js` — pure unit tests over the real
  strings found in the shipped data: *Vorlage* (231 chars), *in* (leading label),
  *ihn* (cleans to empty → fallback), *Volkspartei* (prose, unchanged),
  *Unterstützung* (synonym cap).
- `scripts/import-lexicon/parseWiktextract.test.js` — a record whose senses are all
  `alt-of` is rejected; a record with a mix keeps only the non-`alt-of` senses.
- `src/packs/lexiconSample.test.js` already validates that every index row resolves
  to a present, valid entry, so the regenerated artifacts are checked automatically.
- Full suite (`npm test`), `npm run lint`, `npm run format:check` before commit;
  `.husky/pre-commit` runs the suite and is never bypassed.

## Verification

- Re-run the measurement script against the regenerated artifacts and confirm:
  p90 first-gloss length ≤ 35, and entries with a first gloss > 40 chars ≤ 200.
- Confirm no *first* gloss matches `/\b(form of|inflection of|preterite)\b/i`.
  Note the weaker claim: the fix is tag-based, so a record that is not tagged
  `alt-of` but whose prose happens to read "alternative form of…" would survive.
  11 entries currently carry such a gloss in a non-first position. If any survive
  as a first gloss, record the count rather than widening the rule by regex —
  that is the trap this design already rejected.
- Load the app and confirm a B1 deck shows readable multiple-choice options.
- Confirm *Raum* resolves to "space" and appears once.
