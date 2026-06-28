# Rich vocabulary lexicon + dataset import — Design

Date: 2026-06-28
Status: Approved (brainstorming) — pending spec review
Owner: Claude (architecture/spec), implementation TBD per AGENTS.md division

## Goal

Make the German content package both **richer** (each word fully modeled:
gender, plural, part of speech, IPA, example sentences, verb detail, CEFR,
frequency, tags) and **larger** (thousands of words), without breaking the
current offline-first app or the existing SRS history.

Approach chosen during brainstorming:

- **Structure first, then bulk-fill** (two phases, one sub-project).
- Organize as a **normalized lexicon + decks-as-views**.
- **Import** a public dataset rather than hand-author or AI-generate.
- Primary source **Wiktionary via Wiktextract / kaikki.org** (CC BY-SA 4.0,
  accepted), example sentences from **Tatoeba** (CC BY 2.0 FR), word ordering
  from a **Leipzig Corpora frequency list** (CC BY).
- First import target **~5,000 words (A1–B1)**, frequency-ranked.
- Quality gate: **automated validation + filters, plus a ~5% manual spot-check.**

## Background: current state

Content lives in `src/data/content.js` and is exposed through the `LanguagePack`
contract in `src/packs/de/index.js` (currently **Phase 0** — it re-exports
`content.js`; `grammar`/`prompts` are empty stubs).

A vocab card today is minimal: `{ de: 'das Brot', en: 'bread', ipa: '[…]', id }`
where `id = card.de` (the surface form). Decks are arrays of full card objects
(`PRESET_DECKS[deckId]`), keyed by theme (greetings/food/travel/numbers, 10 each).

### Consumers that constrain the design

Every consumer reads `content.decks[deckId]` as an **array of card objects** and
SRS keys off `card.id`. These must keep working unchanged in shape:

- `src/App.jsx` — `getDueCount(srs, PRESET_DECKS, now)`
- `src/components/VocabTab.jsx` — `PRESET_DECKS[deckId]`; reads `card.de`,
  `card.en`, `card.ipa`, `card.id`; `activePack.cardId(c)` for custom decks
- `src/components/stats/VocabSrsWidget.jsx` — iterates `PRESET_DECKS`
- `src/packs/de/index.js` — `cardId = (card) => card.de`

**Hard constraint:** `content.decks[deckId]` must continue to return an array of
`{ de, en, ipa, id, … }` objects, with `de` in display form (`'das Brot'`), and
existing curated cards must keep their current ids so SRS progress survives.

## Phase B — Structure first

Introduce the lexicon + resolver and prove it end-to-end by migrating the
existing 40 cards into the new shape. **No new content in this phase.**

### Data model — `LexiconEntry`

```js
{
  id: 'n:brot',            // stable key: pos-prefix + normalized lemma;
                           // disambiguated for homographs (e.g. 'n:bank-seat',
                           // 'n:bank-money')
  de: 'Brot',              // headword (lemma, no article)
  article: 'das',          // 'der' | 'die' | 'das' for nouns; null otherwise
  en: ['bread'],           // gloss(es); array, first is primary
  pos: 'noun',             // 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | ...
  ipa: '[bʁoːt]',          // nullable
  plural: 'Brote',         // nouns; nullable
  cefr: 'A1',              // 'A1' | 'A2' | 'B1' | null — derived from freq band
  freqRank: 142,           // 1 = most frequent; null if unknown
  tags: ['food'],          // topical tags; may be []
  examples: [              // from Tatoeba; may be []
    { de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }
  ],
  verb: null,              // verbs only:
                           // { aux: 'haben'|'sein', partizip2: 'gegangen',
                           //   present: { ich, du, er, wir, ihr, sie } }
  source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' }
}
```

Notes:

- **Headword vs display.** Lexicon stores the lemma in `de` (`'Brot'`). The
  resolver composes display form for nouns: `article ? `${article} ${de}` : de`.
- **ID scheme.** Lexicon ids are pos-prefixed normalized lemmas with a
  disambiguation suffix only when two entries collide. These are *new* ids — no
  prior SRS history depends on them. The 4 existing curated decks keep their
  current surface-form ids so their SRS progress is preserved.

### Decks-as-views

A deck becomes metadata + references (or an auto-rule), not full cards:

```js
decks: {
  // curated, referencing lexicon entries by id
  food: { name: 'Food', icon: '🍞', cardIds: ['n:brot', 'n:kaese', /* … */] },
  // generated from frequency band
  'a1-core': { name: 'A1 Core 100', icon: '⭐', auto: { by: 'freq', range: [1, 100] } },
}
```

### Resolver

