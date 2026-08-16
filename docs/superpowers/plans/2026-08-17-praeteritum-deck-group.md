# Präteritum Deck Group Implementation Plan

**Goal:** A sixth drill — type a verb's Präteritum. The written past tense, and
the spoken past for *sein* / *haben* / modals, so it is core German rather than a
niche.

**Architecture:** the import learns to extract the preterite (it currently drops
it); `preteriteLine` joins `perfectLine` in `verbDisplay.js` so the card and the
drill cannot disagree; a `Präteritum` row in `DRILLS` and three decks in
`autoDecks.js`.

## Why this drill and not the other candidates

Measured against the shipped lexicon before committing:

| candidate | coverage | mechanical |
|---|---|---|
| **Präteritum** | **640 / 647 verbs (99%)** | **no — majority strong** |
| Steigerung (adjectives) | 381 / 743 (51%) | **94%** — rejected |
| freqRank badge | n/a | corpus is newswire — rejected |

`sehen → sah`, `fallen → fiel`, `geben → gab`, `sein → war`, `bringen → brachte`
— all A1, none derivable from the stem.

**Caveat carried into implementation:** the 59% "strong" figure came from a rough
classifier that misreads d/t-stem regulars (`arbeiten → arbeitete`) as irregular.
The true share is lower. It does not change the decision — the point is that this
is nowhere near Steigerung's 94% — but **do not quote 59% anywhere**.

## Global Constraints

- **Tests use `globals: false`** — import from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **No German literal in `src/lib/*` or `src/components/*`** — the label comes
  from `grammar.labels`, like `Perfekt` and `Part. II` already do.
- No drill calls `markLearned` (see the `DRILLS` docblock).
- Deck **names** must be unique, not just ids (learned in #106).
- Open a PR against `main`; never push to `main`.

## The answer-leak check — do this before writing the drill

#105 leaked the answer via the headword and #106 via the `PL:` line; both were
green in unit tests and caught only in the browser. `CardFace` renders: headword,
article, IPA, plural, **verb lines**, glosses, examples.

`preteriteLine` will be added to `formatVerb`, so the Präteritum appears **on the
card face**. The drill must therefore `conceal: ['verb']`, exactly as Perfekt and
Präsens do — the whole block, not one line, because the `er:` present line hands
over the stem for weak verbs.

Verify in the browser, not only in jsdom.

## File Structure

| file | change |
|---|---|
| `scripts/import-lexicon/parseWiktextract.js` | `verbFromForms` extracts `preterite` |
| `scripts/import-lexicon/parseWiktextract.test.js` | fixture with preterite forms |
| `src/packs/de/grammar.js` | `labels.preterite` |
| `src/lib/verbDisplay.js` | exported `preteriteLine`, added to `formatVerb` |
| `src/lib/verbDisplay.test.js` | line + ordering |
| `src/components/vocab/drills.js` | `Präteritum` row |
| `src/packs/de/autoDecks.js` | three decks, `has: 'verb.preterite'` |
| `src/packs/validate.js` | allow the new optional field |
| `public/lexicon/de/*` | regenerated |

## Tasks

- [ ] **RED** — `verbFromForms` extracts the 3rd-person-singular preterite.
      Fixture must carry a **strong** verb, or a stem+`te` bug passes.
- [ ] **RED** — `preteriteLine` returns label+value, null without data.
- [ ] **RED** — `formatVerb` orders present → Präteritum → Perfekt.
- [ ] Grammar label; validate.js accepts the field.
- [ ] `Präteritum` row in `DRILLS`, `conceal: ['verb']`.
- [ ] Three decks; check A1 clears `MIN_CARDS = 40` — Präsens A1 clears it by
      five, so this is the real risk to the population test.
- [ ] Re-run `npm run import:lexicon`; confirm coverage on the real lexicon.
- [ ] Browser-verify the drill does not show its own answer.
- [ ] `npm test`, `npm run lint`, `npm run format:check`.

## Out of scope

- Präteritum for persons other than 3rd singular. German's 1st and 3rd singular
  are identical here, so `er` is both the memorised form and the display person.
- Backfilling `freqRank`-based ordering or any usefulness signal (see
  `2026-08-17-leipzig-rank-clobber.md`).
