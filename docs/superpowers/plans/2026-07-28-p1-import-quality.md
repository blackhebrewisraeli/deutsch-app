# P1 Import Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop discarding German-only example sentences, and band CEFR by position in the kept lexicon instead of raw Leipzig rank — then regenerate the lexicon once with both changes.

**Architecture:** Three small code changes (validator relaxation, filter relaxation, `pickExamples` relaxation) plus a pipeline reordering: CEFR moves out of `assignRanks` into a new `assignCefrBands` that runs after `applyFilter`, when the kept set is finally known. A single import re-run produces the new artifacts; two existing guards verify them.

**Tech Stack:** Node ESM (`scripts/`), vanilla ES modules (`src/`), Vitest.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — `lint-staged` + full `npm test`; no `--no-verify`; wait for it (allow 10 min).
- **`scripts/` relative imports use explicit `.js` extensions; `src/` imports use none.**
- **CEFR split is exactly 20 / 30 / 50** (A1 / A2 / B1) via `assignCefrBands(entries, { a1 = 0.2, a2 = 0.5 } = {})`.
- **`examples[].en` becomes `null | non-empty string`.** `de` and `source` stay required and non-empty. An empty-string `en` is INVALID (same treatment as `ipa`/`plural`).
- **Tatoeba examples still come first** in `pickExamples`; only the Wiktextract fallback is reordered (translated before German-only).
- **Do not change** the top-N import size (5,000), the 120-char example length cap, or the blocklist.
- **Artifacts are regenerated only in Task 4**, after all code changes are committed and green.
- Match existing 2-space indent / quote style.

## File Structure
- Modify `src/packs/validate.js` — `examples[].en` nullable.
- Modify `src/packs/validate.test.js` — nullable-`en` cases.
- Modify `scripts/import-lexicon/filter.js` — `cleanExamples` drops the `!e.en` rejection.
- Modify `scripts/import-lexicon/filter.test.js` — German-only kept; over-long/blocklisted still dropped.
- Modify `scripts/import-lexicon/joinTatoeba.js` — `pickExamples` accepts German-only, prefers translated within the fallback.
- Modify `scripts/import-lexicon/joinTatoeba.test.js` — those cases.
- Modify `scripts/import-lexicon/rankLeipzig.js` — drop `cefr` from `assignRanks`; add `assignCefrBands`.
- Modify `scripts/import-lexicon/rankLeipzig.test.js` — updated + new cases.
- Modify `scripts/import-lexicon/ids.js` — remove dead `cefrForRank`.
- Modify `scripts/import-lexicon/ids.test.js` — remove its tests.
- Modify `scripts/import-lexicon/index.js` — call `assignCefrBands(kept)` after `applyFilter`.
- Regenerate `public/lexicon/*` (Task 4 only).

---

## Task 1: Allow German-only examples

**Files:**
- Modify: `src/packs/validate.js` (the `examples` loop, ~line 91-97)
- Modify: `src/packs/validate.test.js`
- Modify: `scripts/import-lexicon/filter.js` (`cleanExamples`)
- Modify: `scripts/import-lexicon/filter.test.js`
- Modify: `scripts/import-lexicon/joinTatoeba.js` (`pickExamples`)
- Modify: `scripts/import-lexicon/joinTatoeba.test.js`

**Interfaces:**
- Produces: an example object is now `{ de: non-empty string, en: null | non-empty string, source: non-empty string }`. `cleanExamples` and `pickExamples` both accept `en: null`. `pickExamples(tatoebaExamples, rawExamples, max = 2)` keeps its signature; within the Wiktextract fallback, entries with a non-empty `en` are ordered before German-only ones.

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/validate.test.js` (inside the existing `describe('validateLexiconEntry', …)` block, alongside the other example cases):

```js
  it('accepts an example with a null English translation', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: 'Ich esse Brot.', en: null, source: 'wiktionary' }],
      })
    ).toBe(true);
  });
  it('throws when an example has an empty-string en', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: 'Ich esse Brot.', en: '', source: 'wiktionary' }],
      })
    ).toThrow(/example/);
  });
  it('throws when an example has no de', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: '', en: 'I eat bread.', source: 'wiktionary' }],
      })
    ).toThrow(/example/);
  });
