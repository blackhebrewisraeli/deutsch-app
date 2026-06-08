# LanguagePack Contract — Phase 0 Design

**Date:** 2026-06-09
**Status:** Approved design / ready for implementation plan.
**Phase:** Phase 0 of the multi-language platform refactor.
**Builds on:** [`2026-06-09-multi-language-platform-design.md`](./2026-06-09-multi-language-platform-design.md) (direction note).
**Scope:** Define the language-agnostic `LanguagePack` interface and load the existing
German content through it. German stays the only pack; **the app behaves identically.**
Latin-script, LTR only (per the direction note).

---

## Goal

Introduce a single, stable `LanguagePack` interface so the engine assumes nothing about
the language. The existing German content loads *through* the interface instead of being
imported directly. This unlocks every later phase (validation/grammar extraction, theming,
a second language) without forcing that work into Phase 0.

---

## Decisions (brainstormed & approved)

1. **Contract scope — full shape now, fill incrementally.** The complete interface
   (`meta`, `content`, `validation`, `grammar`) is defined now. Phase 0 wires only
   `content`; `validation`/`grammar` are declared but populated in Phase 1. Rationale:
   one stable contract consumers code against once.
2. **Content mapping — faithful, lightly generalized.** One contract field per content
   type; German *item* shapes are preserved unchanged. German-specific *buckets* generalize
   into keyed/level-keyed maps so the contract isn't boxed into German's categories
   (no hardcoded `A1/A2/B1` or `greetings/food/travel/numbers` in the interface).
3. **Validation boundary — pack normalizes, engine matches.** The pack owns
   `normalize(s)` (and an optional `accepts`); the engine owns the matching algorithms
   (exact for tiles, fuzzy Levenshtein-with-threshold for vocab), run on normalized
   strings. Levenshtein stays language-agnostic and is not duplicated per pack.
4. **Access — module singleton.** `src/packs/index.js` exports `activePack`. This matches
   the codebase's existing import-based, no-Context conventions (state today is direct
   module imports + `localStorage`, refreshed on window focus). A Context/hook can wrap
   the singleton in Phase 4 when the language picker arrives; the singleton does not block it.

---

## Architecture — three layers

- **Engine** (`src/lib/*`) — SRS, gamification, stats, storage, and a new `matching` module.
  Language-blind.
- **Pack** (`src/packs/de/`) — German data + config behind the `LanguagePack` interface.
- **Theme** — `meta.themeId` → a theme-tokens module (extracted in Phase 2).

**Access mechanism.** A new `src/packs/index.js` exports `activePack` (German). The 8 sites
that currently `import … from '…/data/content'` (6 components, `App.jsx`, and
`src/lib/gamification.js`) switch to reading off `activePack`. No new runtime machinery;
smallest possible diff.

---

## The `LanguagePack` interface

```js
LanguagePack {
  meta: {
    id,          // 'de' — also the per-language storage namespace key (used in Phase 4)
    name,        // 'German'
    nativeName,  // 'Deutsch'
    locale,      // 'de-DE' — drives speech.js (SpeechSynthesis) + Intl formatting
    direction,   // 'ltr'   (only ltr in current scope)
    flag,        // emoji or asset reference
    themeId,     // 'de'    → theme tokens (Phase 2)
    cefrLevels,  // ['A1','A2','B1'] — declared by the pack, NOT hardcoded in the engine
  },

  content: {                                  // ← Phase 0 wires these from today's content.js
    alphabet,            // AlphabetEntry[]           (from ALPHABET)
    alphabetQuiz,        // QuizGroup[]               (from ALPHABET_QUIZ_GROUPS)
    decks,               // Record<string, Card[]>    (from PRESET_DECKS — keyed map)
    scenarios,           // Scenario[]                (from SCENARIOS)
    chatTasks,           // Record<string, ChatTask>  (from CHAT_TASKS — keyed map)
    translateSentences,  // Record<Level, Sentence[]> (from TRANSLATE_SENTENCES_* — level-keyed)
  },

  validation: {                               // ← declared now, populated in Phase 1
    normalize,           // (s: string) => string  — case/whitespace/diacritic policy (pack-owned)
    accepts,             // optional (expected, given) => boolean; default = normalize-then-equals
  },

  grammar: {                                  // ← declared now, populated in Phase 1
    genders,             // article/gender system (der/die/das), engine-neutral data
    notes,               // cultural / usage nuance
  },
}
```

Item shapes (`Card`, `Scenario`, `ChatTask`, `Sentence`, `AlphabetEntry`, `QuizGroup`)
remain **exactly** as today's `content.js`. Only the German-specific buckets generalize.

---

## German pack: content mapping

