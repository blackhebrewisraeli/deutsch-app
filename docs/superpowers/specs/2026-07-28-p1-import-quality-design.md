# P1 Import Quality — German-Only Examples + CEFR Re-banding

Date: 2026-07-28
Status: Approved (brainstorming) — pending spec review
Tracked as: `docs/DEMO_READINESS.md` P1 items #3 and #4
Scope: two pipeline changes that land in **one** import re-run.

## Problem

**#3 — Usable example sentences are discarded for lacking a translation.**
`cleanExamples` (and `validateLexiconEntry`) require every example to carry both
German *and* English text. `parseWiktextract` already emits Wiktionary's own
examples as `{ de, en: null }` when no translation exists, so those are thrown
away wholesale: **4,545 German lemma entries** in the dump have examples that are
German-only. The last import dropped **537 words** for "no example".

The requirement gates on a field the UI never displays — `VocabTab` renders only
`card.examples[0].de` (the English translation is stored but not shown on the card).

**#4 — 81% of the lexicon is labelled B1.** `cefrForRank` bands on **raw Leipzig
rank** (≤1000 → A1, ≤2500 → A2, else B1), but the import keeps the top 5,000
*parsed Wiktextract entries* by rank, which reach down to rank **12,695**. Almost
everything therefore falls past 2,500. Current: A1 284 / A2 567 / **B1 3,567**.
This is the same root cause as the auto-deck bug fixed in PR #62 — a raw-rank
threshold applied to a set that is not distributed the way the threshold assumes.

## 1. German-only examples

A relaxation — no new logic, just stop discarding data the parser already produces.

- **`src/packs/validate.js`** — `examples[].en` becomes `null | non-empty string`
  (the same nullable treatment `ipa`, `plural`, and `partizip2` already receive).
  `de` and `source` remain required and non-empty.
- **`scripts/import-lexicon/filter.js`** — `cleanExamples` drops the `!e.en`
  rejection. The length cap (120 chars) and the profanity blocklist continue to
  apply to `e.de` exactly as today.
- **`scripts/import-lexicon/joinTatoeba.js`** — `pickExamples` accepts
  `rawExamples` entries that have `de` but no `en`. Ordering is unchanged
  (Tatoeba examples first, then the Wiktextract fallback), except that **within**
  the Wiktextract fallback, examples that DO carry a translation are preferred
  over German-only ones — better data first, at no cost.

**No UI change.** The card shows only the German sentence, so a missing
translation is invisible there. Displaying English is a separate design decision
and is explicitly out of scope.

## 2. CEFR re-banding

Band on **position within the kept lexicon** rather than raw rank, so the bands
are stable across re-imports no matter how deep the frequency tail reaches.

**Split: 20 / 30 / 50** (A1 / A2 / B1). Against the current 4,418-entry lexicon
that yields **A1 884, A2 1,325, B1 2,209** — a focused A1 core, with B1 still the
broadest band (correct pedagogically) but no longer 81%.

**Pipeline ordering change.** CEFR is currently assigned inside `assignRanks`,
which runs *before* `applyFilter` — at that point the final kept set is unknown,
so percentile banding is impossible there. Therefore:

- `assignRanks` (in `scripts/import-lexicon/rankLeipzig.js`) sets **only**
  `freqRank`; it no longer sets `cefr`. Entries reach `mapEntry` without a `cefr`,
  and `mapEntry`'s existing `cefr: word.cefr ?? null` yields `null` — which
  `validateLexiconEntry` already permits.
- A new pure function in the same module:
  `assignCefrBands(entries, { a1 = 0.2, a2 = 0.5 } = {})` — sorts a copy of
  `entries` by `freqRank` ascending (nulls last), assigns `'A1'` to the first
  `round(n * a1)`, `'A2'` to the next `round(n * a2) - round(n * a1)`, and `'B1'`
  to the remainder. Returns the entries with `cefr` set. Does not mutate its input
  array's order.
- `run()` in `scripts/import-lexicon/index.js` calls `assignCefrBands(kept)`
  **after `applyFilter` and before `buildArtifacts`**.
- `cefrForRank` in `scripts/import-lexicon/ids.js` becomes dead and is **removed**
  along with its unit tests.

## 3. Regeneration and verification

Re-run `npm run import:lexicon` (the raw download cache is warm) and commit the
regenerated `public/lexicon/` artifacts.

Two existing guards cover the new data automatically:
- `src/packs/lexiconSample.test.js` — every index row resolves to a present,
  valid entry; manifest/index/chunk packing consistent.
- `src/packs/de/autoDecks.population.test.js` — all 13 shipped decks resolve to
  ≥40 cards. This now meaningfully exercises the **CEFR decks**, whose membership
  this change alters.

**Success criteria.** Entry count **above** 4,418; "no example" rejections
**below** 537; CEFR distribution approximately 20/30/50. If any of these moves the
wrong way, stop and report rather than committing the artifacts.

## 4. Testing

- **Validator**: an example with `en: null` is valid; `en: ''` is invalid; a
  missing/empty `de` still throws; `source` still required.
- **`cleanExamples`**: keeps a German-only example; still drops over-long and
  blocklisted ones; still drops examples with no `de`.
- **`pickExamples`**: accepts German-only `rawExamples` (tagged
  `source: 'wiktionary'`); prefers translated Wiktextract examples over
  German-only ones; Tatoeba examples still come first; `max` still respected.
- **`assignCefrBands`**: 20/30/50 proportions on a synthetic set; nulls-last
  ordering; does not mutate input order; handles an empty array.
- **`assignRanks`**: no longer returns `cefr`.
- Existing suites stay green.

## 5. Out of scope

Tatoeba lemma stemming (measured: rescues 47 lemmas, ~0.9%); AI-translating
German-only examples; showing the English translation on the card; changing the
top-N import size or the 120-char example length cap.

## 6. Risks

- **Entry count shifts chunk boundaries.** More kept entries may add a chunk;
  `buildArtifacts` handles this and the artifact guard verifies packing.
- **CEFR deck membership changes wholesale.** Intended. The population guard
  confirms none of the three collapses below 40.
- **German-only examples are untranslated text shown to a learner.** They come
  from Wiktionary — the same source and trust level as the rest of the entry —
  and remain length- and profanity-filtered. The card shows German only anyway.