```

Append to `scripts/import-lexicon/filter.test.js` (inside the existing `describe('cleanExamples', …)` block):

```js
  it('keeps a German-only example (no translation)', () => {
    expect(cleanExamples([{ de: 'Ich esse Brot.', en: null, source: 'wiktionary' }], {})).toEqual([
      { de: 'Ich esse Brot.', en: null, source: 'wiktionary' },
    ]);
  });
  it('still drops an example with no German text', () => {
    expect(cleanExamples([{ de: '', en: 'I eat bread.', source: 'wiktionary' }], {})).toEqual([]);
  });
```

Append to `scripts/import-lexicon/joinTatoeba.test.js` (inside the existing `describe('pickExamples', …)` block):

```js
  it('accepts a German-only rawExample when there is no Tatoeba match', () => {
    expect(pickExamples([], [{ de: 'Ich esse Brot.', en: null }], 2)).toEqual([
      { de: 'Ich esse Brot.', en: null, source: 'wiktionary' },
    ]);
  });
  it('prefers a translated Wiktextract example over a German-only one', () => {
    const out = pickExamples([], [{ de: 'Nur Deutsch.', en: null }, { de: 'Mit Englisch.', en: 'With English.' }], 2);
    expect(out.map((e) => e.de)).toEqual(['Mit Englisch.', 'Nur Deutsch.']);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/packs/validate.test.js scripts/import-lexicon/filter.test.js scripts/import-lexicon/joinTatoeba.test.js`
Expected: FAIL — the null-`en` cases throw / are filtered out; the preference case returns the German-only example first.

- [ ] **Step 3: Relax the validator**

In `src/packs/validate.js`, replace the examples loop body:

```js
  if (!Array.isArray(entry.examples)) fail('examples must be an array');
  for (const ex of entry.examples) {
    if (!ex || typeof ex !== 'object') fail('each example must be an object');
    if (!nonEmptyStr(ex.de) || !nonEmptyStr(ex.source)) {
      fail('each example must have non-empty de and source');
    }
    // en is optional: Wiktionary examples often carry no translation, and the
    // card renders only the German sentence.
    if (ex.en !== null && !nonEmptyStr(ex.en)) {
      fail('each example must have en null or a non-empty string');
    }
  }
```

- [ ] **Step 4: Relax the filter**

In `scripts/import-lexicon/filter.js`, in `cleanExamples`, change the first guard from requiring both `de` and `en` to requiring only `de`:

```js
    if (!e || !e.de) return false;
```

(The `maxLen` check and the blocklist check that follow are unchanged — both already operate on `e.de`.)

- [ ] **Step 5: Relax and reorder `pickExamples`**

In `scripts/import-lexicon/joinTatoeba.js`, replace `pickExamples`:

```js
export function pickExamples(tatoebaExamples, rawExamples, max = 2) {
  const usable = (rawExamples || []).filter((e) => e && e.de);
  // Translated Wiktextract examples first, then German-only ones — better data
  // wins the slot when both are available. (Tatoeba pairs always have both, so
  // they stay ahead of everything.)
  const wiktionary = [
    ...usable.filter((e) => e.en),
    ...usable.filter((e) => !e.en),
  ].map((e) => ({ de: e.de, en: e.en ?? null, source: 'wiktionary' }));
  return [...tatoebaExamples, ...wiktionary].slice(0, max);
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/packs/validate.test.js scripts/import-lexicon/filter.test.js scripts/import-lexicon/joinTatoeba.test.js`
Expected: PASS (including all pre-existing cases in those files).

- [ ] **Step 7: Commit**

```bash
git add src/packs/validate.js src/packs/validate.test.js scripts/import-lexicon/filter.js scripts/import-lexicon/filter.test.js scripts/import-lexicon/joinTatoeba.js scripts/import-lexicon/joinTatoeba.test.js
git commit -m "feat(import): allow German-only example sentences"
```

---

## Task 2: Band CEFR by position in the kept lexicon

**Files:**
- Modify: `scripts/import-lexicon/rankLeipzig.js`
- Modify: `scripts/import-lexicon/rankLeipzig.test.js`
- Modify: `scripts/import-lexicon/ids.js` (remove `cefrForRank`)
- Modify: `scripts/import-lexicon/ids.test.js` (remove its tests)

**Interfaces:**
- Produces:
  - `assignRanks(parsedList, rankMap)` — now sets **only** `freqRank` (no `cefr` key at all).
  - `assignCefrBands(entries, { a1 = 0.2, a2 = 0.5 } = {})` — returns a NEW array of the same entries with `cefr` set: sorted by `freqRank` ascending (nulls last), the first `Math.round(n * a1)` get `'A1'`, entries up to `Math.round(n * a2)` get `'A2'`, the rest `'B1'`. Returns `[]` for an empty input. Does not mutate the caller's array.
- Consumed by: Task 3 (`index.js` calls `assignCefrBands`).

- [ ] **Step 1: Update and add the failing tests**

In `scripts/import-lexicon/rankLeipzig.test.js`, REPLACE the `assignRanks` expectation so it no longer expects `cefr`, and update the import line to include `assignCefrBands`:

```js
import { assignRanks, topByRank, assignCefrBands } from './rankLeipzig.js';
```

```js
describe('assignRanks', () => {
  it('assigns freqRank from the map, null when absent, and no cefr', () => {
    const out = assignRanks(
      [{ lemma: 'Brot' }, { lemma: 'gehen' }, { lemma: 'Quark' }],
      rankMap
    );
    expect(out).toEqual([
      { lemma: 'Brot', freqRank: 142 },
      { lemma: 'gehen', freqRank: 12 },
      { lemma: 'Quark', freqRank: null },
    ]);
  });
});
```

Then append a new describe block:

```js
describe('assignCefrBands', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, freqRank: i + 1 }));

  it('splits 20/30/50 by position, most frequent first', () => {
    const out = assignCefrBands(mk(10));
    expect(out.map((e) => e.cefr)).toEqual([
      'A1', 'A1', 'A2', 'A2', 'A2', 'B1', 'B1', 'B1', 'B1', 'B1',
    ]);
  });

  it('orders by rank with nulls last', () => {
    const out = assignCefrBands([
      { id: 'c', freqRank: null },
      { id: 'a', freqRank: 5 },
      { id: 'b', freqRank: 1 },
    ]);
    expect(out.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('honours custom proportions', () => {
    const out = assignCefrBands(mk(10), { a1: 0.5, a2: 0.8 });
    expect(out.filter((e) => e.cefr === 'A1')).toHaveLength(5);
    expect(out.filter((e) => e.cefr === 'A2')).toHaveLength(3);
    expect(out.filter((e) => e.cefr === 'B1')).toHaveLength(2);
  });

  it('returns [] for an empty list and does not mutate the input order', () => {
    expect(assignCefrBands([])).toEqual([]);
    const input = [{ id: 'x', freqRank: 9 }, { id: 'y', freqRank: 1 }];
    assignCefrBands(input);
    expect(input.map((e) => e.id)).toEqual(['x', 'y']);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/import-lexicon/rankLeipzig.test.js`
Expected: FAIL — `assignCefrBands` is not exported, and `assignRanks` still returns `cefr`.

- [ ] **Step 3: Implement**

Replace the whole of `scripts/import-lexicon/rankLeipzig.js` with:

```js
export function assignRanks(parsedList, rankMap) {
  return parsedList.map((p) => {
    const freqRank = rankMap.get(p.lemma.toLowerCase()) ?? null;
    return { ...p, freqRank };
  });
}

export function topByRank(list, n) {
  return list
    .filter((e) => e.freqRank != null)
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, n);
}

// CEFR bands are assigned by POSITION within the kept lexicon, not by raw
// Leipzig rank. The import keeps the top N parsed entries, which reach far down
// the frequency list (rank ~12k for N=5000), so a raw-rank threshold dumps
// almost everything into B1. Position-based bands stay stable across re-imports.
// Must therefore run AFTER filtering, when the kept set is known.
export function assignCefrBands(entries, { a1 = 0.2, a2 = 0.5 } = {}) {
  const sorted = [...entries].sort(
    (x, y) => (x.freqRank ?? Infinity) - (y.freqRank ?? Infinity)
  );
  const n = sorted.length;
  const a1End = Math.round(n * a1);
  const a2End = Math.round(n * a2);
  return sorted.map((e, i) => ({
    ...e,
    cefr: i < a1End ? 'A1' : i < a2End ? 'A2' : 'B1',
  }));
}
```

- [ ] **Step 4: Remove the now-dead `cefrForRank`**

In `scripts/import-lexicon/ids.js`, DELETE the entire `export function cefrForRank(rank) { … }` function (it is no longer imported anywhere).

In `scripts/import-lexicon/ids.test.js`, remove `cefrForRank` from the import on line 2 and DELETE the entire `describe('cefrForRank', …)` block.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run scripts/import-lexicon/rankLeipzig.test.js scripts/import-lexicon/ids.test.js`
Expected: PASS.

Then confirm nothing still references the removed function:
Run: `grep -rn "cefrForRank" scripts/ src/`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-lexicon/rankLeipzig.js scripts/import-lexicon/rankLeipzig.test.js scripts/import-lexicon/ids.js scripts/import-lexicon/ids.test.js
git commit -m "feat(import): band CEFR by position in the kept lexicon"
```

---

## Task 3: Wire `assignCefrBands` into the pipeline

**Files:**
- Modify: `scripts/import-lexicon/index.js` (the `run()` function)

**Interfaces:**
- Consumes: `assignCefrBands` from `./rankLeipzig.js` (Task 2).
- Produces: `run()` assigns CEFR to the kept entries before building artifacts.

- [ ] **Step 1: Update the import**

In `scripts/import-lexicon/index.js`, extend the existing `rankLeipzig` import:

```js
import { assignRanks, topByRank, assignCefrBands } from './rankLeipzig.js';
```

- [ ] **Step 2: Call it after filtering**

In `run()`, find:

```js
  const { kept, rejected } = applyFilter(mapped);

  const artifacts = buildArtifacts(kept, { chunkSize: 500, sources: SOURCES });
```

and insert the banding step between them, using the banded entries for the artifacts:

```js
  const { kept, rejected } = applyFilter(mapped);
  // CEFR is banded by position within the KEPT set, so it must run here — after
  // filtering, when the final lexicon is known (see assignCefrBands).
  const banded = assignCefrBands(kept);

  const artifacts = buildArtifacts(banded, { chunkSize: 500, sources: SOURCES });
```

Leave the `buildReport({ …, kept, rejected })` call unchanged — it reports counts, and `banded` has the same length as `kept`.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS (all files). No test drives `run()` directly — it is network/filesystem glue — so this step confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-lexicon/index.js
git commit -m "feat(import): assign CEFR bands after filtering"
```

---

## Task 4: Regenerate the lexicon and verify

**Files:**
- Modify: `public/lexicon/*` (regenerated output — the ONLY task that touches these)

**Interfaces:**
- Consumes: all three preceding tasks.
- Produces: new committed artifacts reflecting German-only examples and 20/30/50 CEFR bands.

- [ ] **Step 1: Run the import**

The raw download cache in `.cache/lexicon-raw/` is warm, so this re-uses it (no ~1.2 GB re-download). Takes a few minutes — the Wiktextract file is ~1 GB.

Run: `npm run import:lexicon`

Capture the printed JSON report. **Success criteria — all three must hold:**
- `kept` is **greater than 4418**
- `byReason["no example"]` is **less than 537**
- the run completes without throwing

- [ ] **Step 2: Check the resulting shape**

Run:

```bash
node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
import { validateLexiconEntry } from "./src/packs/validate.js";
const dir = "public/lexicon";
const idx = JSON.parse(readFileSync(dir + "/index.json", "utf8"));
const chunks = readdirSync(dir).filter((f) => /^chunk-\d+\.json$/.test(f)).sort();
let entries = [];
for (const c of chunks) entries.push(...Object.values(JSON.parse(readFileSync(dir + "/" + c, "utf8"))));
let bad = 0, cefr = {}, deOnly = 0, withEx = 0;
for (const e of entries) {
  try { validateLexiconEntry(e); } catch { bad++; }
  cefr[e.cefr] = (cefr[e.cefr] || 0) + 1;
  if (e.examples?.length) { withEx++; if (e.examples.some((x) => x.en === null)) deOnly++; }
}
const pct = (k) => Math.round((100 * cefr[k]) / entries.length);
console.log("entries:", entries.length, "index:", idx.length, "invalid:", bad);
console.log("cefr:", JSON.stringify(cefr), `→ ${pct("A1")}/${pct("A2")}/${pct("B1")}`);
console.log("with >=1 example:", withEx, " having a German-only example:", deOnly);
'
```

**Expected:** `invalid: 0`; `index.length === entries.length`; CEFR approximately **20/30/50**; `withEx` equal to the entry count.

- [ ] **Step 3: Run the guards**

Run: `npx vitest run src/packs/lexiconSample.test.js src/packs/de/autoDecks.population.test.js`
Expected: PASS — every index row resolves and validates, and all 13 shipped decks (including the three CEFR decks, whose membership just changed wholesale) still resolve to ≥40 cards.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 5: Confirm reproducibility**

Run the import a second time and confirm only the timestamp differs:

```bash
npm run import:lexicon > /dev/null 2>&1
git diff --stat public/lexicon
```
Expected: only `public/lexicon/manifest.json` listed (the `generatedAt` field).

- [ ] **Step 6: Commit**

```bash
git add public/lexicon
git commit -m "data(lexicon): regenerate with German-only examples + position-based CEFR"
```

**If any success criterion in Step 1 or Step 2 fails, STOP.** Do not commit the artifacts; report the actual numbers instead. A drop in entry count or a lopsided CEFR split means a code change behaved differently than designed, and shipping the data would bake that in.

---

## Self-Review

**Spec coverage:**
- §1 German-only examples (validator, filter, `pickExamples` incl. translated-first ordering, no UI change) → Task 1.
- §2 CEFR re-banding (20/30/50, `assignCefrBands`, `assignRanks` no longer sets cefr, `cefrForRank` removed, runs after `applyFilter`) → Tasks 2 and 3.
- §3 regeneration + both guards + success criteria → Task 4.
- §4 testing (validator, `cleanExamples`, `pickExamples`, `assignCefrBands`, `assignRanks`) → Tasks 1, 2.
- §5 out of scope respected: no stemming, no AI translation, no card English, top-N and length cap untouched.
- §6 risks: chunk-count shift and CEFR deck membership are both covered by Task 4 Step 3's guards.

**Placeholder scan:** none — every step carries complete code or an exact command with expected output, including the stop conditions.

**Type consistency:** `assignCefrBands(entries, { a1, a2 })` is defined in Task 2 and called with a single argument in Task 3 (defaults 0.2/0.5 supply the 20/30/50 split). Example objects are `{ de, en: null | string, source }` consistently across the validator (Task 1 Step 3), `cleanExamples` (Step 4), and `pickExamples` (Step 5). `assignRanks` dropping `cefr` in Task 2 is matched by `mapEntry`'s pre-existing `cefr: word.cefr ?? null`, so entries carry `cefr: null` until Task 3's banding step overwrites it.

## Notes / risks for the implementer
- Task 4 is the only task that may touch `public/lexicon/`; Tasks 1–3 must leave it untouched.
- `mapEntry` needs no change: it already does `cefr: word.cefr ?? null`, so entries validate as `cefr: null` between Task 2 and Task 3's banding.
- The import needs `--max-old-space-size=4096`, which is already baked into the `import:lexicon` npm script.
- `npm test` runs the whole suite (~15 s) on every commit via the pre-commit hook.
