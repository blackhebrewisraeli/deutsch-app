# Präsens Deck Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Präsens deck group that shows a German infinitive and asks for the du-form — and, in doing so, turn VocabTab's three hand-written drill branches into one descriptor table so the fourth is a row rather than a fourth copy.

**Architecture:** `auto.has` learns dotted paths so a deck can require `verb.present.du`; VocabTab's per-drill `display`/`conceal`/`expected`/`answer` logic moves into a `DRILLS` table keyed by deck group; the Präsens decks are generated from a level map.

**Tech Stack:** React 18 + Vite 5, inline styles from `src/lib/theme.js`, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-16-praesens-deck-group-design.md`

## Global Constraints

- **Inline styles only**, tokens from `src/lib/theme.js`.
- **Tests use `globals: false`** — import from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **No existing test may change.** Task 2 is a behaviour-preserving refactor of
  three shipped drills; the 34 existing `VocabTab.test.jsx` tests passing
  **untouched** is the entire proof it is behaviour-preserving. **If one fails,
  the refactor is wrong — fix the code, never the test.**
- **Do not re-run `npm run import:lexicon`.**
- Open a PR against `main`; never push to `main`.

## Already exists — do not rebuild

`exactMatch`, `conceal` (a list), `auto.has`, `TypedAnswer`'s `label`/`placeholder`,
`perfectLine`, the deck-name uniqueness guard. This feature adds a path walk, a
table, and three generated decks.

## File Structure

| file | change |
|---|---|
| `src/packs/lexiconStore.js` | `auto.has` walks dotted paths |
| `src/packs/lexiconStore.test.js` | new cases (additive) |
| `src/components/vocab/drills.js` | **new** — the `DRILLS` descriptor table |
| `src/components/vocab/drills.test.js` | **new** |
| `src/components/VocabTab.jsx` | reads the table instead of four flags and three ternaries |
| `src/packs/de/autoDecks.js` | `Präsens` group, three decks from a map |
| `src/components/VocabTab.test.jsx` | new `describe` (additive) |

---

### Task 1: `auto.has` walks dotted paths

**Files:** `src/packs/lexiconStore.js`, `src/packs/lexiconStore.test.js`

**Interfaces:** Produces `has: 'verb.present.du'` support. Task 3's decks use it.

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/lexiconStore.test.js`:

```js
describe('auto.has dotted paths', () => {
  it('walks into a nested field', async () => {
    // v:treffen is the fixture's only verb; it carries present.du = 'triffst'.
    const cards = await resolveAutoDeck(
      { auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb.present.du' } },
      grammar,
      'de'
    );
    expect(cards.map((c) => c.id)).toEqual(['v:treffen']);
  });

  it('excludes a card whose nested field is missing', async () => {
    const cards = await resolveAutoDeck(
      { auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb.present.ihr_nonexistent' } },
      grammar,
      'de'
    );
    expect(cards).toEqual([]);
  });

  it('does not throw when an intermediate segment is missing', async () => {
    // Nouns have no verb block at all — the walk must bail, not crash.
    const cards = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'verb.present.du' } },
      grammar,
      'de'
    );
    expect(cards).toEqual([]);
  });

  it('a path with no dots behaves exactly as before', async () => {
    const cards = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'plural' } },
      grammar,
      'de'
    );
    expect(cards.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL on the dotted-path cases — `c['verb.present.du']` is undefined, so every deck comes back empty (including the first, which expects one card).

- [ ] **Step 3: Implement**

In `src/packs/lexiconStore.js`, replace the filter line:

```js
  return auto.has ? cards.filter((c) => c[auto.has]) : cards;
```

with:

```js
  return auto.has ? cards.filter((c) => hasPath(c, auto.has)) : cards;
```

and add above `resolveAutoDeck`:

```js
/**
 * Truthiness of a possibly-nested field: 'plural' or 'verb.present.du'.
 * A missing intermediate bails rather than throwing — nouns have no verb block,
 * and a deck asking for one should simply exclude them.
 */
