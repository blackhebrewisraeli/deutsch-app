# Plural Deck Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Plural deck group that shows a German noun's singular and asks the learner to type its plural, graded against the pack's own target-language text rules.

**Architecture:** Deck definitions gain an optional `auto.has`, applied *after* card resolution because the index cannot know it; `grammar` gains `pluralArticle` so the answer echoes "die Jahre" without a German literal in the engine; `TypedAnswer` gains optional label/placeholder; `VocabTab` routes Plural decks to it and grades with the existing `exactMatch` against `validation.target`.

**Tech Stack:** React 18 + Vite 5, inline styles from `src/lib/theme.js`, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-15-plural-deck-group-design.md`

## Global Constraints

- **Inline styles only**, tokens from `src/lib/theme.js`. Never hardcode a colour.
- **Tests use `globals: false`** — import `{ describe, it, expect, vi }` from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`** (`lint-staged` + full `npm test`). `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **Exactly one existing test may change: `src/packs/de/autoDecks.population.test.js`** (Task 1, Step 5) — it measures the pre-filter count and would otherwise look like it covers `has` decks when it does not. **If any other existing test fails, stop** and re-open the spec.
- **Do not re-run `npm run import:lexicon`.** Nothing here changes the artifacts.
- Open a PR against `main`; never push to `main`.

## Already exists — do not rebuild

- **`exactMatch(expected, given, rules)`** in `src/lib/matching.js` is already
  `normalizeText(expected, rules) === normalizeText(given, rules)`. The spec
  described building this; it is there. Use it.
- **`validation.target`** is declared by the German pack and has no consumer.
  This is its first.
- `CardFace`'s `display` prop, `card.lemma`, and the `auto.pos` modifier all
  landed in #105.

## File Structure

| file | change |
|---|---|
| `src/packs/lexiconStore.js` | `resolveAutoDeck` applies `auto.has` after resolution |
| `src/packs/lexiconStore.test.js` | new cases for `has` |
| `src/packs/de/autoDecks.population.test.js` | **the one authorized existing-test change** |
| `src/packs/de/grammar.js` | `pluralArticle: 'die'` |
| `src/packs/de/autoDecks.js` | `Plural` group + three decks |
| `src/components/vocab/TypedAnswer.jsx` | optional `label` / `placeholder` |
| `src/components/vocab/TypedAnswer.test.jsx` | new cases for the props |
| `src/components/VocabTab.jsx` | routes Plural decks, grades, echoes the full form |
| `src/components/VocabTab.test.jsx` | new `describe`, no existing assertion touched |

---

### Task 1: `auto.has` filters resolved cards

**Files:**
- Modify: `src/packs/lexiconStore.js` (`resolveAutoDeck`)
- Modify: `src/packs/lexiconStore.test.js`
- Modify: `src/packs/de/autoDecks.population.test.js`

**Interfaces:**
- Produces: `resolveAutoDeck` drops resolved cards whose `auto.has` field is
  absent/falsy. Task 2's decks rely on it.

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/lexiconStore.test.js`:

```js
describe('auto.has drops cards missing a field', () => {
  it('keeps only cards carrying the named field', async () => {
    // n:brot has a plural in the fixture; give the deck a field nothing has and
    // the deck must come back empty rather than serving unanswerable cards.
    const withPlural = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'plural' } },
      grammar,
      'de'
    );
    expect(withPlural.length).toBeGreaterThan(0);
    expect(withPlural.every((c) => c.plural)).toBe(true);

    const withNothing = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'nosuchfield' } },
      grammar,
      'de'
    );
    expect(withNothing).toEqual([]);
  });

  it('is optional — omitting it changes nothing', async () => {
    const all = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(all.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']);
  });
});
```

- [ ] **Step 2: Confirm the fixture can actually distinguish the two cases**

Already checked when this plan was written — **every fixture entry carries a
plural**, so the assertion is not vacuous:

```
n:brot Brote   n:wasser Wässer   n:haus Häuser
n:bahnhof Bahnhöfe   n:freund Freunde   n:arbeit Arbeiten
```

Re-run it anyway, because a passing `has: 'plural'` assertion looks identical
whether the fixture is full or empty:

```bash
node -e "const c={...require('./src/packs/__fixtures__/lexicon/chunk-00.json'),...require('./src/packs/__fixtures__/lexicon/chunk-01.json')}; for (const [k,v] of Object.entries(c)) console.log(k, JSON.stringify(v.plural));"
```

If any food-tagged entry ever loses its plural, add one back rather than
weakening the test.

Note for Task 4: `Wässer` and `Häuser` carry umlauts, so the same fixture can
exercise the `ae` keyboard-substitution path without inventing data.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL — `has` is ignored, so the `nosuchfield` deck returns cards.

