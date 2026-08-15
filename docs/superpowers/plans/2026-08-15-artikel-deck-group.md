# Artikel Deck Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Artikel deck group that shows a German noun bare and asks der/die/das, so the app finally teaches the gender it already ships on all 2,863 nouns.

**Architecture:** `pos` joins the lexicon index so selection can filter nouns without loading chunks; `pos` becomes a *modifier* on the existing `by` selectors so it composes with CEFR; `resolveCard` keeps the bare `lemma`; a new `ArticleChoice` component renders the three articles from `grammar.articles`. Separate deck ids give the drill its own SRS boxes for free.

**Tech Stack:** React 18 + Vite 5, inline styles from `src/lib/theme.js`, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-15-artikel-deck-group-design.md`

## Global Constraints

- **Inline styles only**, tokens from `src/lib/theme.js`. Never hardcode a colour — `src/components/noHardcodedHex.test.js` fails the build on a hex literal in a non-test `.jsx` under `src/components`.
- **Tests use `globals: false`** — import `{ describe, it, expect, vi }` from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`** (`lint-staged` + full `npm test`). `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.** The new decks reuse the existing `srs` map under new deck ids.
- **Exactly one existing test may change: `scripts/import-lexicon/chunk.test.js`** (Task 1, Step 3). It asserts the index row shape with `toEqual`, which is the thing Task 1 deliberately changes. **If any other existing test fails, stop** — the design is wrong, re-open the spec.
- **Do not re-run `npm run import:lexicon`.** It re-downloads multi-GB sources. Task 1 regenerates the index from chunks already on disk.
- Open a PR against `main`; never push to `main`.

## File Structure

| file | change |
|---|---|
| `scripts/import-lexicon/chunk.js` | index rows gain `pos` |
| `scripts/import-lexicon/chunk.test.js` | **the one authorized existing-test change** |
| `public/lexicon/de/index.json` | regenerated, +52.6 KB |
| `src/packs/lexiconSample.test.js` | extended with the row↔entry `pos` proof |
| `src/packs/lexiconStore.js` | `matches()` gains the `pos` clause |
| `src/packs/lexiconStore.test.js` | new cases for the modifier |
| `src/packs/resolve.js` | `resolveCard` keeps `lemma` |
| `src/packs/resolve.test.js` | new case |
| `src/packs/de/autoDecks.js` | `Artikel` group + three decks |
| `src/components/vocab/ArticleChoice.jsx` | new |
| `src/components/vocab/ArticleChoice.test.jsx` | new |
| `src/components/VocabTab.jsx` | routes noun-gender decks to the new exercise |

---

### Task 1: `pos` joins the lexicon index

**Files:**
- Modify: `scripts/import-lexicon/chunk.js:17`
- Modify: `scripts/import-lexicon/chunk.test.js:20-23`
- Modify: `public/lexicon/de/index.json` (regenerated)
- Modify: `src/packs/lexiconSample.test.js`

**Interfaces:**
- Produces: index rows shaped `{ id, rank, cefr, pos, tags, chunk }`. Task 2 filters on `row.pos`.

- [ ] **Step 1: Add `pos` to the index row**

In `scripts/import-lexicon/chunk.js`, line 17 currently reads:

```js
    return { id: entry.id, rank: entry.freqRank, cefr: entry.cefr, tags: entry.tags, chunk };
```

Change it to:

```js
    // pos is in the index (not just the chunk) so selectRows can filter by part
    // of speech without fetching chunks — the whole point of the index. The `n:`
    // id prefix encodes the same thing, but POS_PREFIX belongs to ids.js and
    // duplicating that convention in the runtime store is two values that must
    // agree with nothing checking that they do.
    return {
      id: entry.id,
      rank: entry.freqRank,
      cefr: entry.cefr,
      pos: entry.pos,
      tags: entry.tags,
      chunk,
    };
```

- [ ] **Step 2: Run the importer's unit tests to see the expected failure**

Run: `npx vitest run scripts/import-lexicon/chunk.test.js`

Expected: FAIL — `builds an index and packs entries into chunks` reports the received rows carry an extra `pos` key. This is the authorized change; confirm the failure is *only* the added key before touching the test.

- [ ] **Step 3: Update the one authorized existing test**

In `scripts/import-lexicon/chunk.test.js`, the fixture builder at line 7 does not set `pos`. Add it, then add `pos` to the three expected rows.

Change the `mk` helper to accept a pos, defaulting to noun:

```js
const mk = (id, rank, cefr, tags = [], pos = 'noun') => ({
  id,
  pos,
  cefr,
  freqRank: rank,
  tags,
  examples: [{ de: 'a', en: 'b', source: 'tatoeba' }],
});
```

(Keep whatever other fields the existing `mk` sets — add `pos`, do not remove anything.)

Then the expectation at lines 20-23 becomes:

```js
    expect(index).toEqual([
      { id: 'n:a', rank: 1, cefr: 'A1', pos: 'noun', tags: ['food'], chunk: 0 },
      { id: 'n:b', rank: 2, cefr: 'A1', pos: 'noun', tags: [], chunk: 0 },
      { id: 'n:c', rank: 3, cefr: 'A1', pos: 'noun', tags: [], chunk: 1 },
    ]);
