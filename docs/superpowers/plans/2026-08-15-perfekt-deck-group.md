# Perfekt Deck Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Perfekt deck group that shows a German infinitive and asks the learner to type the full perfect tense — "treffen" → "hat getroffen".

**Architecture:** `perfectLine` is extracted out of `formatVerb` so the card and the drill read the same single definition of a verb's perfect; `CardFace` conceals the whole verb block; three decks select `pos: 'verb', has: 'verb'`; grading reuses `exactMatch` against `validation.target` exactly as the plural drill does.

**Tech Stack:** React 18 + Vite 5, inline styles from `src/lib/theme.js`, Vitest + RTL with `globals: false`.

**Spec:** `docs/superpowers/specs/2026-08-15-perfekt-deck-group-design.md`

## Global Constraints

- **Inline styles only**, tokens from `src/lib/theme.js`. Never hardcode a colour.
- **Tests use `globals: false`** — import `{ describe, it, expect, vi }` from `'vitest'` in every test file.
- **Never bypass `.husky/pre-commit`**. `--no-verify` is forbidden.
- **Do not add, rename, or migrate any `localStorage` key.**
- **No existing test may change.** Every task here is additive. **If an existing
  test fails, stop** — the design is wrong, re-open the spec. (This is stricter
  than the last two plans, which each had one authorized exception. This one has
  none, and that is a deliberate check on the design.)
- **Do not re-run `npm run import:lexicon`.** Nothing here touches the artifacts.
- Open a PR against `main`; never push to `main`.

## Already exists — do not rebuild

- **`exactMatch(expected, given, rules)`** — `src/lib/matching.js`. Used by the plural drill.
- **`conceal`** on `CardFace` — added in #106, already a list.
- **`auto.has`** — added in #106, applied in `resolveAutoDeck`.
- **`TypedAnswer`'s `label`/`placeholder`** — added in #106.
- **`validation.target`** — the pack's typed-German rules.

So this feature adds one helper, one guard, three decks and a handler. The three prior PRs did the plumbing.

## File Structure

| file | change |
|---|---|
| `src/lib/verbDisplay.js` | extract `perfectLine`; `formatVerb` uses it |
| `src/lib/verbDisplay.test.js` | new cases for the helper (additive) |
| `src/components/vocab/CardFace.jsx` | `!hidden('verb')` guard on the verb block |
| `src/components/vocab/CardFace.test.jsx` | new case (additive) |
| `src/packs/lexiconSample.test.js` | new invariant: verb block ⇒ partizip2 |
| `src/packs/de/autoDecks.js` | `Perfekt` group + three decks |
| `src/components/VocabTab.jsx` | routes Perfekt decks, grades, conceals |
| `src/components/VocabTab.test.jsx` | new `describe` (additive) |

---

### Task 1: one definition of a verb's perfect

**Files:**
- Modify: `src/lib/verbDisplay.js`
- Modify: `src/lib/verbDisplay.test.js`

**Interfaces:**
- Produces: `perfectLine(verb, grammar)` → `{ label, value } | null`. Task 4 reads `.value` as the expected answer; `formatVerb` pushes the whole object as a display line.

**Why a shared helper:** the card prints "Perfekt: hat getroffen" and the drill must expect exactly that string, including the fallback when the pack does not declare the auxiliary. Two implementations would drift, and the drill would start marking correct answers wrong.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/verbDisplay.test.js` (the file already defines a German `de` grammar and a `present()` helper — reuse them):

```js
describe('perfectLine', () => {
  it('builds the full perfect from the pack auxiliary', () => {
    expect(perfectLine({ aux: 'haben', partizip2: 'getroffen', present: present() }, de)).toEqual({
      label: 'Perfekt',
      value: 'hat getroffen',
    });
  });

  it('uses the sein auxiliary when the verb takes it', () => {
    expect(perfectLine({ aux: 'sein', partizip2: 'gefolgt', present: present() }, de)).toEqual({
      label: 'Perfekt',
      value: 'ist gefolgt',
    });
  });

  it('falls back to the bare participle for an auxiliary the pack does not declare', () => {
    // The drill must expect the same string the card shows, or it marks a
    // correct answer wrong.
    expect(perfectLine({ aux: 'werden', partizip2: 'geworden', present: present() }, de)).toEqual({
      label: 'Part. II',
      value: 'geworden',
    });
  });

  it('is null when there is no participle', () => {
    expect(perfectLine({ aux: 'haben', partizip2: null, present: present() }, de)).toBeNull();
    expect(perfectLine(null, de)).toBeNull();
  });
});
```

Add `perfectLine` to the existing import at the top of the file.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/verbDisplay.test.js`
Expected: FAIL — `perfectLine is not a function`.