- [ ] **Step 4: Implement**

In `src/packs/lexiconStore.js`, change the last line of `resolveAutoDeck`:

```js
  return rows.filter((r) => entries[r.id]).map((r) => resolveCard(entries[r.id], grammar));
```

to:

```js
  const cards = rows.filter((r) => entries[r.id]).map((r) => resolveCard(entries[r.id], grammar));
  // `auto.has` is applied HERE and not in selectRows, deliberately. selectRows
  // filters the index, and the index carries only id/rank/cefr/pos/tags/chunk —
  // it cannot know whether an entry has a plural. `pos` earned an index field in
  // #105 because selection cannot proceed without it; this cannot be known until
  // the chunks are already loaded, so an index field would buy nothing and cost
  // ~60 KB. The split is inherent. Do not "tidy" this into matches().
  return auto.has ? cards.filter((c) => c[auto.has]) : cards;
```

`auto` is `deckDef.auto`; bind it at the top of the function if it is not
already in scope:

```js
export async function resolveAutoDeck(deckDef, grammar, packId) {
  const auto = deckDef.auto;
  const rows = selectRows(await loadIndex(packId), auto);
```

Also add the matching note in `matches()` in the same file, directly under the
`auto.pos` clause:

```js
  // NOTE: `auto.has` is NOT handled here — see resolveAutoDeck. It names a field
  // on the resolved card, which the index does not carry.
```

- [ ] **Step 5: Run to verify they pass, then fix the population test**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: PASS.

`src/packs/de/autoDecks.population.test.js:19` asserts
`selectRows(index, deck.auto).length >= 40`, which for a `has` deck is the
*pre-filter* count. It passes either way, which is the problem: it would look
like it covers the new decks. Extend it to honour `has`, reading the chunks off
disk so it stays fetch-free:

```js
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'public/lexicon/de';
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
// `has` names a field on the resolved entry, which the index does not carry, so
// honouring it needs the chunks. Read from disk, not fetched — this test stays
// index-and-artifact level with no network.
const entries = readdirSync(DIR)
  .filter((f) => /^chunk-\d+\.json$/.test(f))
  .reduce((acc, f) => Object.assign(acc, JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))), {});

const answerableCount = (deck) => {
  const rows = selectRows(index, deck.auto);
  return deck.auto.has ? rows.filter((r) => entries[r.id]?.[deck.auto.has]).length : rows.length;
};
```

and change the assertion body to:

```js
      expect(answerableCount(deck)).toBeGreaterThanOrEqual(MIN_CARDS);
```

Keep `MIN_CARDS` and the existing unique-ids test untouched.

- [ ] **Step 6: Full suite and commit**

Run: `npx vitest run`

```bash
git add src/packs/lexiconStore.js src/packs/lexiconStore.test.js src/packs/de/autoDecks.population.test.js
git commit -m "feat(lexicon): auto.has drops resolved cards missing a field"
```

---

### Task 2: the pack declares the plural article and the decks

**Files:**
- Modify: `src/packs/de/grammar.js`
- Modify: `src/packs/de/autoDecks.js`

**Interfaces:**
- Produces: `grammar.pluralArticle` (string | undefined) and deck ids
  `plural-a1|a2|b1`. Task 4 reads both.

- [ ] **Step 1: Add the grammar field**

In `src/packs/de/grammar.js`, under the Nouns block after `articlePosition`:

```js
  // German's plural definite article, invariant across all three genders. The
  // drill echoes "die Jahre" rather than a bare "Jahre" because the full form is
  // what sticks. A language with no plural article leaves this undefined and
  // gets the bare form.
  pluralArticle: 'die',
```

`src/packs/validate.js` checks required fields and does not reject unknown ones,
so this needs no validator change. Do not add one — an optional field with a
sensible undefined behaviour has nothing to enforce.

- [ ] **Step 2: Add the group and decks**

In `src/packs/de/autoDecks.js`, line 2:

```js
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics', 'Artikel', 'Plural'];
```

Append to `AUTO_DECKS`:

```js
  // Plural — the same nouns again, typed rather than chosen. `has: 'plural'`
  // drops the 8% (mass nouns, proper nouns, import gaps) that carry none; a card
  // with no answer is unanswerable, not merely dull. 580 / 815 / 1,240 cards.
  {
    id: 'plural-a1',
    name: 'A1 Nouns',
    icon: '🟢',
    group: 'Plural',
    auto: { by: 'cefr', level: 'A1', pos: 'noun', has: 'plural' },
  },
  {
    id: 'plural-a2',
    name: 'A2 Nouns',
    icon: '🔵',
    group: 'Plural',
    auto: { by: 'cefr', level: 'A2', pos: 'noun', has: 'plural' },
  },
  {
    id: 'plural-b1',
    name: 'B1 Nouns',
    icon: '🟣',
    group: 'Plural',
    auto: { by: 'cefr', level: 'B1', pos: 'noun', has: 'plural' },
  },
```

