# Auto-Decks Grounded in Real Data (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shipped auto-deck resolve to real cards — add a `top` rule so "Core 100"/"Top 500" mean the first N by frequency, rebuild Topic decks from the actual tag vocabulary, and add a data-driven guard so an empty deck can never reach production again.

**Architecture:** Two resolvers implement the deck rules (`resolve.js` over an in-memory lexicon; `lexiconStore.js` over the fetched index). Both gain a `top` rule (sort by rank, slice N) and an array-capable `tag` rule (any-of). `autoDecks.js` is re-authored from measured tag counts. A new test resolves every shipped deck against the real `public/lexicon/index.json` and asserts ≥40 cards.

**Tech Stack:** Vanilla ES modules, Vitest. `src/` code — no new dependencies.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — `lint-staged` + full `npm test`; no `--no-verify`; wait for it.
- **`src/` relative imports use NO file extension**; JSON imports keep `.json`.
- **Code-only change.** Do NOT regenerate or edit anything under `public/lexicon/` — the shipped artifacts are canonical and byte-reproducible.
- **The existing `by:'freq'` range rule must be retained** (still tested); it is simply unused by shipped decks.
- **Existing `by:'tag'` string form must keep working** — the array form is additive.
- **Guard threshold is exactly 40** cards minimum per shipped auto-deck.
- Match existing 2-space indent / quote style.

## File Structure
- Modify `src/packs/resolve.js` — add `top` rule; make `tag` accept string or array.
- Modify `src/packs/resolve.test.js` — unit tests for both.
- Modify `src/packs/lexiconStore.js` — same two rules in `matches`/`resolveAutoDeck`.
- Modify `src/packs/lexiconStore.test.js` — fixture tests for both.
- Modify `src/packs/de/autoDecks.js` — re-author Frequency + Topic decks.
- Create `src/packs/de/autoDecks.population.test.js` — the ≥40-card guard against real data.

---

## Task 1: Resolver rules — `top` and array-form `tag`

**Files:**
- Modify: `src/packs/resolve.js` (the `if (deckDef.auto)` branch)
- Modify: `src/packs/resolve.test.js`

**Interfaces:**
- Consumes: existing `resolveCard`.
- Produces: `resolveDeck` additionally supports
  - `auto: { by: 'top', count: N }` → all entries sorted by `freqRank` ascending (nulls last), sliced to the first `N`, mapped through `resolveCard`.
  - `auto: { by: 'tag', tag: string | string[] }` → entries whose `tags` include the tag (string) or **any** of the tags (array), sorted by `freqRank` ascending (nulls last).

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/resolve.test.js`:

```js
describe('resolveDeck auto.by=top and array tags', () => {
  const e = (id, rank, tags = []) => ({
    id, de: id, en: [id], pos: 'noun', article: 'das', ipa: null, plural: null,
    cefr: 'A1', freqRank: rank, tags, examples: [], verb: null,
    source: { dict: 'w', license: 'l' },
  });
  const lex = {
    'n:a': e('n:a', 30, ['sports']),
    'n:b': e('n:b', 10, ['games']),
    'n:c': e('n:c', 20, ['hobbies']),
    'n:d': e('n:d', null, ['sports']),
  };

  it('top returns the N lowest-rank cards in rank order', () => {
    const cards = resolveDeck({ auto: { by: 'top', count: 2 } }, lex);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c']);
  });
  it('top never exceeds count and puts null ranks last', () => {
    const cards = resolveDeck({ auto: { by: 'top', count: 10 } }, lex);
    expect(cards).toHaveLength(4);
    expect(cards[3].id).toBe('n:d');
  });
  it('tag still accepts a single string', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: 'sports' } }, lex);
    expect(cards.map((c) => c.id)).toEqual(['n:a', 'n:d']);
  });
  it('tag accepts an array and matches any of them', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: ['games', 'hobbies'] } }, lex);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: FAIL — `top` hits the `unknown auto.by "top"` throw; the array-tag case returns `[]` because `Array.prototype.includes` compares the array by identity.

- [ ] **Step 3: Implement**