- [ ] **Step 3: Extract the helper**

In `src/lib/verbDisplay.js`, add above `formatVerb`:

```js
/**
 * The perfect-tense line for a verb, or null when the data cannot form one.
 *
 * Exported because the Perfekt drill grades against exactly what the card
 * would show. Two implementations of "what is this verb's perfect" would
 * drift, and the drill would start rejecting correct answers.
 *
 * @param {object|null} verb
 * @param {{ auxiliaries: Record<string,string>, labels: { perfect: string, participle: string } }} grammar
 * @returns {{ label: string, value: string }|null}
 */
export function perfectLine(verb, grammar) {
  if (!verb || typeof verb !== 'object' || !verb.partizip2) return null;
  // An auxiliary the pack does not declare yields undefined and falls to the
  // participle line. The old rule guessed the haben form for anything that
  // was not 'sein'.
  const aux3sg = grammar.auxiliaries[verb.aux];
  return aux3sg
    ? { label: grammar.labels.perfect, value: `${aux3sg} ${verb.partizip2}` }
    : { label: grammar.labels.participle, value: verb.partizip2 };
}
```

Then replace the participle branch inside `formatVerb` with a call to it:

```js
  const perfect = perfectLine(verb, grammar);
  if (perfect) lines.push(perfect);
```

(Delete the `if (verb.partizip2) { … }` block it replaces, and the comment that moved into the helper.)

- [ ] **Step 4: Run to verify**

Run: `npx vitest run src/lib/verbDisplay.test.js`

Expected: PASS, **including all eight pre-existing `formatVerb` cases unchanged** — the array shape is identical, only its construction moved. The "speaks French when handed a French grammar" case is the one that proves the helper stayed language-agnostic; if it fails, `perfectLine` has hardcoded something.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verbDisplay.js src/lib/verbDisplay.test.js
git commit -m "refactor(verbs): one definition of a verb's perfect, shared"
```

---

### Task 2: the card can hide its verb block

**Files:**
- Modify: `src/components/vocab/CardFace.jsx`
- Modify: `src/components/vocab/CardFace.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to the existing `describe` in `src/components/vocab/CardFace.test.jsx`:

```js
  it('conceals the whole verb block, not just the perfect line', () => {
    // The er-line leaks too: for a weak verb "er macht" hands over the stem of
    // "gemacht" outright, and for a strong one it hints at the vowel. Both come
    // from one formatVerb call, so there is no case for hiding only one.
    const verb = {
      ...noun,
      de: 'treffen',
      verb: { aux: 'haben', partizip2: 'getroffen', present: { er: 'trifft' } },
    };
    const { rerender } = render(<CardFace card={verb} learned={false} mobile={false} />);
    expect(screen.getByText(/trifft/)).toBeInTheDocument();
    expect(screen.getByText(/getroffen/)).toBeInTheDocument();

    rerender(<CardFace card={verb} learned={false} mobile={false} conceal={['verb']} />);
    expect(screen.queryByText(/trifft/)).not.toBeInTheDocument();
    expect(screen.queryByText(/getroffen/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/vocab/CardFace.test.jsx`
Expected: FAIL — both lines still render after `conceal`.

- [ ] **Step 3: Implement**

In `src/components/vocab/CardFace.jsx`, wrap the `formatVerb(...)` block:

```jsx
      {!hidden('verb') &&
        formatVerb(card.verb, activePack.grammar).map((line) => (
```