`resolveDeck(deckId, lexicon)` joins a deck definition to the lexicon and returns
**the same `[{ de, en, ipa, id, … }]` array consumers already use**, with:

- `de` composed to display form (article + lemma for nouns),
- the new fields (`article`, `plural`, `pos`, `cefr`, `examples`, `verb`, `tags`,
  `freqRank`) attached for opt-in use,
- stable `id` passed through.

`content.decks` becomes a resolved accessor (object keyed by deckId → resolved
array) so `App.jsx`, `VocabSrsWidget`, and `VocabTab` deck access are untouched
in shape. Auto decks resolve by filtering/sorting the lexicon by the rule.

### Phase B UI

Plumb the new fields through `VocabTab` (progressive, additive): show
gender/plural for nouns and at least one example sentence on the card. No layout
redesign; existing tests stay green.

## Phase A — Bulk-fill (import pipeline)

### Pipeline (`scripts/import-lexicon/`, offline only — never at runtime)

1. **Download** sources (Wiktextract German JSONL from kaikki.org, Tatoeba
   de↔en sentence pairs, Leipzig frequency list). Cache raw downloads locally
   (gitignored).
2. **Parse** Wiktextract German entries.
3. **Join** Tatoeba example sentences (de with linked en translation) to lemmas.
4. **Order** by Leipzig frequency; take the top ~5,000; derive `cefr` from
   frequency bands.
5. **Map** to `LexiconEntry`.
6. **Validate** each entry against the strict schema (see Quality gate).
7. **Filter** — drop entries missing required fields (nouns need `article`;
   every entry needs ≥1 clean example), apply profanity/length filter to example
   sentences.
8. **Write** chunked JSON artifacts + a `manifest.json` to
   `src/packs/de/lexicon/`.
9. **Emit a report** (counts in/out, rejection reasons, random sample) to drive
   the spot-check.

The pipeline is deterministic and re-runnable; bumping the target N just re-runs
it.

### Loading strategy (5k words)

- The **4 curated decks stay inline** in `content.js` (instant, offline).
- The **lexicon ships as chunked JSON** under `src/packs/de/lexicon/`, chunked by
  frequency band (and/or first letter), loaded via dynamic `import()` only when a
  large/auto deck is opened.
- Chunks are cached by the PWA service worker for offline use after first load.
- A small `manifest.json` lets the resolver know which chunk holds which ids /
  frequency range without loading everything.

### Quality gate

- **Schema validator** — extend `src/packs/validate.js` with
  `validateLexiconEntry` (required field types, enum checks for `pos`/`article`/
  `cefr`, verb sub-shape).
- **Automated filters** — required-field enforcement; profanity + length filter
  on example sentences; dedupe by id.
- **Manual ~5% spot-check** from the import report before committing artifacts.

### Licensing

- Add `CONTENT_LICENSE.md`: CC BY-SA 4.0 for Wiktionary-derived lexicon data,
  CC BY for Tatoeba sentences and the Leipzig frequency list, with attribution
  text for each.
- Add an in-app attribution line (e.g. in the vocab/about area).
- App **code** stays MIT; the **imported-content subset** is CC BY-SA 4.0. Note
  this distinction in `CONTENT_LICENSE.md` and reference it from `README.md`.

## Testing

- **Unit:** `validateLexiconEntry` (valid + each invalid case); `resolveDeck`
  (curated + auto decks; composes article into display `de`; attaches new fields;
  preserves stable id); homograph id disambiguation.
- **Regression:** existing `src/data/content.test.js` and `VocabTab` tests stay
  green (deck shape unchanged).
- **Pipeline:** fixture-based test of the mapper — a small raw Wiktextract sample
  → expected `LexiconEntry` — so parsing logic is verifiable without network.

## Out of scope (YAGNI)

- Audio file generation (keep IPA + existing TTS hint only).
- New tabs or a vocab UI redesign (additive fields only).
- Multi-language packs (the contract already anticipates this; not this work).
- Runtime AI generation of core decks.
- Importing more than ~5,000 words in the first pass.

## Open questions / risks

- **Bundle weight:** ~5k rich entries may be several MB. Chunking + lazy load +
  service-worker cache mitigates; validate actual sizes during Phase A and adjust
  chunk granularity.
- **Homographs:** disambiguation suffix scheme must be deterministic and stable
  across re-imports (so SRS ids don't churn). Lock the rule in Phase A before
  committing artifacts.
- **CEFR-from-frequency** is an approximation, not authoritative leveling; label
  it as such in-app if surfaced.
- **Source drift:** kaikki/Tatoeba dumps change over time; pin dump versions in
  the pipeline and record them in `manifest.json`.