function hasPath(obj, path) {
  return path.split('.').reduce((v, key) => (v == null ? undefined : v[key]), obj) != null;
}
```

**Note the `!= null` rather than a bare truthiness check.** A field could legitimately be `0` or `''`; `has` means "this card carries the data", not "the data is truthy". The existing `has: 'plural'` and `has: 'verb'` are unaffected — both are objects or non-empty strings.

- [ ] **Step 4: Run to verify, then commit**

Run: `npx vitest run src/packs` — expected PASS, with the #106/#107 `has` tests unchanged.

```bash
git add src/packs/lexiconStore.js src/packs/lexiconStore.test.js
git commit -m "feat(lexicon): auto.has walks dotted paths"
```

---

### Task 2: three drill branches become one table

**Files:** create `src/components/vocab/drills.js` + test; modify `src/components/VocabTab.jsx`

**Why now:** VocabTab currently carries three `AUTO_DECKS.some(...)` scans, a
two-deep `conceal` ternary and a three-deep `answer` ternary. A fourth drill
makes those four, three and four. **Three instances is a pattern; four is a
table.** This is also the honest fix for the duplication SonarCloud flagged on
#107 — it removes the repetition rather than restating it.

**This task adds no behaviour.** Its success condition is that all 34 existing
`VocabTab.test.jsx` tests pass untouched.

- [ ] **Step 1: Write the table**

Create `src/components/vocab/drills.js`:

```js
import { perfectLine } from '../../lib/verbDisplay';

/**
 * One row per drill, keyed by the deck group it belongs to.
 *
 * VocabTab had a flag, a conceal branch and an answer branch per drill; at three
 * that was a pattern and at four it would have been noise. Adding a fifth drill
 * is now a row here plus a deck group in autoDecks.js.
 *
 * - `kind`      'choice' renders buttons, 'typed' renders the text input.
 * - `display`   overrides the card headword (the gender drill shows the bare lemma).
 * - `conceal`   fields CardFace must not render, because the drill asks for them.
 * - `expected`  the correct answer, graded against it.
 * - `answer`    what the verdict panel echoes back — usually richer than `expected`.
 * - `options`   choice drills only: the buttons to offer.
 * - `label` /
 *   `placeholder` typed drills only.
 */
export const DRILLS = {
  Artikel: {
    kind: 'choice',
    display: (card) => card.lemma,
    options: (grammar) => grammar.articles,
    expected: (card) => card.article,
    answer: (card) => card.de,
  },

  Plural: {
    kind: 'typed',
    conceal: ['plural'],
    label: 'Type the plural',
    placeholder: (grammar) => `${grammar.pluralArticle ?? ''} …`.trim(),
    expected: (card) => card.plural,
    answer: (card, grammar) =>
      [grammar.pluralArticle, card.plural].filter(Boolean).join(' '),
  },

  Perfekt: {
    kind: 'typed',
    conceal: ['verb'],
    label: 'Type the perfect',
    placeholder: (grammar) => `${Object.values(grammar.auxiliaries).join(' / ')} …`,
    expected: (card, grammar) => perfectLine(card.verb, grammar)?.value ?? '',
    answer: (card, grammar) => perfectLine(card.verb, grammar)?.value ?? card.de,
  },
};

/** The drill for a deck id, or null when the deck is ordinary vocabulary. */
export function drillFor(deckId, autoDecks) {
  const group = autoDecks.find((d) => d.id === deckId)?.group;
  return (group && DRILLS[group]) || null;
}
```

- [ ] **Step 2: Test the table directly**

Create `src/components/vocab/drills.test.js` covering: `drillFor` returning null
for a preset deck and the right row for each group; `Artikel.display` giving the
bare lemma; `Plural.answer` prefixing the article and `expected` not doing so;
`Perfekt.expected` falling back to the bare participle when the pack does not
declare the auxiliary; and each `placeholder` deriving from grammar rather than
being a literal.

Run: `npx vitest run src/components/vocab/drills.test.js` — expected PASS.

- [ ] **Step 3: Rewire VocabTab to the table**

Replace the three flags:

```js
  const drill = drillFor(deckId, AUTO_DECKS);
  const isDrill = drill !== null;
  const showChoices = !isDrill && isBeginner && activeDeck.length >= 4;
  const showTyped = !isDrill && (level === 'b1' || (isBeginner && activeDeck.length < 4));
