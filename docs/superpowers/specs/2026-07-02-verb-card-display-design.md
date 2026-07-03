# Verb Conjugation Card Display — Design

Date: 2026-07-02
Status: Approved (brainstorming) — pending spec review
Depends on: verb conjugation import (merged to main, PR #58) — resolved cards
carry `card.verb` (relaxed block: `{ aux, partizip2, present:{ich,du,er,wir,ihr,sie} }`,
any field nullable, or `verb: null`).

## Goal

Surface a verb's conjugation on the vocab card. Verbs already appear as plain
cards (headword + gloss + example); add up to two compact lines — the
3rd-person-singular present and the Perfekt — matching the existing `PL:` line
style. Pure-function-only: no changes to the import pipeline or the committed
sample lexicon.

## 1. Pure formatter — `src/lib/verbDisplay.js`

All formatting logic lives in one tested pure function; `VocabTab` stays a thin
renderer.

```js
formatVerb(verb) → Array<{ label: string, value: string }>   // [] when nothing to show
```

Rules (each line appears only when its data exists; order as listed):

1. **er-form** — if `verb.present?.er` → `{ label: 'er', value: verb.present.er }`
   (e.g. `{ label: 'er', value: 'geht' }`).
2. **Perfekt** — if `verb.partizip2` **and** `verb.aux` →
   `{ label: 'Perfekt', value: `${verb.aux === 'sein' ? 'ist' : 'hat'} ${verb.partizip2}` }`
   (e.g. `{ label: 'Perfekt', value: 'ist gegangen' }`). The stored auxiliary
   infinitive (`haben`/`sein`) is rendered in its 3rd-sg form (`hat`/`ist`) to
   pair naturally with the `er` framing.
3. **Participle fallback** — if `verb.partizip2` but `verb.aux` is `null` (common
   under best-effort) → `{ label: 'Part. II', value: verb.partizip2 }` (shown
   instead of a Perfekt line).

Returns `[]` when `verb` is `null`, not an object, or has no `present.er` and no
`partizip2`. Defensive: `verb?.present?.er`, `verb?.partizip2`, `verb?.aux`.

## 2. `VocabTab` rendering

In the card-face block, immediately AFTER the existing `PL:` plural block and
BEFORE the example sentence (grammar facts grouped, usage last), render each line
from `formatVerb(card.verb)` using the SAME compact mono style as the plural line
(`FONTS.mono`, `FONT_SIZE.tag`, `LETTER_SPACING.caps`, `COLORS.mute`,
`marginTop: SPACE[2]`), formatted as `${label}: ${value}` (e.g. `ER: geht`,
`PERFEKT: ist gegangen`). Nouns/phrases/nums (`verb: null`) render nothing new.
`resolveCard` already passes `card.verb` through — no resolver/pipeline change.

Import `formatVerb` from `../lib/verbDisplay` (no file extension — `src/` code).

## 3. Testing

`src/lib/verbDisplay.test.js` — the real coverage:
- full block (aux `sein` + partizip2 + all present) → `[{er, geht}, {Perfekt, 'ist gegangen'}]`.
- aux `haben` → Perfekt value uses `hat`.
- aux `null` + partizip2 → `[{er,…}, {'Part. II', partizip2}]` (no Perfekt).
- only `present.er` (no partizip2) → `[{er,…}]`.
- `verb: null` → `[]`; empty/all-null block → `[]`.

No VocabTab integration test and no sample-lexicon change (decided): the sample
lexicon has no verb in a reachable deck, and the display logic is fully covered by
the pure-function tests. `VocabTab`'s existing tests must stay green (the new
render is additive and gated on `card.verb`).

## 4. Out of scope (YAGNI)

Full present-tense table; Präteritum / Konjunktiv / imperative; a tap-to-expand
full conjugation view; touching the import pipeline or committed sample artifacts.

## 5. Risks

- **Best-effort gaps:** many imported verbs will have `aux: null` (parser only
  sets it from an explicit `auxiliary`-tagged form), so the Perfekt line often
  falls back to `Part. II`. Intended — never fabricate the auxiliary.
- **Card real estate:** at most two extra compact lines; consistent with the
  existing `PL:` + example lines, no layout risk.
