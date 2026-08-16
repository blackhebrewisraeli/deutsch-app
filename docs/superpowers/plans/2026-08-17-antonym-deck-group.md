# Gegenteil (Antonym) Deck Group Implementation Plan

**Goal:** A seventh drill — show a word, type its opposite. `hell → dunkel`,
`arm → reich`, `Gesundheit → Krankheit`.

**Architecture:** the import extracts `antonyms` (it currently discards them)
and then prunes them for quality (`antonyms.js`); a `Gegenteil` row in `DRILLS`
graded against **every** listed antonym via a new optional `accepts` column; and
**one** frequency-ordered deck in `autoDecks.js`.

## Measured before building

| | |
|---|---|
| raw entries with an antonym | 262 |
| **after quality pruning** | **124** |
| by band (after pruning) | A1 26, A2 44, B1 51 |
| by POS (raw) | adj 112, noun 91, verb 23, adv 20 |
| **entries with MORE than one antonym** | **24 after pruning** |

Non-mechanical by construction: `dunkel` is not derivable from `hell`. This is
what Steigerung failed (94% mechanical) and Präteritum passed.

## Two findings that shape the design

**1. Grading must accept any listed antonym.** 123 of 359 cards carry several
(`gut ↔ schlecht, böse`; `schön ↔ hässlich, häßlich, unschön`). `answerDrill`
currently grades one `expected` string with `exactMatch`. Grading only the first
is exactly the #109 bug, where `die Uhr` accepted "clock" but not "watch".

Add an **optional** `accepts(card, grammar) → string[]` column. When absent,
`answerDrill` falls back to `[expected]`, so the five existing drills are
untouched.

**2. The examples leak, and it is semantic rather than accidental.** 6 of 359
(2%) contain the antonym, because antonym pairs naturally co-occur in
contrastive sentences:

```
arm ↔ reich            "Ich bin lieber arm als reich."
Qualität ↔ Quantität   "Mir geht Qualität vor Quantität."
einerseits ↔ …         "Einerseits will ich Tom vergessen, andererseits …"
```

Measured with a **positive control** (the same matcher finds the headword in 98%
of examples), so the 2% is real. This will recur with any example source, so the
drill conceals `examples` as Hören does. English glosses leak 0 and stay.

## Global Constraints

- **Tests use `globals: false`** — import from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- No German literal in `src/lib/*` or `src/components/*` — the card's label
  comes from `grammar.labels`.
- No drill calls `markLearned`.
- Deck **names** must be unique, not just ids.
- Open a PR against `main`; never push to `main`.

## File Structure

| file | change |
|---|---|
| `scripts/import-lexicon/parseWiktextract.js` | extract `antonyms` |
| `scripts/import-lexicon/mapEntry.js` | carry through |
| `src/packs/resolve.js` | `antonyms` on the resolved card |
| `src/packs/validate.js` | accept the field |
| `src/packs/de/grammar.js` | `labels.antonym` |
| `src/components/vocab/CardFace.jsx` | render the line, concealable |
| `src/components/VocabTab.jsx` | `accepts` fallback in `answerDrill` |
| `src/components/vocab/drills.js` | `Gegenteil` row |
| `src/packs/de/autoDecks.js` | three decks + `DECK_GROUPS` |
| `public/lexicon/de/*` | regenerated |

## Tasks

- [ ] **RED** — parser extracts antonyms; fixture carries a **multi-antonym**
      entry, or a take-the-first bug passes.
- [ ] **RED** — `answerDrill` accepts any listed antonym (drives `accepts`).
- [ ] **RED** — the row conceals `antonyms` and `examples`.
- [ ] CardFace line; grammar label; validate.
- [ ] One deck; `has: 'antonyms'` over the full frequency range.
- [ ] Re-import; confirm populations on the real lexicon.
- [ ] Browser-verify the card does not show its own answer.
- [ ] `npm test`, `npm run lint`, `npm run format:check`.

## Why one deck and not three CEFR bands

The raw 262 pairs carried enough noise to be worth pruning: nominalised function
words (`Er ↔ Sie`), bookkeeping senses (`Haben ↔ Soll`), dialect antonyms
(`ob ↔ nid`), and vague pairs (`fast ↔ ganz`). Pruning to pairs actually worth
drilling leaves **124**, but only **26** in A1 — below `MIN_CARDS = 40`.

Rather than ship a thin A1 deck or keep the noise to pad it, the group is one
deck over the full frequency range. `selectRows` sorts by rank, so it runs
most-useful-first: Ende↔Anfang, laut↔leise, bekannt↔unbekannt, Ja↔Nein.

**Reciprocity was tried and rejected** as the quality signal. Requiring both
halves to list each other collapses the set to 57 (25/16/16) and filters on
Wiktionary's coverage rather than pair quality — it discards `bekannt ↔
unbekannt` and `gewinnen ↔ verlieren` while keeping `Haben ↔ Soll`, since both
bookkeeping terms do list each other.

## Out of scope

- Reverse direction (given the antonym, type the headword) — same pair twice.
- Multi-word antonyms; the extractor drops anything containing whitespace.