- [ ] **Step 3: Verify the deck guards**

Run: `npx vitest run src/packs/de/ src/packs/packs.test.js src/packs/validate.test.js`

Expected: PASS. `autoDecks.test.js` must be **unchanged** — it pins `auto.by` to
`top|freq|cefr|tag` (these use `cefr`) and its payload check ignores extra keys.
The population test, now fixed by Task 1, should report the post-filter counts;
confirm it still clears `MIN_CARDS`.

Then confirm the real numbers:

```bash
node -e "
const fs=require('fs');const d='public/lexicon/de';
const e={};for(const f of fs.readdirSync(d).filter(f=>/^chunk-\d+\.json$/.test(f)))Object.assign(e,JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));
const idx=require('./public/lexicon/de/index.json');
for(const l of ['A1','A2','B1'])
  console.log(l, idx.filter(r=>r.cefr===l&&r.pos==='noun'&&e[r.id].plural).length);
"
```

Expected: `A1 580`, `A2 815`, `B1 1240`.

- [ ] **Step 4: Commit**

```bash
git add src/packs/de/grammar.js src/packs/de/autoDecks.js
git commit -m "feat(pack): plural article and the Plural deck group"
```

---

### Task 3: `TypedAnswer` can ask a different question

**Files:**
- Modify: `src/components/vocab/TypedAnswer.jsx`
- Modify: `src/components/vocab/TypedAnswer.test.jsx`

**Interfaces:**
- Produces: `<TypedAnswer label placeholder … />`, both optional, defaulting to
  today's English-meaning strings so no existing call site changes.

- [ ] **Step 1: Write the failing test**

Append to `src/components/vocab/TypedAnswer.test.jsx`:

```js
describe('TypedAnswer question text', () => {
  it('defaults to asking for the English meaning', () => {
    render(<TypedAnswer value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Type the English meaning' })).toBeInTheDocument();
  });

  it('can ask something else without a second component', () => {
    render(
      <TypedAnswer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        label="Type the plural"
        placeholder="die …"
      />
    );
    const input = screen.getByRole('textbox', { name: 'Type the plural' });
    expect(input).toHaveAttribute('placeholder', 'die …');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/vocab/TypedAnswer.test.jsx`
Expected: FAIL — no textbox named "Type the plural".

- [ ] **Step 3: Implement**

In `src/components/vocab/TypedAnswer.jsx`, take the two props with defaults and
use them:

```jsx
export default function TypedAnswer({
  value,
  onChange,
  onSubmit,
  label = 'Type the English meaning',
  placeholder = 'Type the English meaning…',
}) {
```

then `aria-label={label}` and `placeholder={placeholder}` on the input. Change
nothing else — the button, styles and disabled logic stay exactly as they are.

- [ ] **Step 4: Run to verify, then commit**

Run: `npx vitest run src/components/vocab/TypedAnswer.test.jsx`
Expected: PASS, including the pre-existing cases that name the English label.

```bash
git add src/components/vocab/TypedAnswer.jsx src/components/vocab/TypedAnswer.test.jsx
git commit -m "feat(vocab): TypedAnswer can ask a different question"
```

---

### Task 4: wire the drill, verify, open the PR

**Files:**
- Modify: `src/components/VocabTab.jsx`
- Modify: `src/components/VocabTab.test.jsx` (additive only)

- [ ] **Step 1: Route Plural decks**

Beside the existing `isArtikel` line:

```js
  const isPlural = AUTO_DECKS.some((d) => d.id === deckId && d.group === 'Plural');
```

and extend the two existing gates so the meaning exercises stay out of the way:

```js
  const showChoices = !isArtikel && !isPlural && isBeginner && activeDeck.length >= 4;
  const showTyped =
    !isArtikel && !isPlural && (level === 'b1' || (isBeginner && activeDeck.length < 4));
```

- [ ] **Step 2: Grade it**

Import `exactMatch` alongside `fuzzyMatch`:

```js
import { fuzzyMatch, exactMatch } from '../lib/matching';
```

and add the handler next to `chooseArticle`:

```js
  const submitPlural = () => {
    if (!typedAnswer.trim() || !card || clickLockRef.current) return;
    // Exact after normalising with the pack's TARGET rules — not fuzzyMatch.
    // Those rules fold the substitutions German defines for keyboards without
    // umlauts (Staedte === Städte) while keeping Stadte wrong, so what survives
    // normalisation is a genuinely different word. "Jahren" is one edit from
    // "Jahre" and grading it 'almost' would teach that a wrong plural is nearly
    // right.
    const verdict = exactMatch(card.plural, typedAnswer, activePack.validation.target)
      ? 'correct'
      : 'wrong';
    setAnswered(true);
    setResult(verdict);
    // No markLearned, as with the gender drill: knowing a plural is not knowing
    // the word, and learnedWords cannot tell the two apart.
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, card.plural, verdict);
  };
```

