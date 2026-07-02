# Verb Conjugation Import (best-effort) — Design

Date: 2026-07-02
Status: Approved (brainstorming) — pending spec review
Depends on: Phase A (PR #57) + Phase B (PR #56) — the import pipeline, the
`LexiconEntry` shape, `validateLexiconEntry`.
Parent arc: `docs/superpowers/specs/2026-06-28-rich-lexicon-phase-a-design.md`

## Goal

Stop dropping every verb from the imported lexicon. Extract what conjugation
data Wiktextract provides (present tense, past participle, auxiliary) into a
**best-effort** `verb` block, ship verbs like any other word, and surface nothing
new in the UI yet (data-only).

## Problem

Today the pipeline drops all verbs:
- `parseWiktextract.parseRecord` extracts no verb forms (`article`/`plural` are
  noun-only; there is no verb extraction).
- `mapEntry` hardcodes `verb: null`.
- `filter.keepEntry` drops `pos === 'verb' && verb === null`.
- `validateLexiconEntry` (Phase B) *requires* a full verb block when
  `pos === 'verb'` (`aux ∈ haben|sein`, non-empty `partizip2`, all six present
  forms).

Net effect: verbs — core vocabulary — never reach the lexicon.

## Decision (from brainstorming)

**Best-effort inclusion.** Relax the schema so a verb ships as long as it has a
gloss; the verb block carries whatever conjugation was extractable, `null` for
gaps. Display of conjugation is **deferred** (data-only this pass).

## 1. Relaxed `verb` block schema

```js
verb: null | {
  aux:       null | 'haben' | 'sein',
  partizip2: null | string,                       // e.g. 'gegangen'
  present:   { ich, du, er, wir, ihr, sie }       // each value: string | null
}
```

- If **no** conjugation data is extracted at all → `verb: null`.
- If **any** field is found → a block with `null` for every missing slot. The
  `present` object always carries all six keys (values may be `null`) for a
  consistent shape.

## 2. Validator changes (`src/packs/validate.js`)

- **Remove** the rule "verb block is required for verbs" (`pos === 'verb' &&
  verb === null` no longer fails).
- Validate the verb block **only when present** (`verb !== null`), against the
  relaxed shape:
  - `aux`: `null` OR one of `['haben', 'sein']`.
  - `partizip2`: `null` OR a string.
  - `present`: an object; every one of `ich/du/er/wir/ihr/sie` is `null` OR a
    non-empty string. (Missing keys fail — the shape must be complete even if
    values are null.)
- Nouns/phrases/nums are unaffected. The Phase B curated 40 all carry
  `verb: null` and remain valid.

## 3. Filter change (`scripts/import-lexicon/filter.js`)

- `keepEntry`: **remove** the `pos === 'verb' && verb === null` drop. Verbs are
  kept on the same terms as every other entry (a gloss + ≥1 example after
  cleaning). The noun-needs-article rule stays.

## 4. Parser extraction (`scripts/import-lexicon/parseWiktextract.js`)

Add `verbFromForms(forms)` → the relaxed block, or `null` when nothing is found.

Wiktextract `forms[]` carry `{ form, tags: [...] }`. Mapping:
- **present** — a form whose tags include `present` + `indicative` + a person
  (`first-person|second-person|third-person`) + a number (`singular|plural`)
  maps to a slot:
  - 1sg→`ich`, 2sg→`du`, 3sg→`er`, 1pl→`wir`, 2pl→`ihr`, 3pl→`sie`.
- **partizip2** — a form tagged `participle` and (`past` or `perfect`).
- **aux** — a form tagged `auxiliary` whose value is `haben` or `sein`; else
  `null`.
- Return `null` if none of the above produced any value (so a verb with zero
  form data gets `verb: null`).

`parseRecord` returns `verb: pos === 'verb' ? verbFromForms(raw.forms) : null`.

**Seam note:** the exact Wiktextract verb-form tag strings are the same
"confirm-against-the-real-dump" boundary as the noun gender/plural tags. This
module is fixture-driven; the user verifies/adjusts the tag matching on the
local import run (documented alongside the existing seams).

## 5. `mapEntry.js`

Change `verb: null` → `verb: word.verb ?? null` (pass the parsed block through).
All other fields unchanged. Output must still pass `validateLexiconEntry`.

## 6. Testing

- **Parser** (`parseWiktextract.test.js`): fixtures for
  (a) a full verb (all six present + partizip2 + aux) → complete block;
  (b) a partial verb (present + partizip2, no aux) → block with `aux: null`;
  (c) a verb with no usable form data → `verb: null`.
- **Validator** (`validate.test.js`): a verb entry with `verb: null` is now
  **valid** (replaces the old "throws when a verb has no block" test); a partial
  block is valid; a block with a bad `aux` (e.g. `'werden'`) throws; a `present`
  missing a key throws. Keep the existing "accepts a full verb" test.
- **`mapEntry`** (`mapEntry.test.js`): a verb word maps to a valid entry with the
  passed-through block.
- **Filter** (`filter.test.js`): a verb with a gloss + example is **kept**
  (replaces the old "drops a verb without a verb block" test).

## 7. UI (deferred — not in this change)

Imported verbs appear as ordinary cards (lemma + gloss + example) via the
frequency/CEFR/tag auto-decks. Rendering the conjugation (Perfekt, er-form,
present table) is a separate future UI pass. The data is carried through
`resolveCard` (already passes `verb`) so a later UI change needs no pipeline work.

## 8. Out of scope (YAGNI)

Präteritum / Konjunktiv / imperative; separable-prefix reconstruction; a full
conjugation-table view; verb-only decks; defaulting an unknown `aux` to `haben`
(we keep `null` rather than fabricate).

## 9. Risks

- **Wiktextract verb-tag variance:** person/number/tense tag spellings may differ
  from the assumed set; the fixture encodes the best-known form and the user
  confirms locally. A mismatch yields `verb: null` (safe degradation), not a crash.
- **`er` slot collision:** 3rd-person-singular present often equals 2nd-plural
  (`geht`); each is tagged distinctly, so they map to separate slots correctly.
- **Coverage vs. quality:** best-effort means some shipped verbs carry sparse or
  `null` blocks. Acceptable per the chosen policy; the data-only scope means no
  half-filled conjugation is shown to a learner yet.
