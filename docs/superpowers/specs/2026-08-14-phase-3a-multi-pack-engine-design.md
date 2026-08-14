# Phase 3a — Multi-Pack Engine

- **Date:** 2026-08-14
- **Status:** Approved
- **Author:** Claude Code (brainstormed with Semion)
- **Parent:** `2026-06-09-multi-language-platform-design.md` (the phase plan)
- **Depends on:** Phase 1.2–1.5 (all shipped; `main` @ `75ea3ae`)
- **Blocks:** 3b (second lexicon), 3c (authored second-pack content), Phase 4
  (picker)

---

## Scope

Make the engine capable of holding more than one language pack: namespace the
chunked lexicon per pack, thread the pack id through the store, and key its
caches so one pack cannot serve another's data.

No second pack is authored here. No picker, no storage namespacing.

---

## Why

### Phase 3 as filed is not one project

The Tier B queue reads "Phase 3 — second language pack". Inventorying what a
pack actually supplies makes the size clear: the German pack is **1,827 lines**
of authored modules plus a **2.4 MB** chunked lexicon, and 6 of the 14 import
scripts are German-specific (`parseWiktextract` reads German Wiktionary
sections; `joinTatoeba` / `prepTatoeba` handle German sentence pairs). That
content took PRs #56–#61 — an arc, not a task.

Phase 3 therefore decomposes:

| Sub-project | What it is |
|---|---|
| **3a** (this spec) | Engine can hold more than one pack |
| **3b** | Source, import and chunk a second language's lexicon |
| **3c** | Authored second-pack content (alphabet, scenarios, chat tasks, translate banks, decks, theme, grammar, prompts) |
| **Phase 4** | Picker + per-language storage |

3a comes first because it is a hard blocker for the others and is the only
piece whose size is knowable today.

### The blocker is a hardcoded path

`lexiconStore.js:3` is `const BASE = '/lexicon'`, and `public/lexicon/` is a
flat directory of `index.json`, `manifest.json` and `chunk-00…08.json`. **Two
packs cannot both ship a chunked lexicon** — the second would overwrite the
first at build time and collide with it at fetch time.

### A subtler blocker: the caches are not pack-aware

`indexPromise` is a single module-level promise and `chunkPromises` is a `Map`
keyed by chunk *number*. With two packs, requesting `chunk-03` for Spanish
after German has loaded returns **German's chunk-03**. Nothing throws: the
shapes match, so the app would render German words in a Spanish deck. This is
the failure this phase exists to make impossible, and it is why §5's
cross-contamination test is the one that matters.

---

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | **Engine only.** No second pack, no picker, no storage namespacing |
| 2 | Path layout | **`/lexicon/<packId>/`.** German moves to `/lexicon/de/` |
| 3 | Pack plumbing | **Thread `packId` as an argument**, following Phase 1.5's precedent for `grammar` |
| 4 | Cache keys | **Keyed by pack**, so one pack cannot serve another's chunks |
| 5 | Registry | **A seam, not a switcher.** `activePack` resolves via `getPack(DEFAULT_PACK_ID)`; selection is Phase 4 |

Decision 3 follows the pattern Phases 1.4 and 1.5 both set — engine modules
take what they need as arguments rather than importing `activePack`. The
alternatives were rejected for reasons that have not changed: a module-level
setter puts hidden global state into a currently-pure module, and importing
`activePack` makes the store unusable for any pack that is not the active one,
which a picker will eventually need.

---

## 1 · Path layout

```
public/lexicon/de/index.json
public/lexicon/de/manifest.json
public/lexicon/de/chunk-00.json … chunk-08.json
```

Eleven files move. `scripts/import-lexicon/index.js:59` changes its default
`outDir` from `public/lexicon` to `public/lexicon/<packId>`, so a re-import
writes where the store now reads.

### The service worker needs no change