- [ ] **Step 3: Render**

Add beside the Artikel block:

```jsx
              {isPlural && !answered && (
                <TypedAnswer
                  value={typedAnswer}
                  onChange={setTypedAnswer}
                  onSubmit={submitPlural}
                  label="Type the plural"
                  placeholder={
                    activePack.grammar.pluralArticle
                      ? `${activePack.grammar.pluralArticle} …`
                      : 'Type the plural…'
                  }
                />
              )}
```

and extend the `VerdictPanel` answer so the full form comes back:

```jsx
                  answer={
                    isArtikel
                      ? card.de
                      : isPlural
                        ? [activePack.grammar.pluralArticle, card.plural].filter(Boolean).join(' ')
                        : card.en
                  }
```

The card face needs **no** `display` override — Plural shows `card.de`
("das Jahr"), which is the default and is a legitimate cue (spec §3.1).

- [ ] **Step 4: Add regression tests (additive)**

Append a new `describe` inside `VocabTab.test.jsx`'s outer describe, reusing the
lexicon fixture mock already used by the Artikel block. Cover: the card shows the
articled singular; a correct typed plural grades correct **without** calling
`markLearned`; a wrong-but-close plural (`Brots` for `Brote`) grades **wrong**,
not almost; and the verdict echoes the plural-articled form.

Use whatever plural the fixture actually carries (Task 1 Step 2 may have added
it) — read the fixture rather than assuming `Brote`.

- [ ] **Step 5: Verify**

Run: `npx vitest run`, `npm run lint`, `npm run format:check`.

`VocabTab.choices.test.jsx` and every existing assertion in `VocabTab.test.jsx`
must be untouched.

**Prove the strictness is real** by temporarily swapping `exactMatch` for
`fuzzyMatch(card.plural, typedAnswer, activePack.validation.target)` with the
`dist <= 2 ? 'almost'` shape; the wrong-but-close test must fail. Restore and
confirm a clean diff.

- [ ] **Step 6: Browser**

```bash
npm run build
```

Start `prod-preview`. **If a service worker from an earlier session is
controlling the page, unregister it and clear caches before trusting what you
see** — that cost a debugging detour in #105:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
location.reload();
```

Then: trial → A1 → Vocab → **A1 Nouns under Plural**. Confirm the card reads
"das Jahr"; typing `Jahre` grades correct with no LEARNED badge; typing `Jahren`
grades wrong and echoes "die Jahre"; and on a card with an umlaut plural, the
`ae` spelling is accepted. Check the console for errors.

- [ ] **Step 7: Commit and open the PR**

```bash
git add -A
git commit -m "feat(vocab): drill noun plurals in the Plural decks"
git push -u origin feat/plural-deck-group
gh pr create --base main --title "feat(vocab): Plural deck group — drill noun plurals"
```

Non-draft, targeting `main`. In the body: the 92% coverage and per-level counts;
that this is `validation.target`'s first consumer; why grading is exact rather
than fuzzy, with the `Staedte`/`Stadte`/`Jahren` table; why `auto.has` is applied
after resolution rather than in the index, and the ~60 KB it saves; the measured
gender→plural-class table justifying the visible article; that `markLearned` is
deliberately not called; and the one authorized existing-test change with its
reason.

---

## Self-Review

**Spec coverage.** §3.1 → Task 2 Step 2 and Task 4 Step 3. §3.2 → Task 1. §3.3 →
Task 4 Steps 2–3, with the pack field from Task 2 Step 1. §3.4 → Task 3 and the
no-`markLearned` comment in Task 4 Step 2. §6 → Task 4 Steps 5–6.

**One thing the spec got wrong.** It described building an exact-match-after-
normalisation helper. `exactMatch` already exists in `src/lib/matching.js` with
exactly that body and is already used by two translate exercises. The plan uses
it; nothing new is written.

**Vacuity risk, called out where it bites.** Task 1 Step 2 exists because the
`has: 'plural'` assertion passes trivially if no fixture entry has a plural —
both sides would be empty. The step forces that to be checked before the test is
trusted.

**Type consistency.** `auto.has` is a string naming a card field, read in
`resolveAutoDeck` (Task 1) and set in `autoDecks.js` (Task 2).
`grammar.pluralArticle` is `string | undefined`, written in Task 2 and read twice
in Task 4 with a `filter(Boolean)` guard for the undefined case. `TypedAnswer`'s
new props are optional strings with defaults, so the Task 4 call site and the
existing one are both valid.