The closing `))}` becomes `))}` unchanged — only the opening gains the guard, so keep the JSX balanced.

- [ ] **Step 4: Run to verify, then commit**

Run: `npx vitest run src/components/vocab/CardFace.test.jsx`
Expected: PASS, existing cases untouched.

```bash
git add src/components/vocab/CardFace.jsx src/components/vocab/CardFace.test.jsx
git commit -m "feat(vocab): CardFace can conceal the verb block"
```

---

### Task 3: the decks, and the invariant they rest on

**Files:**
- Modify: `src/packs/de/autoDecks.js`
- Modify: `src/packs/lexiconSample.test.js`

- [ ] **Step 1: Pin the invariant first**

`has: 'verb'` only selects answerable cards while every verb block carries a
`partizip2`. That is true today with zero exceptions, and nothing enforces it.

In `src/packs/lexiconSample.test.js`, inside the existing
`it('every index row resolves to a present, valid entry with matching fields')`,
after the `pos` assertion:

```js
      expect(entry.pos).toBe(row.pos);
      // The Perfekt decks select on `has: 'verb'`, which is only the answerable
      // set while every verb block carries a participle. Currently 472/472.
      // If an import breaks this, fail here rather than serving a card whose
      // question has no answer.
      if (entry.verb) expect(entry.verb.partizip2, `${entry.id} has no partizip2`).toBeTruthy();
```

Run: `npx vitest run src/packs/lexiconSample.test.js`
Expected: PASS against the real artifacts.

- [ ] **Step 2: Add the group and decks**

In `src/packs/de/autoDecks.js`, line 2:

```js
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics', 'Artikel', 'Plural', 'Perfekt'];
```

Append to `AUTO_DECKS`:

```js
  // Perfekt — type the full perfect for a verb. `has: 'verb'` is the answerable
  // set (lexiconSample.test.js pins that a verb block always carries a
  // participle). 47 / 128 / 297 cards.
  //
  // A1 clears autoDecks.population.test.js's MIN_CARDS = 40 by SEVEN. An import
  // that drops a handful of A1 verbs turns that test red; the failure is real,
  // not flaky — the deck would genuinely be too thin to drill.
  {
    id: 'perfekt-a1',
    name: 'A1 Verbs',
    icon: '🟢',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb' },
  },
  {
    id: 'perfekt-a2',
    name: 'A2 Verbs',
    icon: '🔵',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'A2', pos: 'verb', has: 'verb' },
  },
  {
    id: 'perfekt-b1',
    name: 'B1 Verbs',
    icon: '🟣',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'B1', pos: 'verb', has: 'verb' },
  },
```

Names are "A1 Verbs" etc. — distinct from "A1", "A1 Nouns" and "A1 Plurals". The
name-uniqueness guard added in #106 enforces this.

- [ ] **Step 3: Verify the deck guards, unchanged**

Run: `npx vitest run src/packs/de/ src/packs/lexiconSample.test.js`

Expected: PASS with **`autoDecks.test.js` and `autoDecks.population.test.js`
unedited**. The population test honours `has` since #106, so it should report
the post-filter counts. Confirm them:

```bash
node -e "
const fs=require('fs');const d='public/lexicon/de';
const e={};for(const f of fs.readdirSync(d).filter(f=>/^chunk-\d+\.json$/.test(f)))Object.assign(e,JSON.parse(fs.readFileSync(d+'/'+f,'utf8')));
const idx=require('./public/lexicon/de/index.json');
for(const l of ['A1','A2','B1'])
  console.log(l, idx.filter(r=>r.cefr===l&&r.pos==='verb'&&e[r.id]?.verb).length);
"
```

Expected: `A1 47`, `A2 128`, `B1 297`.

- [ ] **Step 4: Commit**

```bash
git add src/packs/de/autoDecks.js src/packs/lexiconSample.test.js
git commit -m "feat(pack): the Perfekt deck group"
```

---

### Task 4: wire the drill, verify, open the PR

**Files:**
- Modify: `src/components/VocabTab.jsx`
- Modify: `src/components/VocabTab.test.jsx` (additive)