| Today (`src/data/content.js`)            | Contract field (`content.*`)         | Shape                         | Change |
|------------------------------------------|--------------------------------------|-------------------------------|--------|
| `ALPHABET`                               | `alphabet`                           | `AlphabetEntry[]`             | none   |
| `ALPHABET_QUIZ_GROUPS`                   | `alphabetQuiz`                       | `QuizGroup[]`                 | none   |
| `PRESET_DECKS` (greetings/food/…)        | `decks`                              | `Record<string, Card[]>`      | none (already keyed) |
| `SCENARIOS`                              | `scenarios`                          | `Scenario[]`                  | none   |
| `CHAT_TASKS` (free/coffee/meet/airport)  | `chatTasks`                          | `Record<string, ChatTask>`    | none (already keyed) |
| `TRANSLATE_SENTENCES_A1/A2/B1`           | `translateSentences`                 | `Record<Level, Sentence[]>`   | 3 exports → one level-keyed map; levels declared in `meta.cefrLevels` |

Only `translateSentences` is reshaped (and the CEFR levels move into `meta.cefrLevels`).
Everything else passes through unchanged.

---

## Engine: matching module (`src/lib/matching.js`)

New language-agnostic module wrapping the existing `utils.levenshtein`:

- `exactMatch(expected, given, normalize) => boolean` — used by `translate/TileExercise.jsx`.
- `fuzzyMatch(expected, given, normalize, maxDistance) => { ok, distance }` — used by
  `VocabTab.jsx`.

Both apply the pack's `normalize` to **both** operands before comparing. `utils.levenshtein`
already lowercases internally; since Phase 0's `normalize` also lowercases, this is
idempotent and harmless, so `levenshtein` is left untouched (its tests stay green). The
optional pure-distance tidy of `levenshtein` is deferred to Phase 1.

`TileExercise` moves from raw `answer === correct` to `exactMatch` (normalized equality).
For the curated tile data the verdict is unchanged — tiles are the exact answer tokens — so
this is outcome-identical, with normalization only adding harmless robustness (trim/case).

---

## Validation model

- `normalize(s)` is **pack-owned**. **Phase 0 ships** `normalize = s => s.trim().toLowerCase()`
  — today's behavior (trim + lowercase). It is applied to both operands; for the already-clean
  curated data this matches current outcomes (vocab fuzzy-match stays byte-identical).
- `accepts(expected, given)` is **optional**; when omitted the engine uses
  normalize-then-equals. Declared now for forward-compatibility; German does not need it in
  Phase 0.
- **Phase 1** enriches `normalize` with the real ß/ä/ö/ü diacritic policy and populates
  `grammar`.

---

## Phase 0 boundaries — "behaves identically"

**Changes:**
- Add `src/packs/index.js` (exports `activePack`) and `src/packs/de/index.js` (assembles the
  German pack from `content.js`).
- Repoint the 8 import sites from `data/content` to `activePack`.
- Route `VocabTab` and `TileExercise` answer-checking through `src/lib/matching.js`.

**Guarantees / non-changes:**
- **Answer-checking outcomes unchanged** for the curated content: vocab fuzzy-match is
  byte-identical; `TileExercise` moves from raw `===` to normalized `exactMatch` but yields
  the same verdicts (tiles are the exact answer tokens).
- **Storage untouched:** key stays `'deutsch-app-state-v1'`. Per-language namespacing
  (prefix by `meta.id`) plus a one-time migration off the old key is **Phase 4** — changing
  it now would orphan existing users' saved progress.
- **`content.js` stays in place** as the raw German data; `packs/de` wraps it. Physically
  moving it into `packs/de/` is deferred to Phase 1 (lowest risk now).

---

## Testing & isolation

- The pack is pure data + pure functions → directly unit-testable.
- Add `validateLanguagePack(pack)` — asserts a pack satisfies the shape (required `meta`
  fields, `content` keys present and correctly typed, `validation.normalize` is a function).
  Pays off when the Spanish pack (Phase 3) drops in, and guards regressions.
- `matching.js` functions are pure → unit tests (happy path + fuzzy threshold edges).
- These tests are good candidates to hand to **Cursor** once the contract lands.

---

## Deferred to later phases (recorded so nothing is lost)

- **Phase 1** — populate `validation.normalize` (diacritic policy) + `grammar`; physically
  move `content.js` into `src/packs/de/`; optional `levenshtein` pure-distance tidy.
- **Phase 2** — extract theme tokens from components; bind via `meta.themeId`.
- **Phase 3** — add a second pack (e.g. Spanish) to validate the abstraction (the real proof).
- **Phase 4** — language-picker UI; per-language storage namespacing (`meta.id` prefix) with a
  one-time migration off `'deutsch-app-state-v1'`.

---

## Open questions (carried from the direction note; none block Phase 0)

- Scenarios/chat tasks: shared across languages or authored per pack? (Phase 3 concern.)
- Theme ↔ pack binding: fixed 1:1 or user-selectable? (Phase 2.)
- Pack distribution: bundled vs. on-demand? (Phase 3+.)
- Content authoring: hand-written vs. AI-generated vs. community? (Phase 3+.)

Phase 0 does not depend on any of these.