```

One submit handler replaces `chooseArticle`, `submitPlural` and `submitPerfekt`:

```js
  // Every drill grades the same way: exact match against the pack's target text
  // rules. Deliberately not fuzzyMatch — a gender, plural or participle that
  // differs by one letter is a different word, not a near miss.
  const answerDrill = (given) => {
    if (!card || clickLockRef.current) return;
    const expected = drill.expected(card, activePack.grammar) ?? '';
    const verdict =
      expected && exactMatch(expected, given, activePack.validation.target) ? 'correct' : 'wrong';
    setAnswered(true);
    setResult(verdict);
    // No markLearned for any drill: learnedWords is keyed by card.id with no
    // notion of which skill was shown, and knowing a noun's gender or a verb's
    // participle is not knowing the word.
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, expected, verdict);
  };
```

**Check the Artikel path carefully.** It previously compared `article === card.article`
directly; going through `exactMatch` with the target rules is equivalent here
(both sides are plain lowercase ASCII), and the existing Artikel tests are the
proof. If they fail, keep a `kind === 'choice'` strict-equality path rather than
bending the test.

Render:

```jsx
              <CardFace
                card={card}
                display={drill?.display?.(card)}
                conceal={drill?.conceal}
                learned={!!learnedWords[card.id]}
                mobile={mobile}
              />

              {drill?.kind === 'choice' && !answered && (
                <ArticleChoice
                  articles={drill.options(activePack.grammar)}
                  onChoose={answerDrill}
                />
              )}

              {drill?.kind === 'typed' && !answered && (
                <TypedAnswer
                  value={typedAnswer}
                  onChange={setTypedAnswer}
                  onSubmit={() => typedAnswer.trim() && answerDrill(typedAnswer)}
                  label={drill.label}
                  placeholder={drill.placeholder(activePack.grammar)}
                />
              )}
```

and the verdict answer collapses to:

```jsx
                  answer={drill ? drill.answer(card, activePack.grammar) : card.en}
```

`submitTyped` and `chooseOption` (the meaning exercises) stay exactly as they are.

- [ ] **Step 4: The gate**

Run: `npx vitest run src/components/VocabTab.test.jsx`

Expected: **34 passed, file untouched.** Confirm with
`git diff --stat src/components/VocabTab.test.jsx` — it must show no change at
all for this task.

If any Artikel/Plural/Perfekt test fails, the refactor changed behaviour. Fix
`drills.js` or `VocabTab.jsx`. **Do not edit the test.**

- [ ] **Step 5: Commit**

```bash
git add src/components/vocab/drills.js src/components/vocab/drills.test.js src/components/VocabTab.jsx
git commit -m "refactor(vocab): drills are a table, not three branches"
```

---

### Task 3: the Präsens decks

**Files:** `src/packs/de/autoDecks.js`, `src/components/vocab/drills.js`

- [ ] **Step 1: Add the group and generate the triple**

`DECK_GROUPS` gains `'Präsens'`. Then, per spec §3.4:

```js
  // Präsens — type the du-form. `du` is the least derivable person (49% against
  // 73% for ich and 80% for wir/sie, which are the bare infinitive four times in
  // five), so it is the one worth asking for. 45 / 127 / 296 cards.
  //
  // Generated rather than written out three times: #107 was merged past a
  // failing duplication gate, and three near-identical objects are a large share
  // of a small PR. These are one deck at three levels and now say so.
  //
  // A1's 45 clears MIN_CARDS = 40 by FIVE, the thinnest deck in the app.
  ...['A1', 'A2', 'B1'].map((level, i) => ({
    id: `praesens-${level.toLowerCase()}`,
    name: `${level} du-Form`,
    icon: ['🟢', '🔵', '🟣'][i],
    group: 'Präsens',
    auto: { by: 'cefr', level, pos: 'verb', has: 'verb.present.du' },
  })),
```

- [ ] **Step 2: Add the drill row**

In `src/components/vocab/drills.js`:

```js
  Präsens: {
    kind: 'typed',
    // The `er:` line shares the stem change with `du` for every irregular verb
    // (er trifft → du triffst), so it hands over exactly the cards that are not
    // mechanical.
    conceal: ['verb'],
    label: 'Type the du-form',
    placeholder: 'du …',
    expected: (card) => card.verb?.present?.du ?? '',
    answer: (card) => (card.verb?.present?.du ? `du ${card.verb.present.du}` : card.de),
  },
