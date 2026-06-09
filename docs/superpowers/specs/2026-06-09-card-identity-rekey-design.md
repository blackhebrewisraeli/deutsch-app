# Card-Identity Re-key — Phase 1 Design (sub-project 1 of 5)

**Date:** 2026-06-09
**Status:** Approved design / ready for implementation plan.
**Phase:** Phase 1 of the multi-language refactor — **sub-project 1: card-identity re-key.**
**Builds on:** [`2026-06-09-languagepack-contract-design.md`](./2026-06-09-languagepack-contract-design.md) (Phase 0, merged) and [`AUDIT_GERMAN_COUPLING.md`](../../AUDIT_GERMAN_COUPLING.md) findings #10–14.
**Scope:** Make the engine key SRS/stats on a language-neutral `card.id` instead of the
German surface form `card.de`. **No behavior change; no migration.**

---

## Goal

Today the engine uses the German word (`card.de`) as the identity for spaced-repetition and
stats. That blocks a second language (a Spanish card has no `de` field). This sub-project
makes the engine key on `card.id`, supplied by the pack — so the engine stops assuming any
language-specific field. German sets `id = card.de`, which keeps every saved key identical.

---

## Decision (approved)

**`id = card.de` for German, with zero migration.** The engine reads `card.id`; the German
pack sets each card's `id` to its `de` value. Because `id === de`, all existing localStorage
keys stay byte-identical — no migration code, no state version bump, no risk to saved
progress. (Rejected: independent stable ids + a one-time migration — more robust against
content edits, but touches saved progress and must handle custom AI decks. Deferred; not
needed for multi-language.)

This mirrors Phase 0's "behaves identically / lowest-risk" ethos.

---

## Mechanism — `card.id` + a pack-owned id rule

- Every card carries an **`id`** field. The engine reads **`card.id`** and never `card.de`
  again, so it is language-blind.
- The id rule lives on the pack: add **`cardId(card) => string`** to the `LanguagePack`
  contract (top-level, alongside `meta`/`content`/`validation`/`grammar`/`prompts`). German:
  `cardId: (card) => card.de`. A future pack returns its own term or a slug.
- Cards keep `de`/`en`/`ipa` for display — we only **add** `id`, never remove `de`.

### Where the id gets attached

- **Preset decks:** the German pack tags every card at build time — `map` over
  `PRESET_DECKS` setting `id = cardId(card)` — so `activePack.content.decks` cards arrive
  with `id` already present.
- **Custom AI decks:** when `VocabTab` generates a deck, it tags each generated card via
  `activePack.cardId(card)` before use. The id convention stays in one language-appropriate
  place (the pack), never hardcoded as `card.de` in the component.

---

## Footprint — what changes

| File | Change |
|------|--------|
| `src/packs/de/index.js` | add `cardId(card) => card.de`; tag preset-deck cards with `id` |
| `src/lib/srs.js` | `srsKey(deckId, id)`; `getDueCards`/`getDueCount` read `card.id`; `srsApply`/`recordVocabAnswer` take `id`; update the storage-shape comment to `<deckId>:<id>` |
| `src/lib/gamification.js` | `decksMastered` → `srsKey(deckId, card.id)` |
| `src/components/VocabTab.jsx` | pass `card.id` to the SRS recorder, `markLearned(card.id)`, and `recordItem('vocab', deckId, card.id, …)`; tag custom-deck cards via `activePack.cardId` |
| `src/packs/validate.js` | extend the Phase 0 shape checker to require `cardId` to be a function |

**`stats.js` is untouched** — it is already generic (`itemKey(tab, context, label)`); only the
*label* VocabTab passes changes from `card.de` to `card.id`. **Translate items already key on
English** (`recordItem('translate', level, exercise.en, …)`) — left alone.

The engine's `de` parameters/local names are renamed to `id` (or `cardId`) for clarity, since
the values are now language-neutral ids.

---

## Zero-migration guarantee

Because `id === de` for every German card:

- SRS keys `'<deckId>:<id>'` === today's `'<deckId>:<de>'`.
- `learnedWords` keys (`markLearned(card.id)`) === today's `card.de` keys.
- Vocab `items` keys (`vocab:<deckId>:<id>`) === today's `vocab:<deckId>:<de>`.

Existing `deutsch-app-state-v1` blobs load and match unchanged. No migration, no version bump.

---

## Testing

- `cardId` returns `card.de` for German.
- `validateLanguagePack` rejects a pack whose `cardId` is missing or not a function.
- Preset decks expose cards with an `id` equal to `de`.
- **`srsKey(deckId, card.id) === srsKey(deckId, card.de)`** — proves the byte-identical claim.
- `getDueCards`/`getDueCount` and `decksMastered` still behave correctly against id-keyed SRS.
- Custom-deck cards are tagged with an `id` after generation.
- The full suite (220+ on main) staying green is the primary guardrail — it exercises the
  answer flow, the due-queue, and gamification.

---

## Scope

**This sub-project:** only the card-identity re-key across `srs`, `learnedWords`, and vocab
`items`.

**Not here (separate Phase 1 cycles, each its own spec→plan):**
2. `validation.normalize` diacritics (ß/ä/ö/ü policy)
3. move AI prompt strings into pack `prompts`
4. populate `grammar`
5. physically move `content.js` into `src/packs/de/`

**Not in Phase 1 at all:** storage-key namespacing + the `deutsch:progress` event (Phase 4);
the German rank/achievement display strings in `gamification.js` (i18n, Phase 4).