In `src/packs/resolve.js`, inside the `if (deckDef.auto) {` block: add the `top` branch after the `freq` branch, and replace the existing `tag` branch. The block becomes:

```js
  if (deckDef.auto) {
    const all = Object.values(lexicon);
    const byRank = (a, b) => (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity);
    if (deckDef.auto.by === 'freq') {
      const [min, max] = deckDef.auto.range;
      return all
        .filter((e) => e.freqRank !== null && e.freqRank >= min && e.freqRank <= max)
        .sort((a, b) => a.freqRank - b.freqRank)
        .map(resolveCard);
    }
    if (deckDef.auto.by === 'top') {
      return all.slice().sort(byRank).slice(0, deckDef.auto.count).map(resolveCard);
    }
    if (deckDef.auto.by === 'cefr') {
      return all.filter((e) => e.cefr === deckDef.auto.level).map(resolveCard);
    }
    if (deckDef.auto.by === 'tag') {
      const wanted = Array.isArray(deckDef.auto.tag) ? deckDef.auto.tag : [deckDef.auto.tag];
      return all
        .filter((e) => Array.isArray(e.tags) && e.tags.some((t) => wanted.includes(t)))
        .sort(byRank)
        .map(resolveCard);
    }
    throw new Error(`resolveDeck: unknown auto.by "${deckDef.auto.by}"`);
  }
```

