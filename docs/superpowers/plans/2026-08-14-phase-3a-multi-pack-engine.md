# Phase 3a — Multi-Pack Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Namespace the chunked lexicon per pack and thread the pack id through `lexiconStore`, so two language packs can coexist without their chunks colliding or their caches crossing.

**Architecture:** German's artifacts move to `public/lexicon/de/`. `lexiconStore` takes a `packId` on the three exports that fetch, and keys both promise caches by pack. `selectRows` stays pure and unchanged. The registry gains a seam — `activePack` resolves through `getPack(DEFAULT_PACK_ID)` — but no switcher.

**Tech Stack:** React 18, Vite 5, Vitest + React Testing Library, workbox via `vite-plugin-pwa`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-14-phase-3a-multi-pack-engine-design.md`

## Global Constraints

- **The file move and the store change are one commit.** Either alone leaves the app fetching a path that does not exist. The suite would still be green — `lexiconStore.test.js` mocks `fetch` — so green is not a safety signal here. Task 1 is deliberately larger than usual for this reason.
- **No second pack, no picker, no storage namespacing.** `deutsch-app-state-v1` is untouched; `AGENTS.md` holds storage keys until platform Phase 4.
- **No component test may change.** `VocabTab` gains one argument at one call site and renders identically.
- **Do not change the service-worker config.** `vite.config.js`'s `urlPattern: /\/lexicon\/.*\.json$/` already matches nested paths, and the `StaleWhileRevalidate` comment records a production incident (PR #76). Leave both alone.
- **Tests use `globals: false`** — every test file must `import { describe, it, expect } from 'vitest'`.
- **Never bypass `.husky/pre-commit`** (`lint-staged` + full `npm test`). `--no-verify` is forbidden.
- **Branch from up-to-date `main`; land via a non-draft PR targeting `main`.** CI only runs on PRs targeting `main`.

## Four facts that will confuse you

1. **`.map(loadChunk)` is an arity trap.** `loadChunks` currently does `[...new Set(chunkIds)].map(loadChunk)`, which passes `(element, index, array)`. `loadChunk(chunk)` ignores the extras today. Give it a second parameter without rewriting that line and the array **index** becomes the pack id — fetching `/lexicon/0/chunk-…`. Step 3 rewrites it to an explicit arrow.
2. **The test fixture map matches by URL suffix.** `lexiconStore.test.js` builds `fixtures` keyed `'/lexicon/index.json'` and finds them with `url.endsWith(k)`. Once paths nest, `/lexicon/de/index.json` no longer ends with `/lexicon/index.json`, so every key must gain the `de` segment or every fetch 404s.
3. **Two tests read the shipped artifacts straight off disk**, bypassing `lexiconStore` entirely: `src/packs/lexiconSample.test.js:12` (`const DIR = 'public/lexicon'`) and `src/packs/de/autoDecks.population.test.js:13` (`readFileSync('public/lexicon/index.json')`). Threading does not touch them; they need the path edit or they fail on the move.
4. **`selectRows` needs nothing.** It is pure — it filters an index that has already been fetched. Only `loadIndex`, `loadChunks` and `resolveAutoDeck` take a `packId`.

---

## File Structure

| File | Responsibility |
|---|---|
| `public/lexicon/de/*.json` | **moved** — 11 artifacts under a pack segment |
| `src/packs/lexiconStore.js` | per-pack `BASE`, `packId` threaded, caches keyed by pack |
| `src/packs/lexiconStore.test.js` | nested fixture URLs + the cross-contamination test |
| `src/packs/lexiconSample.test.js` | `DIR` gains the `de` segment |
| `src/packs/de/autoDecks.population.test.js` | index path gains the `de` segment |
| `scripts/import-lexicon/index.js` | default `outDir` gains the pack segment |
| `src/components/VocabTab.jsx` | passes `activePack.meta.id` |
| `src/packs/index.js` | `activePack` resolves via `getPack(DEFAULT_PACK_ID)` |

---

## Task 1: Pack-namespaced lexicon

**Files:**
- Modify: `src/packs/lexiconStore.test.js` (fixtures, signatures, new tests)
- Modify: `src/packs/lexiconStore.js` (whole file)
- Move: `public/lexicon/*.json` → `public/lexicon/de/`
- Modify: `src/packs/lexiconSample.test.js:12`
- Modify: `src/packs/de/autoDecks.population.test.js:13`
- Modify: `scripts/import-lexicon/index.js:59`
- Modify: `src/components/VocabTab.jsx:92`

**Interfaces:**
- Consumes: `resolveCard(entry, grammar)` from `src/packs/resolve.js` (unchanged).
- Produces:
  - `loadIndex(packId: string): Promise<object[]>`
  - `loadChunks(packId: string, chunkIds: number[]): Promise<Record<string, object>>`
  - `selectRows(index: object[], auto: object): object[]` — **unchanged**
  - `resolveAutoDeck(deckDef: object, grammar: object, packId: string): Promise<object[]>`
  - `__resetCache(): void` — unchanged signature

- [ ] **Step 1: Rewrite the store's test**

Replace the fixture block and `beforeEach` at the top of
`src/packs/lexiconStore.test.js` (lines 1-21) with:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndex, loadChunks, resolveAutoDeck, __resetCache } from './lexiconStore';
import { grammar } from './de/grammar';
import index from './__fixtures__/lexicon/index.json';
import chunk0 from './__fixtures__/lexicon/chunk-00.json';
import chunk1 from './__fixtures__/lexicon/chunk-01.json';

// A deliberately different second pack. Its data must never be served for 'de'
// and vice versa — that is the whole point of Phase 3a.
const xxIndex = [{ id: 'xx-solo', rank: 1, chunk: 0, cefr: 'A1', tags: ['test'] }];
const xxChunk0 = {
  'xx-solo': {
    id: 'xx-solo',
    de: 'solo',
    en: ['only'],
    pos: 'phrase',
    article: null,
    ipa: '[ˈsolo]',
    plural: null,
    cefr: 'A1',
    freqRank: 1,
    tags: ['test'],
    examples: [],
    verb: null,
    source: { dict: 'authored', license: 'MIT' },
  },
};

const fixtures = {
  '/lexicon/de/index.json': index,
  '/lexicon/de/chunk-00.json': chunk0,
  '/lexicon/de/chunk-01.json': chunk1,
  '/lexicon/xx/index.json': xxIndex,
  '/lexicon/xx/chunk-00.json': xxChunk0,
};

beforeEach(() => {
  __resetCache();
  globalThis.fetch = vi.fn((url) => {
    const key = Object.keys(fixtures).find((k) => url.endsWith(k));
    if (!key) return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) });
  });
});
```

Then update every existing call in the file to pass a pack id:

- `loadIndex()` → `loadIndex('de')`
- `loadChunks([…])` → `loadChunks('de', […])`
- `resolveAutoDeck({…}, grammar)` → `resolveAutoDeck({…}, grammar, 'de')`
- URL assertions like `.endsWith('/lexicon/index.json')` → `.endsWith('/lexicon/de/index.json')`

Finally append the tests this phase exists for:

```js
describe('pack isolation', () => {
  it('fetches each pack from its own directory', async () => {
    await loadIndex('de');
    await loadIndex('xx');
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/lexicon/de/index.json'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/lexicon/xx/index.json'))).toBe(true);
  });

  // Fails on the pre-3a store: the index promise was a single module-level
  // value, so the second pack got the first pack's data with no error.
  it('does not serve one pack index for another', async () => {
    const de = await loadIndex('de');
    const xx = await loadIndex('xx');
    expect(xx).toEqual(xxIndex);
    expect(xx).not.toEqual(de);
  });

  // Fails on the pre-3a store: chunkPromises keyed on the chunk NUMBER, so
  // chunk 0 loaded for 'de' was returned verbatim for 'xx'. Shapes match, so
  // nothing throws — the app would render German words in a second pack.
  it('does not serve one pack chunk for another', async () => {
    await loadChunks('de', [0]);
    const xx = await loadChunks('xx', [0]);
    expect(xx).toHaveProperty('xx-solo');
    expect(Object.keys(xx)).toEqual(['xx-solo']);
  });

  it('requests the chunk number, not the array index', async () => {
    await loadChunks('de', [1]);
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/lexicon/de/chunk-01.json'))).toBe(true);
    expect(urls.some((u) => u.includes('/lexicon/0/'))).toBe(false);
  });

  it('a failed fetch clears only that pack, leaving the other memoized', async () => {
    await loadIndex('de');
    await expect(loadIndex('nope')).rejects.toThrow();
    const before = globalThis.fetch.mock.calls.length;
    await loadIndex('de'); // still memoized — no new request
    expect(globalThis.fetch.mock.calls).toHaveLength(before);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL. `loadIndex('de')` still fetches `/lexicon/index.json`, which is
no longer a fixture key, so the mock 404s and the store throws
`lexicon index 404`.

- [ ] **Step 3: Rewrite `lexiconStore.js`**

Replace lines 1-50 of `src/packs/lexiconStore.js` — everything from the import
down to and including `loadChunks`:

```js
import { resolveCard } from './resolve';

// Artifacts live under a per-pack directory so two packs can ship a lexicon
// without colliding: /lexicon/de/index.json, /lexicon/es/index.json, …
const base = (packId) => `/lexicon/${packId}`;

// Both caches are keyed by pack. Keying chunks on the chunk NUMBER alone —
// as this module did before Phase 3a — returns one pack's chunk for another's
// request. The shapes match, so nothing throws; the app just renders the wrong
// language.
const indexPromises = new Map(); // packId → Promise
const chunkPromises = new Map(); // `${packId}:${chunk}` → Promise

export function __resetCache() {
  indexPromises.clear();
  chunkPromises.clear();
}

export function loadIndex(packId) {
  if (!indexPromises.has(packId)) {
    const p = fetch(`${base(packId)}/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon index ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        indexPromises.delete(packId); // allow retry on next call
        throw err;
      });
    indexPromises.set(packId, p);
  }
  return indexPromises.get(packId);
}

function chunkName(chunk) {
  return `chunk-${String(chunk).padStart(2, '0')}.json`;
}

function loadChunk(packId, chunk) {
  const key = `${packId}:${chunk}`;
  if (!chunkPromises.has(key)) {
    const p = fetch(`${base(packId)}/${chunkName(chunk)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon ${chunkName(chunk)} ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        chunkPromises.delete(key); // allow retry on next call
        throw err;
      });
    chunkPromises.set(key, p);
  }
  return chunkPromises.get(key);
}

export async function loadChunks(packId, chunkIds) {
  // An explicit arrow, NOT .map(loadChunk): map passes (element, index, array),
  // so the bare reference would hand the array index to `chunk`.
  const datas = await Promise.all([...new Set(chunkIds)].map((c) => loadChunk(packId, c)));
  return Object.assign({}, ...datas);
}
```

Then change `resolveAutoDeck`'s signature and its two internal calls. Leave the
long comment about stale chunks and the `missing` handling exactly as they are:

```js
export async function resolveAutoDeck(deckDef, grammar, packId) {
  const rows = selectRows(await loadIndex(packId), deckDef.auto);
  const entries = await loadChunks(packId, rows.map((r) => r.chunk));
```

`selectRows` and `matches` are untouched.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: PASS.

- [ ] **Step 5: Move the artifacts**

```bash
mkdir -p public/lexicon/de
git mv public/lexicon/index.json public/lexicon/manifest.json public/lexicon/de/
for f in public/lexicon/chunk-*.json; do git mv "$f" public/lexicon/de/; done
ls public/lexicon
```

Expected: `de` — and nothing else. Eleven files now sit in `public/lexicon/de/`.

- [ ] **Step 6: Fix the two tests that read from disk**

`src/packs/lexiconSample.test.js:12`:

```js
const DIR = 'public/lexicon/de';
```

`src/packs/de/autoDecks.population.test.js:13`:

```js
const index = JSON.parse(readFileSync('public/lexicon/de/index.json', 'utf8'));
```

Neither goes through `lexiconStore`, so neither was touched by Step 3. They are
the tests that prove the move did not lose or corrupt the artifacts.

- [ ] **Step 7: Point the importer at the pack directory**

`scripts/import-lexicon/index.js:59`:

```js
  outDir = outDir || join(ROOT, 'public', 'lexicon', 'de');
```

Without this a re-import writes to the old flat path and the app silently keeps
serving the pre-import lexicon.

- [ ] **Step 8: Pass the pack id from the component**

`src/components/VocabTab.jsx:92`:

```js
    resolveAutoDeck(def, activePack.grammar, activePack.meta.id)
```

`VocabTab` already imports `activePack` — add no import.

- [ ] **Step 9: Run everything**

Run: `npm test && npm run lint`
Expected: all green.

Confirm no component test changed:

```bash
git diff --stat -- 'src/components/**/*.test.jsx' 'src/components/*.test.jsx'
```

Expected: empty.

- [ ] **Step 10: Verify the build still emits the lexicon**

A test cannot check this — the artifacts are copied by Vite's static handling,
and the service worker is generated at build time.

```bash
npm run build
ls dist/lexicon/de | wc -l
grep -c "lexicon" dist/sw.js
```

Expected: `11`, and a non-zero grep count — the runtime-caching rule for
`/lexicon/.*\.json` is still in the generated service worker.

- [ ] **Step 11: Commit**

```bash
npx prettier --write src/packs/lexiconStore.js src/packs/lexiconStore.test.js src/packs/lexiconSample.test.js src/packs/de/autoDecks.population.test.js src/components/VocabTab.jsx
npm run lint
git add -A public/lexicon src/packs src/components scripts/import-lexicon
git status --short   # confirm nothing is left unstaged before committing
git commit -m "feat(pack): the lexicon is namespaced per pack

German's artifacts move to public/lexicon/de/ and lexiconStore takes a packId
on the three exports that fetch. selectRows is untouched — it is pure and
operates on an index that has already been loaded.

Both promise caches are now keyed by pack. That is the part that mattered:
chunkPromises keyed on the chunk NUMBER, so chunk-03 loaded for one pack was
returned verbatim for another's request. The shapes match, so nothing threw —
the app would simply have rendered the wrong language. A test asserts it, and
it fails on the previous store.

loadChunks now maps with an explicit arrow. The bare .map(loadChunk) reference
passed (element, index, array), so adding a parameter would have handed the
array index to the pack id and fetched /lexicon/0/.

The service worker config is unchanged: its urlPattern is /\\/lexicon\\/.*\\.json$/
and .* spans slashes, so nested paths already match. Returning users refetch
~2.4MB once because the URLs changed — a background revalidation under
StaleWhileRevalidate, not a stall.

Two tests read the artifacts straight off disk and bypass the store entirely;
both gain the de segment. They are what prove the move lost nothing."
```

---

## Task 2: The registry seam

**Files:**
- Modify: `src/packs/index.js`

**Interfaces:**
- Consumes: `getPack(id)` from the same module.
- Produces: `activePack` — same value as before, now resolved by id.

- [ ] **Step 1: Write the characterization test**

Not a failing test — this one passes before and after, deliberately. It pins a
*relationship* rather than driving new behaviour, so that Phase 4 cannot
quietly reintroduce a direct binding while adding selection.

Append to `src/packs/packs.test.js`, inside the existing
`describe('activePack', …)` block:

```js
  it('resolves the active pack through the registry, not a direct import', () => {
    expect(activePack).toBe(getPack('de'));
  });
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/packs/packs.test.js`
Expected: PASS — `activePack` and `getPack('de')` are already the same object,
because `PACKS.de` *is* `dePack`.

- [ ] **Step 3: Add the seam**

In `src/packs/index.js`, replace the final export:

```js
export const activePack = dePack;
```

with:

```js
// Phase 4 replaces this constant with a stored preference; the indirection
// exists now so that change lands in one place. `PACKS` is declared above, so
// getPack() resolves cleanly at module-eval time.
const DEFAULT_PACK_ID = 'de';

/** The active language pack. */
export const activePack = getPack(DEFAULT_PACK_ID);
```

Also update the file's header comment, which currently says the singleton will
be wrapped "in Phase 4 when the language picker arrives" — that is still true,
so leave it.

- [ ] **Step 4: Run the suite**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/packs/index.js src/packs/packs.test.js
git add src/packs/index.js src/packs/packs.test.js
git commit -m "refactor(pack): the active pack resolves through the registry

activePack = getPack(DEFAULT_PACK_ID) rather than naming dePack directly. A
seam, not a switcher — nothing selects anything yet, but Phase 4's stored
preference now has one place to land.

The test asserts activePack === getPack('de'), which passes before and after.
It pins the relationship so a future change cannot quietly reintroduce a direct
binding while adding selection."
```