```

Run: `npx vitest run scripts/import-lexicon/chunk.test.js`
Expected: PASS.

- [ ] **Step 4: Regenerate the shipped index from the chunks already on disk**

The chunks carry `pos` for every entry, so no download is needed. Run exactly:

```bash
node -e "
const fs=require('fs');const d='public/lexicon/de';
const idx=JSON.parse(fs.readFileSync(d+'/index.json','utf8'));
const entries={};
for(const f of fs.readdirSync(d).filter(f=>/^chunk-\d+\.json$/.test(f)))
  Object.assign(entries, JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));
const out=idx.map(r=>{
  const e=entries[r.id];
  if(!e) throw new Error('no chunk entry for '+r.id);
  if(!e.pos) throw new Error('entry has no pos: '+r.id);
  return {id:r.id, rank:r.rank, cefr:r.cefr, pos:e.pos, tags:r.tags, chunk:r.chunk};
});
if(out.length!==idx.length) throw new Error('row count changed');
fs.writeFileSync(d+'/index.json', JSON.stringify(out));
console.log('rewrote', out.length, 'rows');
"
```

Expected output: `rewrote 4201 rows`

Note the key order — `id, rank, cefr, pos, tags, chunk` — matches Step 1 exactly, so a future `npm run import:lexicon` produces the same shape.

- [ ] **Step 5: Prove the regenerated index is the old one plus `pos`**

This is the gate from spec §4. Run:

```bash
node -e "
const fs=require('fs');
const before=JSON.parse(require('child_process').execSync('git show HEAD:public/lexicon/de/index.json').toString());
const after=JSON.parse(fs.readFileSync('public/lexicon/de/index.json','utf8'));
if(before.length!==after.length) throw new Error('row count changed');
for(let i=0;i<before.length;i++){
  const a={...after[i]}; delete a.pos;
  if(JSON.stringify(a)!==JSON.stringify(before[i]))
    throw new Error('row '+i+' changed beyond pos:\n  '+JSON.stringify(before[i])+'\n  '+JSON.stringify(a));
  if(!after[i].pos) throw new Error('row '+i+' has no pos');
}
console.log('OK: all', before.length, 'rows identical except the added pos');
"
```

Expected: `OK: all 4201 rows identical except the added pos`

**If this fails, stop and report.** Do not hand-edit `index.json`.

- [ ] **Step 6: Make the proof permanent**

In `src/packs/lexiconSample.test.js`, inside the existing `it('every index row resolves to a present, valid entry with matching fields')`, add one assertion after the `cefr` line:

```js
      expect(entry.cefr).toBe(row.cefr);
      // The index carries pos so selectRows can filter by part of speech
      // without fetching chunks; it has to keep agreeing with the entry.
      expect(entry.pos).toBe(row.pos);