`vite.config.js:21` matches `/\/lexicon\/.*\.json$/`. `.*` spans slashes, so
`/lexicon/de/chunk-00.json` is matched by the existing rule. The
`StaleWhileRevalidate` handler and the comment explaining why it is not
`CacheFirst` (PR #76, verified against production 2026-08-01) stay untouched.

`maxEntries: 64` remains ample: German uses 11 entries, so a second pack of
similar size takes the total to ~22.

### German moves, and that costs one refetch

Returning users' cached entries are keyed by the old URLs, so the new paths
miss and refetch — about 2.4 MB, once. Under `StaleWhileRevalidate` that is a
background revalidation rather than a stall, and the stale entries age out at
the existing 30-day expiry.

The alternative — leaving German at `/lexicon` and nesting only new packs —
would require the engine to special-case one pack forever. The one-time
refetch is the cheaper price.

---

## 2 · Signature changes

| Export | After | Why |
|---|---|---|
| `loadIndex()` | `loadIndex(packId)` | fetches `/lexicon/<packId>/index.json` |
| `loadChunks(chunkIds)` | `loadChunks(packId, chunkIds)` | fetches that pack's chunks |
| `resolveAutoDeck(deckDef, grammar)` | `resolveAutoDeck(deckDef, grammar, packId)` | the only export used outside the store |
| `selectRows(index, auto)` | **unchanged** | pure; operates on an already-loaded index |
| `__resetCache()` | **unchanged** | clears both caches |

`VocabTab.jsx:92` passes `activePack.meta.id` alongside the `activePack.grammar`
it already passes.

### One trap in the current code

`loadChunks` today is:

```js
const datas = await Promise.all([...new Set(chunkIds)].map(loadChunk));
```

`.map(loadChunk)` passes `(element, index, array)`. `loadChunk(chunk)` ignores
the extras, so it works. Give `loadChunk` a second parameter without changing
this line and the array **index** silently becomes that argument — fetching
`/lexicon/0/chunk-…`. The call must become an explicit arrow:

```js
.map((c) => loadChunk(packId, c))
```

---

## 3 · Cache keys

```js
const indexPromises = new Map();   // packId → Promise
const chunkPromises = new Map();   // `${packId}:${chunk}` → Promise
```

`indexPromise` becomes a `Map` rather than a single value. Both retry paths —
the `.catch` handlers that clear the entry so a failed fetch can be retried —
delete the pack-scoped key rather than the global one.

`__resetCache()` clears both maps and keeps its signature, so every existing
test calling it is unaffected.

---

## 4 · Registry

```js
// src/packs/index.js
const DEFAULT_PACK_ID = 'de';
export const activePack = getPack(DEFAULT_PACK_ID);
```

A seam, not a switcher: the indirection exists so Phase 4 has somewhere to
introduce selection, but nothing selects anything yet. `PACKS` is already a
map and needs no change.

---

## 5 · Testing

**The cross-contamination test is the point of this phase.** A minimal fixture
pack registered only in the test, then:

1. `loadIndex('de')` fetches `/lexicon/de/index.json`
2. `loadIndex('xx')` fetches `/lexicon/xx/index.json` and returns `xx` data,
   not the cached German
3. `loadChunks('xx', [3])` returns `xx`'s chunk-03 after `loadChunks('de', [3])`
   has already cached German's

Point 3 fails today and would fail silently in production — matching shapes,
wrong language. It is the assertion that proves the caches are genuinely
partitioned rather than merely renamed.

**Also covered:**

- `loadChunks` passes the right chunk numbers after the `.map` fix — a test
  asserting the fetched URL is `/lexicon/de/chunk-03.json` and never
  `/lexicon/0/…` catches the arity trap in §2.
- A failed fetch clears only that pack's cache entry, so a retry re-fetches
  and the other pack's cached index survives.
- `selectRows` is untouched and its existing tests must pass unmodified.

**Two tests read the shipped artifacts from disk and will break on the move.**
Neither goes through `lexiconStore`, so neither is caught by threading:

- `src/packs/lexiconSample.test.js:12` — `const DIR = 'public/lexicon'`, the
  guard that every shipped entry validates.
- `src/packs/de/autoDecks.population.test.js:13` —
  `readFileSync('public/lexicon/index.json')`, the guard that every auto deck
  resolves to enough cards.

Both are one-line path changes, and both are load-bearing: they are what
prove the move did not corrupt or lose the artifacts. `lexiconStore.test.js`
is unaffected on this point — it runs against `src/packs/__fixtures__/lexicon`,
not the shipped files.

**Component tests must pass unmodified.** `VocabTab` gains one argument at one
call site; the rendered deck is identical. Test churn is expected in
`src/packs/lexiconStore.test.js` (signatures) and in the two disk readers
above (paths).

**Build verification:** after the move, `npm run build` must emit the lexicon
under `dist/lexicon/de/`, and the generated `sw.js` must still carry the
runtime-caching rule. A test cannot check this; it is a manual step in the
plan.

---

## 6 · Out of scope

- **Storage namespacing** — Phase 4. `AGENTS.md` states storage keys are
  untouched until then, and `deutsch-app-state-v1` holding one language's
  progress is only wrong once two packs are selectable.
- **The picker UI** — Phase 4.
- **Any second-language content** — 3b and 3c.
- **Making the importer language-agnostic** — 3b. This phase only changes
  where it writes, not what it parses.

---

## 7 · Files

| File | Change |
|---|---|
| `public/lexicon/*.json` | **moved** to `public/lexicon/de/` (11 files) |
| `src/packs/lexiconStore.js` | `BASE` per pack; `packId` threaded; caches keyed |
| `src/packs/lexiconStore.test.js` | signatures + the cross-contamination test |
| `src/packs/index.js` | `activePack` resolves via `getPack(DEFAULT_PACK_ID)` |
| `src/components/VocabTab.jsx` | passes `activePack.meta.id` |
| `scripts/import-lexicon/index.js` | default `outDir` gains the pack segment |
| `src/packs/lexiconSample.test.js` | `DIR` constant: `public/lexicon` → `public/lexicon/de` |
| `src/packs/de/autoDecks.population.test.js` | reads `public/lexicon/de/index.json` |

---

## 8 · Risks

| Risk | Mitigation |
|---|---|
| Cache serves one pack's chunks for another | The §5 cross-contamination test; keys include packId |
| `.map(loadChunk)` arity trap | Called out in §2; a test asserts the fetched URL |
| Returning users lose their cached lexicon | Accepted and quantified (§1): ~2.4 MB once, in the background |
| A re-import writes to the old flat path | The importer's `outDir` default changes in the same phase |
| Build stops emitting the lexicon | Manual `npm run build` check on `dist/lexicon/de/` (§5) |

---

## 9 · Success criteria

1. `public/lexicon/de/` holds the German lexicon; nothing reads `/lexicon/*.json`
   at the root.
2. `loadIndex` / `loadChunks` / `resolveAutoDeck` take a pack id, and
   `selectRows` still does not.
3. Two packs' chunks cannot cross, proven by a test that fails on today's code.
4. Every component test passes unmodified.
5. A second pack could be added without touching engine code — leaving 3b and
   3c as content work rather than plumbing work.