---

## Task 3: Land it

**Files:** none — verification and PR only.

- [ ] **Step 1: Verify green from a clean state**

```bash
npm test && npm run lint && npm run format:check
```

- [ ] **Step 2: Confirm nothing reads the old flat path**

```bash
grep -rn "public/lexicon'" src/ scripts/ --include="*.js" --include="*.jsx"
grep -rn "'/lexicon/index.json'\|'/lexicon/chunk" src/ --include="*.js" --include="*.jsx"
```

Expected: no matches for either. Every reference now carries a pack segment.

- [ ] **Step 3: Confirm no component test changed**

```bash
git diff main --stat -- 'src/components/**/*.test.jsx' 'src/components/*.test.jsx'
```

Expected: empty.

- [ ] **Step 4: Prove the cross-contamination test is not vacuous**

This is the assertion the phase exists for, so demonstrate it can fail. Do NOT
stash — that would remove the test along with the fix.

Temporarily break **only** the chunk cache key in `src/packs/lexiconStore.js`,
reverting it to the pre-3a behaviour:

```js
  const key = `${chunk}`;   // was: `${packId}:${chunk}`
```

Then:

```bash
npx vitest run src/packs/lexiconStore.test.js 2>&1 | grep -A 3 "does not serve one pack chunk"
```