```

Run: `npx vitest run src/packs/lexiconSample.test.js`
Expected: PASS.

- [ ] **Step 7: Full suite, then commit**

Run: `npx vitest run`
Expected: all green. **`autoDecks.population.test.js` must still pass** — it resolves every deck against the real index, so it is a free end-to-end check that the regenerated index is sound.

```bash
git add scripts/import-lexicon/chunk.js scripts/import-lexicon/chunk.test.js public/lexicon/de/index.json src/packs/lexiconSample.test.js
git commit -m "feat(lexicon): carry pos in the index so selection can filter nouns"
```

---

### Task 2: `pos` as a modifier on every selector

**Files:**
- Modify: `src/packs/lexiconStore.js` (`matches`)
- Modify: `src/packs/lexiconStore.test.js`

**Interfaces:**
- Consumes: `row.pos` from Task 1.
- Produces: `selectRows(index, { by, ..., pos })` filters to that part of speech. Task 4's deck definitions rely on it.

- [ ] **Step 1: Write the failing tests**

Add to `src/packs/lexiconStore.test.js`:

```js
describe('selectRows pos modifier', () => {
  const index = [
    { id: 'n:a', rank: 1, cefr: 'A1', pos: 'noun', tags: [], chunk: 0 },
    { id: 'v:b', rank: 2, cefr: 'A1', pos: 'verb', tags: [], chunk: 0 },
    { id: 'n:c', rank: 3, cefr: 'A2', pos: 'noun', tags: [], chunk: 0 },
  ];

  it('composes with cefr rather than replacing it', () => {
    const rows = selectRows(index, { by: 'cefr', level: 'A1', pos: 'noun' });
    expect(rows.map((r) => r.id)).toEqual(['n:a']);
  });

  it('composes with top', () => {
    const rows = selectRows(index, { by: 'top', count: 10, pos: 'noun' });
    expect(rows.map((r) => r.id)).toEqual(['n:a', 'n:c']);
  });

  it('is optional — omitting it changes nothing', () => {
    expect(selectRows(index, { by: 'cefr', level: 'A1' }).map((r) => r.id)).toEqual(['n:a', 'v:b']);
  });

  it('fails closed on a row with no pos', () => {
    // A returning user can hold a cached index from before pos existed. Better
    // an empty Artikel deck for one load, self-healing on revalidation, than
    // verbs served into a gender drill.
    const stale = [{ id: 'n:a', rank: 1, cefr: 'A1', tags: [], chunk: 0 }];
    expect(selectRows(stale, { by: 'cefr', level: 'A1', pos: 'noun' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL — the pos-filtered cases return unfiltered rows.

- [ ] **Step 3: Implement**

In `src/packs/lexiconStore.js`, `matches()` currently starts at line 65. Add the modifier clause as the **first** statement in the function, before the `by` dispatch:

```js
function matches(row, auto) {
  // A modifier, not a `by` kind: it composes with every selector, so
  // "A1 nouns" and "the 100 most frequent verbs" both fall out for free.
  // Fails closed on a row with no pos — a cached pre-pos index yields an
  // empty deck that self-heals, rather than the wrong part of speech.
  if (auto.pos && row.pos !== auto.pos) return false;
  if (auto.by === 'freq')
    ...
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packs/lexiconStore.js src/packs/lexiconStore.test.js
git commit -m "feat(lexicon): pos filters as a modifier on every selector"
```

---

### Task 3: the resolved card keeps its bare lemma

**Files:**
- Modify: `src/packs/resolve.js`
- Modify: `src/packs/resolve.test.js`

**Interfaces:**
- Produces: `card.lemma` — the noun without its article. Task 5 renders it.

- [ ] **Step 1: Write the failing test**

Add to `src/packs/resolve.test.js`:

```js
it('keeps the bare lemma alongside the composed display form', () => {
  // `de` is the display form, so a gender drill rendering it would print
  // "das Jahr" and give away its own answer.
  const card = resolveCard(
    { id: 'n:jahr', de: 'Jahr', en: ['year'], pos: 'noun', article: 'das' },
    { articlePosition: 'before' }
  );
  expect(card.de).toBe('das Jahr');
  expect(card.lemma).toBe('Jahr');
  expect(card.article).toBe('das');
});

it('lemma equals de when there is no article', () => {
  const card = resolveCard({ id: 'v:gehen', de: 'gehen', en: ['to go'], pos: 'verb' }, {});
  expect(card.de).toBe('gehen');
  expect(card.lemma).toBe('gehen');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: FAIL — `card.lemma` is `undefined`.

- [ ] **Step 3: Implement**

In `src/packs/resolve.js`, add one field to the returned object, directly after `de`:

```js
    de: display,
    // The lemma before the article is composed in. `de` is a display string;
    // anything that needs the word itself (the gender drill) needs this.
    lemma: entry.de,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/resolve.test.js && npx vitest run src/packs`
Expected: PASS, and no other pack test regresses.

- [ ] **Step 5: Commit**

```bash
git add src/packs/resolve.js src/packs/resolve.test.js
git commit -m "feat(lexicon): resolved cards keep the bare lemma"
```

---

### Task 4: the Artikel decks and the exercise component

**Files:**
- Modify: `src/packs/de/autoDecks.js`
- Create: `src/components/vocab/ArticleChoice.jsx`
- Create: `src/components/vocab/ArticleChoice.test.jsx`

**Interfaces:**
- Consumes: the `pos` modifier from Task 2.
- Produces: deck ids `artikel-a1|a2|b1`, and `<ArticleChoice articles onChoose />`. Task 5 wires them together.

- [ ] **Step 1: Add the group and the decks**

In `src/packs/de/autoDecks.js`, line 2:

```js
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics', 'Artikel'];
```

Append to `AUTO_DECKS`:

```js
  // Artikel — the same nouns as the CEFR decks, drilled for gender instead of
  // meaning. Scoped by level because an all-nouns deck would touch all 9 chunks
  // (~2.4 MB) on one tap; these touch 2, 4 and 5. Every noun falls inside
  // A1/A2/B1, so the three of them reach all 2,863 without a catch-all.
  {
    id: 'artikel-a1',
    name: 'A1 Nouns',
    icon: '🟢',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'A1', pos: 'noun' },
  },
  {
    id: 'artikel-a2',
    name: 'A2 Nouns',
    icon: '🔵',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'A2', pos: 'noun' },
  },
  {
    id: 'artikel-b1',
    name: 'B1 Nouns',
    icon: '🟣',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'B1', pos: 'noun' },
  },
```

- [ ] **Step 2: Verify the existing deck guards still pass**

Run: `npx vitest run src/packs/de/autoDecks.test.js src/packs/de/autoDecks.population.test.js`

Expected: PASS, both **unchanged**. `autoDecks.test.js` asserts `d.auto.by` is one of `top|freq|cefr|tag` — the Artikel decks use `cefr`, which is exactly why `pos` is a modifier. `autoDecks.population.test.js` resolves each deck against the real index and requires ≥40 cards; expect 607 / 876 / 1380.

If `population` reports 0 cards, Task 1's index regeneration did not land — go back, do not weaken the test.

- [ ] **Step 3: Write the failing component test**

Create `src/components/vocab/ArticleChoice.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleChoice from './ArticleChoice';

const ARTICLES = ['der', 'die', 'das'];

describe('ArticleChoice', () => {
  it('renders one button per article, in the pack order', () => {
    // Deliberately not shuffled: three fixed positions become muscle memory,
    // and reshuffling them every card taxes recognition without testing anything.
    render(<ArticleChoice articles={ARTICLES} onChoose={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(ARTICLES);
  });

  it('reports the article that was clicked', async () => {
    const onChoose = vi.fn();
    render(<ArticleChoice articles={ARTICLES} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'die' }));
    expect(onChoose).toHaveBeenCalledWith('die');
  });

  it('renders whatever the pack declares, not a hardcoded three', () => {
    render(<ArticleChoice articles={['el', 'la']} onChoose={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['el', 'la']);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/components/vocab/ArticleChoice.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

Create `src/components/vocab/ArticleChoice.jsx`:

```jsx
import { BUTTON, SPACE } from '../../lib/theme';

/**
 * The gender drill's answer row. Options come from the pack's
 * grammar.articles, so the engine holds no German.
 *
 * Not shuffled, unlike ChoiceGrid: there are only three, their positions become
 * muscle memory, and reshuffling them every card would tax recognition without
 * testing anything.
 *
 * @param {{ articles: string[], onChoose: (article: string) => void }} props
 */
export default function ArticleChoice({ articles, onChoose }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${articles.length}, minmax(0, 1fr))`,
        gap: SPACE[3],
      }}
    >
      {articles.map((article) => (
        <button
          key={article}
          type="button"
          onClick={() => onChoose(article)}
          style={{ ...BUTTON.tile, padding: SPACE[4] }}
        >
          {article}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes, then commit**

Run: `npx vitest run src/components/vocab/ArticleChoice.test.jsx`
Expected: PASS.

```bash
git add src/packs/de/autoDecks.js src/components/vocab/ArticleChoice.jsx src/components/vocab/ArticleChoice.test.jsx
git commit -m "feat(vocab): Artikel decks and the article-choice exercise"
```

---

### Task 5: wire the drill into VocabTab

**Files:**
- Modify: `src/components/VocabTab.jsx`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Add the deck-kind derivation**

In `src/components/VocabTab.jsx`, next to the existing `showChoices` / `showTyped` block, add:

```js
  // Artikel decks drill gender rather than meaning. Keyed off the deck's group
  // so adding a deck to the group is enough — no second list to keep in sync.
  const isArtikel = AUTO_DECKS.some((d) => d.id === deckId && d.group === 'Artikel');
```

Import `AUTO_DECKS` from `'../packs/de/autoDecks'` (it is already imported in `DeckPicker`, not here).

Then gate the three existing exercise rows so the gender drill replaces them:

```js
  const showChoices = !isArtikel && isBeginner && activeDeck.length >= 4;
  const showTyped = !isArtikel && (level === 'b1' || (isBeginner && activeDeck.length < 4));
```

- [ ] **Step 2: Add the answer handler**

Next to `chooseOption`, add:

```js
  const chooseArticle = (article) => {
    if (clickLockRef.current) return;
    const correct = article === card.article;
    const verdict = correct ? 'correct' : 'wrong';
    setAnswered(true);
    setResult(verdict);
    // Deliberately no markLearned: learnedWords is keyed by card.id with no
    // notion of which skill was shown, so a correct gender guess would tell the
    // vocab decks the learner knows a word whose meaning was never asked. The
    // SRS keeps the two apart by deck id, which is where this progress lives.
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, card.article, verdict);
  };
```

- [ ] **Step 3: Render the bare lemma and the article row**

The card face must not show the article. Pass an override to `CardFace` — add a `display` prop rather than a second component:

In `src/components/vocab/CardFace.jsx`, change the headword line from `{card.de}` to:

```jsx
        {display ?? card.de}
```

and add `display` to the destructured props and the JSDoc.

In `VocabTab.jsx`, render:

```jsx
              <CardFace
                card={card}
                display={isArtikel ? card.lemma : undefined}
                learned={!!learnedWords[card.id]}
                mobile={mobile}
              />

              {isArtikel && !answered && (
                <ArticleChoice
                  articles={activePack.grammar.articles}
                  onChoose={chooseArticle}
                />
              )}
```

Import `ArticleChoice` from `'./vocab/ArticleChoice'`.

`VerdictPanel` needs no change — pass `answer={card.de}` as it already does, so a wrong guess shows the full "das Jahr".

- [ ] **Step 4: Verify no existing test regressed**

Run: `npx vitest run`

Expected: all green, with **`VocabTab.test.jsx` and `VocabTab.choices.test.jsx` unchanged**. They never select an Artikel deck, so every path they exercise is behind `!isArtikel`. If either fails, the gating is wrong — fix the code, not the test.

Run: `npm run lint && npm run format:check`

- [ ] **Step 5: Verify in the browser**

The one thing no unit test covers is that the learner cannot see the answer.

```bash
npm run build
```

Then start the `prod-preview` server, click through *Try it first → Beginner (A1) → Vocab*, and pick **A1 Nouns** under Artikel. Confirm:

1. the card shows the **bare** noun — "Jahr", not "das Jahr";
2. three buttons read der / die / das in that order;
3. a wrong answer shows the verdict with the full correct form "das Jahr";
4. the ✓ LEARNED badge does **not** appear after a correct gender answer;
5. GOOD advances the queue and the counter drops by one;
6. no console errors.

- [ ] **Step 6: Commit and open the PR**

```bash
git add src/components/VocabTab.jsx src/components/vocab/CardFace.jsx
git commit -m "feat(vocab): drill noun gender in the Artikel decks"
git push -u origin feat/artikel-deck-group
gh pr create --base main --title "feat(vocab): Artikel deck group — drill noun gender"
```

**Do not open it as a draft**, and target `main`: `.github/workflows/ci.yml` only runs on PRs targeting `main`.

In the PR body state: that 2,863 nouns carried an unused article; the measured chunk fan-out (2/4/5 of 9, and why there is no all-nouns deck); why `pos` went into the index rather than being read off the `n:` prefix; why `pos` is a modifier (and that `autoDecks.test.js` passing unchanged is the evidence); that `markLearned` is deliberately not called; the index-regeneration proof from Task 1 Step 5; and the one authorized existing-test change with its reason.

---

## Self-Review

**Spec coverage.** §3.1 → Task 1. §3.2 → Task 2. §3.3 → Task 4 Step 1. §3.4 → Task 3. §3.5 → Task 4 Steps 3-5 and Task 5 Step 3. §3.6 → Task 5 Step 2. §4 → Task 1 Steps 4-6. §7 → the verify steps in each task plus Task 5 Step 5.

**Refinement to spec §4.** The spec said existing fields stay "byte-identical". Inserting a key changes the file's bytes regardless, so Task 1 Step 5 states the checkable version: parse both, delete `pos` from each new row, and require deep equality with the old row in the same position. That is the real guarantee.

**Type consistency.** `pos` is a string on both index rows and entries. `auto.pos` matches `row.pos` exactly (`'noun'`). `card.lemma` is set in Task 3 and read in Task 5. `ArticleChoice` takes `articles`/`onChoose` in Task 4 and is called with exactly those in Task 5. `CardFace` gains `display` in Task 5 Step 3, which is the only change to an existing component's signature.