```

**`placeholder` is a string here while the others are functions.** Make it a
function for consistency — `() => 'du …'` — or make the caller tolerate both.
Pick one and keep the table homogeneous; a table whose columns have different
shapes is the thing this task set out to remove.

- [ ] **Step 3: Verify the guards, unchanged**

Run: `npx vitest run src/packs/de/ src/components/vocab/`

`autoDecks.test.js` and `autoDecks.population.test.js` must be **unedited**. Then
confirm the counts:

```bash
node -e "
const fs=require('fs');const d='public/lexicon/de';
const e={};for(const f of fs.readdirSync(d).filter(f=>/^chunk-\d+\.json$/.test(f)))Object.assign(e,JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));
const idx=require('./public/lexicon/de/index.json');
for(const l of ['A1','A2','B1'])
  console.log(l, idx.filter(r=>r.cefr===l&&r.pos==='verb'&&e[r.id]?.verb?.present?.du).length);
"
```

Expected: `A1 45`, `A2 127`, `B1 296`.

- [ ] **Step 4: Commit**

```bash
git add src/packs/de/autoDecks.js src/components/vocab/drills.js
git commit -m "feat(pack): the Präsens deck group"
```

---

### Task 4: regression tests, browser, PR

- [ ] **Step 1: Add the Präsens suite (additive)**

Append a `describe` to `VocabTab.test.jsx` using `mockLexiconFetch`. The fixture's
`v:treffen` carries `present.du = 'triffst'`. Cover: the card shows "treffen"
and **neither verb line**; `triffst` grades correct **without** `markLearned`;
`treffst` (the regular-but-wrong form) grades **wrong**; the verdict echoes
"du triffst".

- [ ] **Step 2: Verify**

`npx vitest run`, `npm run lint`, `npm run format:check`.

**Prove the concealment**: drop `conceal: ['verb']` from the Präsens row and
confirm the "neither verb line" test fails. Restore.

**Prove the path filter**: change `has` to `'verb'` and confirm the deck count
moves from 45 to 47 in the population check. Restore.

- [ ] **Step 3: Browser**

```bash
npm run build
```

Start `prod-preview`. **Unregister the service worker and clear caches first** —
this has cost a detour three times:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
location.reload();
```

Then trial → A1 → Vocab → **A1 du-Form under Präsens**. Confirm 45 cards, no
`er:` or `Perfekt:` line, a correct du-form accepted with no LEARNED badge, a
wrong one rejected echoing "du …". **Also open one Artikel and one Plural deck**
— Task 2 rewired them, and the browser is where the last two refactors' bugs
surfaced.

- [ ] **Step 4: Commit and open the PR**

Non-draft, targeting `main`. In the body: the derivability table and why `du`;
that §5 of the spec calls this the weakest drill and why it ships anyway; the
A1=13 finding that ruled out an irregulars-only group; the table refactor and
that 34 existing tests passed untouched; and the expected Sonar outcome.

**Expect SonarCloud to be red again** and say so in the PR rather than
rediscovering it: the table removes real duplication, but this is another small
PR and the new test suite still mirrors its siblings. If it fails, report the
number and the arithmetic — do not merge silently.

---

## Self-Review

**Spec coverage.** §3.1 → Task 3 Step 1 (fixed person per deck). §3.2 → Task 1.
§3.3 → Task 2 Step 3 (`answerDrill`) and the Präsens row's `conceal`. §3.4 →
Task 3 Step 1. §7 → Task 4.

**The risky task is 2, not 3.** It refactors three shipped drills. The 34
existing tests are the whole safety net and the plan states twice that they must
not be edited. The most likely breakage is the Artikel path, which moves from
`===` to `exactMatch`; Step 3 names that explicitly and gives the fallback.

**One inconsistency deliberately surfaced.** Task 3 Step 2 writes `placeholder`
as a bare string where the other rows use functions. The step calls it out and
requires picking one — a table with ragged columns would defeat the task.

**Type consistency.** `drillFor` returns a row or `null`; every call site uses
`drill?.`. `expected`/`answer` take `(card, grammar)`; `options`/`placeholder`
take `(grammar)`. `conceal` is `string[] | undefined`, matching `CardFace`.