- [ ] **Step 1: Route, grade and render**

Import the helper:

```js
import { perfectLine } from '../lib/verbDisplay';
```

Beside `isPlural`:

```js
  const isPerfekt = AUTO_DECKS.some((d) => d.id === deckId && d.group === 'Perfekt');
```

Extend the two gates so the meaning exercises stay out of the way — note there
are now three drills to exclude:

```js
  const isDrill = isArtikel || isPlural || isPerfekt;
  const showChoices = !isDrill && isBeginner && activeDeck.length >= 4;
  const showTyped = !isDrill && (level === 'b1' || (isBeginner && activeDeck.length < 4));
```

Handler, beside `submitPlural`:

```js
  const submitPerfekt = () => {
    if (!typedAnswer.trim() || !card || clickLockRef.current) return;
    // The same string the card would print — see perfectLine's comment. Exact
    // after the pack's target rules, not fuzzy: a perfect differing by one
    // letter is a different word, and the auxiliary is part of the answer.
    const expected = perfectLine(card.verb, activePack.grammar)?.value ?? '';
    const verdict = expected && exactMatch(expected, typedAnswer, activePack.validation.target)
      ? 'correct'
      : 'wrong';
    setAnswered(true);
    setResult(verdict);
    recordEvent('vocab', level, verdict);
    recordItem('vocab', deckId, card.id, expected, verdict);
  };
```

Render, beside the plural block:

```jsx
              {isPerfekt && !answered && (
                <TypedAnswer
                  value={typedAnswer}
                  onChange={setTypedAnswer}
                  onSubmit={submitPerfekt}
                  label="Type the perfect"
                  placeholder="hat / ist …"
                />
              )}
```

Conceal, extending the existing prop:

```jsx
                conceal={isPlural ? ['plural'] : isPerfekt ? ['verb'] : undefined}
```

And the verdict answer:

```jsx
                  answer={
                    isArtikel
                      ? card.de
                      : isPlural
                        ? [activePack.grammar.pluralArticle, card.plural].filter(Boolean).join(' ')
                        : isPerfekt
                          ? (perfectLine(card.verb, activePack.grammar)?.value ?? card.de)
                          : card.en
                  }
```

**Note the placeholder is a literal "hat / ist …".** That is German in a
component, which Category C settled as acceptable (the German flavour is the
brand) — but if it feels wrong, derive it from
`Object.values(grammar.auxiliaries).join(' / ')` instead. Pick one and say which
in the PR.

- [ ] **Step 2: Add regression tests (additive)**

Append a `describe` to `VocabTab.test.jsx` mirroring the plural block. The
fixture has **six entries and zero verbs** (verified), so one must be added to
`src/packs/__fixtures__/lexicon/chunk-00.json` and to the fixture `index.json`.

**The new entry's rank and tags are constrained by existing assertions.**
`lexiconStore.test.js` pins exact id lists:

| deck rule | asserted result |
|---|---|
| `{ by: 'freq', range: [1, 200] }` | `['n:haus', 'n:wasser', 'n:brot']` |
| `{ by: 'top', count: 3 }` | `['n:haus', 'n:wasser', 'n:brot']` |
| `{ by: 'cefr', level: 'A2' }` | `['n:arbeit', 'n:bahnhof']` |
| `{ by: 'tag', tag: 'food' }` | `['n:wasser', 'n:brot']` |

Existing ranks are 60, 88, 142, 300, 1200, 1500. So the verb must have a rank
**above 200 and outside the lowest three** — use `rank: 900` — must **not** be
tagged `food`, and must **not** be `cefr: 'A2'`. `cefr: 'A1'` with `tags: []` is
safe: no assertion lists A1 exhaustively, and the `pos: 'noun'` filter keeps it
out of the Artikel and Plural decks.

Suggested entry:

```json
"v:treffen": {
  "id": "v:treffen", "de": "treffen", "en": ["to meet"], "pos": "verb",
  "article": null, "ipa": null, "plural": null, "cefr": "A1",
  "freqRank": 900, "tags": [], "examples": [],
  "verb": { "aux": "haben", "partizip2": "getroffen",
            "present": { "ich": "treffe", "du": "triffst", "er": "trifft",
                         "wir": "treffen", "ihr": "trefft", "sie": "treffen" } },
  "source": { "dict": "authored", "license": "MIT" }
}
```

with the index row `{ "id": "v:treffen", "rank": 900, "cefr": "A1", "pos": "verb", "tags": [], "chunk": 0 }`
placed so that **chunk order still matches index order** — `lexiconSample`-style
packing is positional, and `lexiconStore.test.js` has a stale-chunk suite that
depends on the fixture's shape. Append it at the end of the chunk-0 entries and
as the last chunk-0 row in the index.

Run the pack tests immediately after editing the fixture, before writing the
component test, so a fixture mistake surfaces on its own.

Cover: the card shows the infinitive and **neither** verb line; the correct full
perfect grades correct without `markLearned`; the bare participle ("getroffen")
grades **wrong**; the verdict echoes "hat getroffen".

- [ ] **Step 3: Verify**

Run: `npx vitest run`, `npm run lint`, `npm run format:check`.

**No existing test may have changed.** Confirm with:

```bash
git diff --stat src/components/VocabTab.test.jsx src/lib/verbDisplay.test.js src/components/vocab/CardFace.test.jsx
```

Every one should show insertions only.

**Prove the concealment is load-bearing**: drop `['verb']` from the `conceal`
prop and confirm the "neither verb line" test fails; restore and confirm a clean
diff.

- [ ] **Step 4: Browser**

```bash
npm run build
```

Start `prod-preview`. **Unregister any existing service worker and clear caches
before trusting the page** — this has bitten twice:

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const n of await caches.keys()) await caches.delete(n);
location.reload();
```

Then trial → A1 → Vocab → **A1 Verbs under Perfekt**. Confirm: 47 cards; the
card shows the infinitive with **no `er:` and no `Perfekt:` line**; typing the
full perfect grades correct with no LEARNED badge; typing the bare participle
grades wrong and the panel answers with the full form. Check the console.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "feat(vocab): drill the perfect tense in the Perfekt decks"
git push -u origin feat/perfekt-deck-group
gh pr create --base main --title "feat(vocab): Perfekt deck group — drill the German perfect"
```

Non-draft, targeting `main`. In the body: the 32%-strong / 8%-sein measurements
and why an auxiliary-only drill was rejected; that `perfectLine` is shared so the
card and drill cannot disagree; the leak checklist and that the `er:` line leaks
weak stems outright; that example sentences are an accepted risk; A1's seven
cards of headroom; and that **no existing test changed**.

---

## Self-Review

**Spec coverage.** §3.1 → Task 2 and Task 4 Step 1's `conceal`. §3.2 → Task 3
Step 2. §3.3 → Task 1 (shared helper) and Task 4 Step 1 (grading). §3.4 → Task 3
Step 1. §3.5 → the absent `markLearned` in Task 4 Step 1. §6 → Task 4 Steps 3–4.

**This plan has no authorized existing-test change**, unlike the last two. That
is a deliberate check: the three prior PRs built the plumbing (`conceal`,
`auto.has`, `TypedAnswer` props, the name guard), so a fourth drill that still
needed to edit an existing test would mean the plumbing was wrong. If one breaks,
that is the signal — stop.

**The one non-additive-looking change is Task 1**, which moves code out of
`formatVerb` into `perfectLine`. Its eight existing tests must pass untouched
because the returned array is identical; that is the check that the extraction
was behaviour-preserving.

**Fixture growth is the risk in Task 4 Step 2.** The lexicon fixture currently
has six nouns and no verbs, so the drill cannot be tested without adding one.
The step says to verify the existing id-list assertions in `lexiconStore.test.js`
still hold rather than assume it.

**Type consistency.** `perfectLine` returns `{label, value}|null`; `formatVerb`
pushes the object, the drill reads `.value` with `?? ''` and treats empty as
wrong. `conceal` is `string[] | undefined` throughout.
