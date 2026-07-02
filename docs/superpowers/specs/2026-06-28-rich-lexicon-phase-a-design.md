# Rich Lexicon — Phase A (Import + Runtime) Design

Date: 2026-06-28
Status: Approved (brainstorming) — pending spec review
Depends on: Phase B (merged/landing as PR #56) — `validateLexiconEntry`, `resolveCard`,
the `LexiconEntry` shape, and `decks.js`/`index.js` pack wiring.
Parent spec: `docs/superpowers/specs/2026-06-28-rich-lexicon-import-design.md`

## Goal

Bulk-fill the lexicon: import ~5,000 frequency-ranked A1–B1 German words (rich
entries with gender/plural/pos/IPA/examples/verb detail/cefr/tags) from public
datasets, deliver them to the runtime as lazy-loaded chunks, and surface them as
frequency / CEFR / topical decks — without bloating the bundle, breaking offline
use, or churning SRS history.

## Decisions locked in brainstorming

- **Import runs locally** (the user runs it). This work builds + verifies the full
  pipeline and runtime wiring here against fixtures + a small committed sample; the
  user runs the heavy import locally and commits the generated artifacts.
- **Delivery: chunked + manifest** static JSON, lazy-fetched, PWA-cached.
- **Decks: all three** types ship — frequency bands, CEFR levels, and a curated
  allow-list of topical decks.
- Sources (from parent spec): **Wiktextract/kaikki.org** German (CC BY-SA 4.0),
  **Tatoeba** sentences (CC BY), **Leipzig** frequency (CC BY).

## Architecture: two halves, one contract

Phase A splits into two independently reviewable/landable halves that share the
artifact contract in §1:

- **A-i — Offline import pipeline** (`scripts/import-lexicon/`): downloads + grinds
  the datasets, writes static artifacts. Run locally via `npm run import:lexicon`.
- **A-ii — Runtime loading + decks + UI**: an async lexicon store that lazy-fetches
  chunks, the new auto-deck definitions, and `VocabTab` loading states.

The implementation plan is written as A-i then A-ii.

## 1. Artifact contract (the seam)

Static files under `public/lexicon/`:

- **`manifest.json`**
  ```json
  {
    "version": 1,
    "generatedAt": "2026-06-28T00:00:00Z",
    "sources": {
      "wiktextract": "<kaikki dump id/date>",
      "tatoeba": "<dump date>",
      "leipzig": "<corpus id>"
    },
    "total": 5000,
    "chunkSize": 500,
    "chunkCount": 10
  }
  ```
- **`index.json`** — lightweight selection index for every entry (~5k × ~60 B ≈
  300 KB / ~80 KB gz):
  ```json
  [{ "id": "n:brot", "rank": 142, "cefr": "A1", "tags": ["food"], "chunk": 0 }]
  ```
  Drives which entries a deck contains without loading full data.
- **`chunk-NN.json`** — `{ [id]: LexiconEntry }`, ~`chunkSize` full rich entries per
  chunk. Chunk index = `floor((rank - 1) / chunkSize)`.

`LexiconEntry` is the Phase B shape (validated by `validateLexiconEntry`), now with
real `freqRank`, `cefr`, `tags`, and `examples` populated.

## 2. ID scheme (stable, deterministic — SRS-critical)

- `id = "{posPrefix}:{lemmaSlug}"`. `posPrefix`: `n|v|adj|adv|prep|num|pron|conj`.
  `lemmaSlug`: lemma lowercased, German chars preserved, spaces→`-`.
- **Homograph collision:** when two entries share `pos:lemmaSlug`, ALL colliding
  entries get a gloss-slug suffix: `n:bank:bench`, `n:bank:financial`. Applied to
  every member of the collision set (not just the 2nd), so the id is identical
  regardless of import order → re-runs do not churn ids.
- Imported ids use this scheme. The **40 curated cards keep their legacy
  surface-form ids** (`das Brot`) untouched. The two stores coexist; minor overlap
  (a curated word also present in a frequency deck) is accepted and documented.

## 3. Import pipeline (A-i)

Focused modules under `scripts/import-lexicon/`, each pure/testable:

| Module | Responsibility |
|--------|----------------|
| `download.js` | Fetch raw dumps to a gitignored cache dir; skip if present. |
| `parseWiktextract.js` | Stream the German JSONL; extract lemma, pos, gender/article, plural, IPA, glosses, verb detail. |
| `joinTatoeba.js` | Attach up to N (default 2) example sentences (de + linked en) per lemma. |
| `rankLeipzig.js` | Assign `freqRank` from the frequency list; derive `cefr` band. |
| `mapEntry.js` | Compose a `LexiconEntry` from the joined data. |
| `filter.js` | Drop entries failing required-field rules (nouns need `article`; every entry needs ≥1 example post-filter); profanity + length filter on example sentences. |
| `validate.js` (reuse) | `validateLexiconEntry` on every surviving entry. |
| `chunk.js` | Sort by rank, write `chunk-NN.json`, `index.json`, `manifest.json`. |
| `report.js` | Emit counts in/out, rejection reasons, and a random sample for the ~5% spot-check. |

Orchestrated by `scripts/import-lexicon/index.js`; wired as `npm run import:lexicon`.

- **Top-N selection:** take the top 5,000 by Leipzig rank that survive parsing +
  filtering (re-runnable with a different N).
- **CEFR bands:** rank 1–1000 → A1, 1001–2500 → A2, 2501–5000 → B1 (approximate;
  labeled as such in-app).
- **Profanity/length filter:** reject example sentences over a length bound or
  matching a small bundled blocklist; if an entry loses all examples it is dropped
  (consistent with the ≥1-example rule).

## 4. Runtime loading (A-ii)

`src/packs/lexiconStore.js`:

- `loadIndex()` → fetch + memo `index.json`.
- `loadChunks(chunkIds)` → fetch + memo the named `chunk-NN.json` files.
- `resolveAutoDeck(deckDef)` → **async**: filter the index by the deck rule (freq
  range / cefr / tag) to an ordered id list → collect needed chunk ids →
  `loadChunks` → build `{id:entry}` → reuse Phase B `resolveCard` → ordered card
  array (legacy `{de,en,ipa,id,…}` shape).
- In-memory caching of index + chunks. A **PWA runtime-caching rule** for
  `/lexicon/*.json` (via `vite-plugin-pwa` / Workbox) makes them available offline
  after first load.

The Phase B synchronous `resolveDecks(DECKS, LEXICON)` continues to serve the
inline curated decks. Auto decks over the big lexicon go through the async store.

### Deck definitions (A-ii)

Added to `decks.js` (or a sibling) as auto-deck defs with a `group` label:

- **Frequency:** `Core 100` `{ auto:{by:'freq',range:[1,100]} }`, `Top 500`
  `{ auto:{by:'freq',range:[1,500]} }`.
- **CEFR:** `A1` / `A2` / `B1` `{ auto:{by:'cefr',level:'A1'|...} }`.
- **Topical:** a curated allow-list (~8–10) of `{ auto:{by:'tag',tag:'food'} }` etc.,
  drawn from Wiktextract topic labels — only well-populated, clean topics ship.

`resolveDeck`'s `auto.by==='tag'` branch is added (Phase B had freq + cefr).

## 5. UI (A-ii)

- `VocabTab` deck list groups decks: **Curated / Frequency / CEFR / Topics**.
- Selecting an async deck shows a **loading state** while chunks fetch, then renders
  normally. Curated decks remain instant.
- Fetch failure → retry / offline message; if a chunk is cached (PWA) it loads
  offline.
- SRS unchanged (keys off `card.id`).

## 6. Licensing & docs

- `CONTENT_LICENSE.md`: CC BY-SA 4.0 (Wiktionary-derived lexicon), CC BY (Tatoeba
  sentences, Leipzig frequency), with attribution text for each.
- In-app attribution line (vocab/about area).
- `README` section: how to run `npm run import:lexicon`, pinned dump URLs/versions,
  and the note that app code is MIT while the imported-content subset is CC BY-SA.

## 7. Testing

- **Pipeline:** fixture-driven unit tests for `parseWiktextract`, `joinTatoeba`,
  `mapEntry`, `filter`, `chunk` — tiny raw samples → expected output. No network.
- **`lexiconStore`:** mocked `fetch` over a committed sample `public/lexicon/`
  fixture (a handful of entries across ≥2 chunks) — proves index → chunk → resolve
  end-to-end, including caching (fetch called once per chunk).
- **Resolver:** add the `auto.by==='tag'` path; close Phase B gaps (multi-entry
  ascending sort; unknown `auto.by` throw).
- **`VocabTab`:** async deck loading → loaded → error states.

## 8. Out of scope (YAGNI)

- Audio generation; >5,000 words; multi-language packs; runtime AI generation.
- Reconciling/deduping curated-vs-imported overlap (40 words).
- Search/filter UI beyond grouped deck lists.
- Pagination within a deck (the SRS queue already bounds what's shown).

## 9. Open questions / risks

- **Wiktextract topic-label quality** varies; the topical allow-list must be
  validated against the real import (a topic that comes back sparse or noisy is
  dropped). Lock the allow-list after inspecting the import report.
- **Chunk count vs deck spans:** topical/cefr decks span many chunks, so opening
  one may fetch most chunks. Acceptable for ~2.5 MB total; if a single deck would
  pull >~half the chunks, consider a `cefr`/`tag`-sharded chunk layout in a later
  pass. Measure with the real artifacts.
- **CEFR-from-frequency** is an approximation, not authoritative leveling.
- **Source drift:** pin dump versions in `manifest.json`; record them so a re-import
  is reproducible.
- **Sample fixture staleness:** the committed `public/lexicon/` sample used by tests
  must match the artifact schema; if the schema changes, regenerate the sample.