(`all.slice()` before sorting avoids mutating the array returned by `Object.values`; `byRank` is shared by `top` and `tag`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: PASS (including the pre-existing freq/cefr/tag/throw tests).

- [ ] **Step 5: Commit**

```bash
git add src/packs/resolve.js src/packs/resolve.test.js
git commit -m "feat(packs): resolveDeck top rule + array-form tag matching"
```

---

## Task 2: Same two rules in the async lexicon store

**Files:**
- Modify: `src/packs/lexiconStore.js` (`matches` + `resolveAutoDeck`)
- Modify: `src/packs/lexiconStore.test.js`

**Interfaces:**
- Consumes: the rule semantics from Task 1 (identical behaviour, index-row shape).
- Produces: `resolveAutoDeck` supports `{by:'top',count}` and `{by:'tag',tag:string|string[]}`. For `top` it must still load **only the chunks the sliced rows need** (the lazy-loading guarantee).

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/lexiconStore.test.js` (the file already mocks `globalThis.fetch` over the committed fixture in `beforeEach`; fixture ids by rank: `n:haus` 60, `n:wasser` 88, `n:brot` 142, `n:freund` 300, `n:bahnhof` 1200, `n:arbeit` 1500):

```js
describe('resolveAutoDeck top and array tags', () => {
  it('top returns the N lowest-rank cards and loads only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'top', count: 3 } });
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('chunk-01.json')
    );
    expect(chunk1Calls).toHaveLength(0);
  });
  it('tag accepts an array and matches any of them', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: ['travel', 'work'] } });
    expect(cards.map((c) => c.id).sort()).toEqual(['n:arbeit', 'n:bahnhof']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL — `top` throws `unknown auto.by "top"`; the array-tag case returns `[]`.

- [ ] **Step 3: Implement**

In `src/packs/lexiconStore.js`, replace `matches` and `resolveAutoDeck` with:

```js
function matches(row, auto) {
  if (auto.by === 'freq')
    return row.rank != null && row.rank >= auto.range[0] && row.rank <= auto.range[1];
  if (auto.by === 'cefr') return row.cefr === auto.level;
  if (auto.by === 'tag') {
    const wanted = Array.isArray(auto.tag) ? auto.tag : [auto.tag];
    return Array.isArray(row.tags) && row.tags.some((t) => wanted.includes(t));
  }
  if (auto.by === 'top') return true; // ranked slice happens after sorting
  throw new Error(`resolveAutoDeck: unknown auto.by "${auto.by}"`);
}

export async function resolveAutoDeck(deckDef) {
  const index = await loadIndex();
  let rows = index
    .filter((row) => matches(row, deckDef.auto))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  if (deckDef.auto.by === 'top') rows = rows.slice(0, deckDef.auto.count);
  const entries = await loadChunks(rows.map((r) => r.chunk));
  return rows.map((r) => resolveCard(entries[r.id]));
}
```

Slicing **before** `loadChunks` is what preserves lazy loading — only the chunks holding the selected rows are fetched.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: PASS (including the existing memoization and retry tests).

- [ ] **Step 5: Commit**

```bash
git add src/packs/lexiconStore.js src/packs/lexiconStore.test.js
git commit -m "feat(packs): lexiconStore top rule + array-form tag matching"
```

---

## Task 3: Re-author the decks + add the population guard

**Files:**
- Modify: `src/packs/de/autoDecks.js`
- Create: `src/packs/de/autoDecks.population.test.js`

**Interfaces:**
- Consumes: `by:'top'` and array-form `by:'tag'` (Tasks 1–2).
- Produces: `AUTO_DECKS` with 2 Frequency decks (`top`), 3 CEFR decks (unchanged), and 8 Topic decks built from real tags. `DECK_GROUPS` unchanged.

- [ ] **Step 1: Write the failing guard test**

Create `src/packs/de/autoDecks.population.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTO_DECKS } from './autoDecks';

// Guards the SHIPPED decks against the REAL lexicon index: every auto deck a user
// can click must resolve to real cards. Seven Topic decks once shipped resolving
// to zero because they filtered on tags that do not exist in the imported data —
// this test is what makes that impossible to repeat. Index-level only (no fetch):
// mirrors lexiconStore's matching, which is unit-tested separately.
const MIN_CARDS = 40;
const index = JSON.parse(readFileSync('public/lexicon/index.json', 'utf8'));

const rowsFor = (auto) => {
  if (auto.by === 'top') {
    return [...index].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).slice(0, auto.count);
  }
  if (auto.by === 'cefr') return index.filter((r) => r.cefr === auto.level);
  if (auto.by === 'tag') {
    const wanted = Array.isArray(auto.tag) ? auto.tag : [auto.tag];
    return index.filter((r) => Array.isArray(r.tags) && r.tags.some((t) => wanted.includes(t)));
  }
  if (auto.by === 'freq') {
    return index.filter((r) => r.rank != null && r.rank >= auto.range[0] && r.rank <= auto.range[1]);
  }
  throw new Error(`unknown auto.by "${auto.by}"`);
};

describe('shipped auto decks resolve against the real lexicon', () => {
  it.each(AUTO_DECKS.map((d) => [d.name, d]))(
    '"%s" resolves to at least ' + MIN_CARDS + ' cards',
    (_name, deck) => {
      expect(rowsFor(deck.auto).length).toBeGreaterThanOrEqual(MIN_CARDS);
    }
  );

  it('every deck id is unique', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/de/autoDecks.population.test.js`
Expected: FAIL — "Core 100" resolves to 8, and Travel/Home/People/Work/Body/Nature/Time resolve to 0, all below 40.

- [ ] **Step 3: Re-author the decks**

Replace the `AUTO_DECKS` array in `src/packs/de/autoDecks.js` with (keep the file's existing header comment and `DECK_GROUPS` export unchanged):

```js
export const AUTO_DECKS = [
  // Frequency — `top` takes the first N of the lexicon sorted by rank, so the
  // names describe exactly what you get. (A raw rank range would nearly miss:
  // kept entries span Leipzig ranks 1..12695 because the most frequent words are
  // function words the import filters drop.)
  { id: 'core-100', name: 'Core 100', icon: '⭐', group: 'Frequency', auto: { by: 'top', count: 100 } },
  { id: 'top-500', name: 'Top 500', icon: '🔝', group: 'Frequency', auto: { by: 'top', count: 500 } },

  { id: 'cefr-a1', name: 'A1', icon: '🟢', group: 'CEFR', auto: { by: 'cefr', level: 'A1' } },
  { id: 'cefr-a2', name: 'A2', icon: '🔵', group: 'CEFR', auto: { by: 'cefr', level: 'A2' } },
  { id: 'cefr-b1', name: 'B1', icon: '🟣', group: 'CEFR', auto: { by: 'cefr', level: 'B1' } },

  // Topics — these are Wiktionary DOMAIN labels (the only topical signal the
  // source provides), merged any-of so each deck is well populated. Counts at
  // time of writing are in docs/superpowers/specs/2026-07-13-autodecks-real-data-design.md.
  { id: 'tag-lifestyle', name: 'Lifestyle', icon: '🏠', group: 'Topics', auto: { by: 'tag', tag: 'lifestyle' } },
  {
    id: 'tag-science', name: 'Science', icon: '🔬', group: 'Topics',
    auto: { by: 'tag', tag: ['sciences', 'natural-sciences', 'physical-sciences', 'human-sciences'] },
  },
  {
    id: 'tag-hobbies', name: 'Hobbies & Games', icon: '🎲', group: 'Topics',
    auto: { by: 'tag', tag: ['hobbies', 'games', 'entertainment'] },
  },
  { id: 'tag-sports', name: 'Sports', icon: '⚽', group: 'Topics', auto: { by: 'tag', tag: 'sports' } },
  {
    id: 'tag-politics', name: 'Politics', icon: '🏛', group: 'Topics',
    auto: { by: 'tag', tag: ['politics', 'government', 'military', 'war'] },
  },
  {
    id: 'tag-business', name: 'Business & Law', icon: '💼', group: 'Topics',
    auto: { by: 'tag', tag: ['business', 'law'] },
  },
  {
    id: 'tag-tech', name: 'Tech', icon: '💻', group: 'Topics',
    auto: { by: 'tag', tag: ['computing', 'engineering', 'mathematics'] },
  },
  { id: 'tag-medicine', name: 'Medicine', icon: '🩺', group: 'Topics', auto: { by: 'tag', tag: 'medicine' } },
];
```

- [ ] **Step 4: Run the guard + the existing deck test**

Run: `npx vitest run src/packs/de/autoDecks.population.test.js src/packs/de/autoDecks.test.js`
Expected: PASS. The pre-existing `autoDecks.test.js` asserts unique ids, `name`/`icon` strings, `group ∈ DECK_GROUPS`, `auto.by ∈ ['freq','cefr','tag']`, and that all three types are present.

**If `autoDecks.test.js` fails** on `auto.by ∈ ['freq','cefr','tag']` (shipped decks now use `top`, not `freq`), update that one assertion in `src/packs/de/autoDecks.test.js` to `['top', 'freq', 'cefr', 'tag']`, and its "covers all three deck types" case to check for `top`/`cefr`/`tag`. Do not weaken any other assertion.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add src/packs/de/autoDecks.js src/packs/de/autoDecks.population.test.js src/packs/de/autoDecks.test.js
git commit -m "fix(decks): rebuild frequency/topic decks from real data + population guard"
```

---

## Self-Review

**Spec coverage:**
- §1 `top` rule in both resolvers → Tasks 1 and 2.
- §2 Topic decks from real tags with any-of merging → array-form `tag` (Tasks 1–2) + the eight decks (Task 3).
- §3 ≥40-card guard over the real index → Task 3.
- §4 testing (resolver units, population guard, existing tests green) → all three tasks.
- §5 out of scope honored: no `public/lexicon/` regeneration, CEFR decks untouched.
- §6 risk (tag vocabulary drift) is mitigated by the Task 3 guard.

**Placeholder scan:** none — every step carries complete code and exact commands. Task 3 Step 4 gives the precise conditional edit for `autoDecks.test.js` rather than a vague "fix tests if needed".

**Type consistency:** `auto: { by:'top', count:number }` and `auto: { by:'tag', tag:string|string[] }` are identical across `resolve.js` (Task 1), `lexiconStore.js` (Task 2), the deck definitions and the guard's `rowsFor` (Task 3). Index rows use `rank`; lexicon entries use `freqRank` — each resolver uses its own field correctly.

## Notes / risks for the implementer
- Do **not** touch `public/lexicon/` — it is canonical, byte-reproducible data; this change is code-only.
- The `top` rule's slice must happen **before** `loadChunks` in `lexiconStore.js`, or the lazy-loading test fails.
- The guard reads `public/lexicon/index.json` via a repo-relative path; vitest runs from the repo root (same pattern as `lexiconSample.test.js`).
- `npm test` runs the full suite per commit via the pre-commit hook.