Expected: FAIL — `xx` receives German's chunk-00, so
`expect(Object.keys(xx)).toEqual(['xx-solo'])` reports German ids instead.

Restore the line:

```js
  const key = `${packId}:${chunk}`;
```

and re-run to confirm green:

```bash
npx vitest run src/packs/lexiconStore.test.js && git diff --stat -- src/packs/lexiconStore.js
```

Expected: PASS, and an empty diff — the file is back exactly as committed.
Record the observed failure message in the PR body.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin feat/phase-3a-multi-pack-engine
gh pr create --base main --title "feat(pack): Phase 3a — multi-pack engine"
```

Open it **non-draft**, targeting `main`.

In the PR body state: that Phase 3 was decomposed and why (the German pack is
1,827 lines plus 2.4 MB of lexicon, an arc not a task); that the cache-key bug
was the real blocker and would have failed silently; that the service worker
needed no change and why; that returning users refetch ~2.4 MB once; the arity
trap in `.map(loadChunk)`; and that 3b/3c remain content work with no plumbing
left to do.

---

## Notes for the implementer

**Check what the commit actually captured.** After committing Task 1, run
`git show --name-status HEAD` and confirm it lists the 11 renames *and* the
modified sources. In Phase 1.5 a `git add` aborted on a stale pathspec, so a
commit captured only deletions — and `.husky/pre-commit` passed regardless,
because the working tree was fine. A green pre-commit proves the tree, not the
commit.

**Why Task 1 is one commit.** Moving the files without changing the store, or
changing the store without moving the files, leaves the app fetching a path
that does not exist. The test suite stays green either way because
`lexiconStore.test.js` mocks `fetch` — so a green suite is not evidence the
intermediate state works. They land together or not at all.

**Why `selectRows` keeps its signature.** It is pure: it filters an index the
caller already fetched. Giving it a `packId` would imply it knows about
fetching, which it does not, and would churn
`autoDecks.population.test.js` for nothing.

**What the manual build check is for.** `dist/lexicon/de/` and the generated
`sw.js` are produced by Vite and workbox at build time, and no unit test sees
them. If the artifacts stopped being copied, every test would still pass and the
deployed app would 404 on every deck.

**What is deliberately not here.** Storage namespacing (`AGENTS.md` holds
storage keys until Phase 4), the picker, and any second-language content. After
this phase 3b and 3c are content work — sourcing a lexicon and authoring pack
modules — with no engine plumbing left in the way.
