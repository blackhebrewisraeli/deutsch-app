# Card-Identity Re-key — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the engine key SRS/stats on a language-neutral `card.id` instead of the German surface form `card.de`, with `id = card.de` so existing saved progress is untouched (zero migration).

**Architecture:** The German pack gains `cardId(card) => card.de` and tags every card with an `id`. The engine (`srs.js`, `gamification.js`) and the two vocab consumers (`VocabTab`, `VocabSrsWidget`) read `card.id` instead of `card.de`. Because `id === de`, every localStorage key is byte-identical. Additive-first: tag cards before the engine/consumers read the new field.

**Tech Stack:** React + Vite, Vitest (`globals: false` — import test fns explicitly), jsdom. Pre-commit runs the full suite (225 tests) — keep it green at every commit.

**Spec:** `docs/superpowers/specs/2026-06-09-card-identity-rekey-design.md`

---

## File Structure

| File | Change |
|------|--------|
| `src/packs/de/index.js` | add `cardId`; tag preset-deck cards with `id` |
| `src/packs/validate.js` | require `cardId` to be a function |
| `src/lib/srs.js` | read `card.id`; rename `de` params to `id`; update storage-shape comment |
| `src/lib/gamification.js` | `decksMastered` reads `card.id` |
| `src/components/VocabTab.jsx` | 10 key-usages `card.de` → `card.id`; tag custom-deck cards (keep the display `{card.de}`) |
| `src/components/stats/VocabSrsWidget.jsx` | `srsKey(deckId, card.id)` |
| `src/packs/packs.test.js`, `src/packs/validate.test.js`, `src/lib/srs.test.js`, `src/lib/gamification.test.js` | test updates + new id-keying tests |

`src/data/content.js` is **not** modified.

---

## Task 1: Pack `cardId` + tag preset decks + validator

**Files:** Modify `src/packs/de/index.js`, `src/packs/validate.js`; Test `src/packs/packs.test.js`, `src/packs/validate.test.js`.

- [x] **Step 1: Write the failing tests**

Append to `src/packs/packs.test.js` (inside the file, after the existing `describe`s):

```js
describe('cardId + tagged decks', () => {
  it('cardId returns the German surface form', () => {
    expect(activePack.cardId({ de: 'der Hund', en: 'dog' })).toBe('der Hund');
  });
  it('preset deck cards carry an id equal to de', () => {
    const card = activePack.content.decks.greetings[0];
    expect(card.id).toBe(card.de);
  });
});
```

In `src/packs/validate.test.js`, add `cardId` to the `validPack` fixture and a new test. Change the fixture's `validation` line from:

```js
  validation: { normalize: (s) => s },
  grammar: {}, prompts: {},
```
to:
```js
  validation: { normalize: (s) => s },
  cardId: (c) => c.de,
  grammar: {}, prompts: {},
```
and add this test inside the `describe('validateLanguagePack', …)` block:
```js
  it('throws when cardId is not a function', () => {
    expect(() => validateLanguagePack({ ...validPack, cardId: undefined })).toThrow(/cardId/);
  });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/packs/packs.test.js src/packs/validate.test.js`
Expected: FAIL — `activePack.cardId is not a function`; `card.id` is `undefined`; the cardId-missing test does not throw yet.

- [x] **Step 3: Implement**

In `src/packs/de/index.js`, replace the `export const dePack = {` block's opening (keep the `import` lines above it) so the file reads:

```js
// Card identity for German: the surface form is the stable id (Phase 1, sub-project 1).
const cardId = (card) => card.de;
const tagDeck = (deck) => deck.map((card) => ({ ...card, id: cardId(card) }));
const tagDecks = (decks) =>
  Object.fromEntries(Object.entries(decks).map(([id, deck]) => [id, tagDeck(deck)]));

export const dePack = {
  meta: {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    locale: 'de-DE',
    direction: 'ltr',
    flag: '🇩🇪',
    themeId: 'de',
    cefrLevels: ['A1', 'A2', 'B1'],
  },
  cardId,
  content: {
    alphabet: ALPHABET,
    alphabetQuiz: ALPHABET_QUIZ_GROUPS,
    decks: tagDecks(PRESET_DECKS),
    scenarios: SCENARIOS,
    chatTasks: CHAT_TASKS,
    translateSentences: {
      A1: TRANSLATE_SENTENCES_A1,
      A2: TRANSLATE_SENTENCES_A2,
      B1: TRANSLATE_SENTENCES_B1,
    },
  },
  validation: {
    normalize: (s) => s.trim().toLowerCase(),
  },
  grammar: {},
  prompts: {},
};
```

In `src/packs/validate.js`, replace the final check + return:
```js
  if (!pack.validation || typeof pack.validation.normalize !== 'function') {
    fail('validation.normalize must be a function');
  }
  return true;
```
with:
```js
  if (!pack.validation || typeof pack.validation.normalize !== 'function') {
    fail('validation.normalize must be a function');
  }
  if (typeof pack.cardId !== 'function') {
    fail('cardId must be a function');
  }
  return true;
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/packs/packs.test.js src/packs/validate.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/packs/de/index.js src/packs/validate.js src/packs/packs.test.js src/packs/validate.test.js
git commit -m "feat(packs): add cardId + tag German deck cards with id"
```

---

## Task 2: Engine reads `card.id` (srs.js + gamification.js)

**Files:** Modify `src/lib/srs.js`, `src/lib/gamification.js`; Test `src/lib/srs.test.js`, `src/lib/gamification.test.js`.

- [x] **Step 1: Write the failing test + update existing test decks**

In `src/lib/srs.test.js`, add `id` to the two test decks so they exercise id-keying. Change the `getDueCards` deck to:
```js
  const deck = [
    { id: 'Hallo', de: 'Hallo', en: 'Hello' },
    { id: 'Tschüss', de: 'Tschüss', en: 'Bye' },
    { id: 'Danke', de: 'Danke', en: 'Thanks' },
    { id: 'Bitte', de: 'Bitte', en: 'Please' },
  ];
```
Change the three `getDueCount` decks to include ids:
```js
    const decks = {
      greetings: [{ id: 'Hallo', de: 'Hallo' }, { id: 'Tschüss', de: 'Tschüss' }],
      food: [{ id: 'das Brot', de: 'das Brot' }, { id: 'der Käse', de: 'der Käse' }],
    };
```
```js
    const decks = { greetings: [{ id: 'Hallo', de: 'Hallo' }, { id: 'Tschüss', de: 'Tschüss' }] };
```
```js
    const decks = { greetings: [{ id: 'Hallo', de: 'Hallo' }] };
```
Then add a **discriminating** test inside `describe('getDueCount', …)`:
```js
  it('keys on card.id, not the surface form', () => {
    const deck = [{ id: 'g1', de: 'Hallo', en: 'Hello' }];
    const srs = { 'greetings:g1': { box: 5, nextDue: 999999999, lastReviewed: 0, reps: 9 } };
    // Entry exists under id 'g1', far-future → not due → 0.
    // If the engine keyed on de ('Hallo') it would find no entry and count it as new → 1.
    expect(getDueCount(srs, { greetings: deck }, 1000)).toBe(0);
  });
```

- [x] **Step 2: Run to verify the new test fails**

Run: `npx vitest run src/lib/srs.test.js`
Expected: FAIL on "keys on card.id, not the surface form" — current code reads `card.de`, so it returns `1`, not `0`. (Existing tests still pass — cards now carry `id` but the code still reads `de`.)

- [x] **Step 3: Implement the engine changes**

In `src/lib/srs.js`:
- Storage-shape comment (line ~5): change `'<deckId>:<de>'` to `'<deckId>:<id>'`.
- `srsKey`:
```js
export function srsKey(deckId, id) {
  return `${deckId}:${id}`;
}
```
- `srsApply` signature + key line:
```js
export function srsApply(srs, deckId, id, verdict, ts) {
  if (!SRS_VERDICTS.includes(verdict)) throw new Error(`Invalid verdict: ${verdict}`);

  const key = srsKey(deckId, id);
```
- `getDueCards` (the `forEach` body):
```js
    const entry = srs[srsKey(deckId, card.id)];
```
- `getDueCount` (the inner loop):
```js
      const entry = srs[srsKey(deckId, card.id)];
```
- `recordVocabAnswer`:
```js
export function recordVocabAnswer(deckId, id, verdict) {
  try {
    const state = loadState() ?? {};
    const srs = srsApply(state.srs ?? {}, deckId, id, verdict, Date.now());
    saveState({ ...state, srs });
  } catch {
    // best-effort, never throw into the React tree
  }
}
```

In `src/lib/gamification.js`, `decksMastered`:
```js
    if (deck.every((card) => srs?.[srsKey(deckId, card.id)]?.box === MASTERED_BOX)) n += 1;
```

- [x] **Step 4: Add a characterization test for decksMastered, then run**

In `src/lib/gamification.test.js`, add these imports after the existing import block:
```js
import { activePack } from '../packs';
import { srsKey, MASTERED_BOX } from './srs';
```
Add inside `describe('context derivation', …)`:
```js
  it('decksMastered counts a preset deck fully mastered by id', () => {
    const srs = {};
    for (const card of activePack.content.decks.greetings) {
      srs[srsKey('greetings', card.id)] = { box: MASTERED_BOX, nextDue: 0, lastReviewed: 0, reps: 9 };
    }
    expect(decksMastered(srs)).toBe(1);
  });
```

Run: `npx vitest run src/lib/srs.test.js src/lib/gamification.test.js`
Expected: PASS (including the discriminating test and the new characterization test).

- [x] **Step 5: Commit**

```bash
git add src/lib/srs.js src/lib/gamification.js src/lib/srs.test.js src/lib/gamification.test.js
git commit -m "refactor(engine): key SRS/decksMastered on card.id instead of card.de"
```

---

## Task 3: Components read `card.id` + tag custom decks

**Files:** Modify `src/components/VocabTab.jsx`, `src/components/stats/VocabSrsWidget.jsx`. (No unit tests for these — guarded by the full suite + manual smoke.)

- [x] **Step 1: `VocabTab.jsx` — the 10 key-usages**

Make these exact replacements (the line numbers are approximate; match on the code). **Leave the display `{card.de}` on the card face unchanged.**

| Context | From | To |
|---|---|---|
| review-target find | `activeDeck.findIndex((c) => c.de === target)` | `activeDeck.findIndex((c) => c.id === target)` |
| SRS verdict record | `recordVocabAnswer(deckId, card.de, srsVerdict)` | `recordVocabAnswer(deckId, card.id, srsVerdict)` |
| review-target find (2) | `activeDeck.findIndex((c) => c.de === reviewTarget.label)` | `activeDeck.findIndex((c) => c.id === reviewTarget.label)` |
| typed → learned | `markLearned(card.de)` | `markLearned(card.id)` |
| typed → record item | `recordItem('vocab', deckId, card.de, card.en, res)` | `recordItem('vocab', deckId, card.id, card.en, res)` |
| progress dots | `learnedWords[activeDeck[i].de]` | `learnedWords[activeDeck[i].id]` |
| deck-complete count | `activeDeck.filter((c) => learnedWords[c.de])` | `activeDeck.filter((c) => learnedWords[c.id])` |
| learned badge | `learnedWords[card.de] && (` | `learnedWords[card.id] && (` |
| MC → learned | `if (correct) markLearned(card.de)` | `if (correct) markLearned(card.id)` |
| MC → record item | `recordItem('vocab', deckId, card.de, card.en, verdict)` | `recordItem('vocab', deckId, card.id, card.en, verdict)` |

- [x] **Step 2: `VocabTab.jsx` — tag custom-deck cards**

In `generateDeck`, replace:
```js
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomCards(parsed);
        setDeckId('custom');
      }
```
with:
```js
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomCards(parsed.map((c) => ({ ...c, id: activePack.cardId(c) })));
        setDeckId('custom');
      }
```

- [x] **Step 3: `VocabSrsWidget.jsx` — read `card.id`**

Replace line ~118:
```js
            const entry = srs[srsKey(deckId, card.de)];
```
with:
```js
            const entry = srs[srsKey(deckId, card.id)];
```

- [x] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — `Tests 230 passed (230)` (225 prior + 5 new: 3 from Task 1 in packs/validate, 2 from Task 2 in srs/gamification). No regressions.

- [x] **Step 5: Manual smoke test**

Run `npm run dev`, then:
1. **Vocab (A1/A2)** — answer a card via multiple choice; the ✓ LEARNED badge and the green progress dot appear; finish a deck → "Deck complete — N words learned".
2. **Vocab (B1)** — type a meaning; correct/almost/wrong grades as before; pick Hard/Good/Easy.
3. **Generate a custom deck** — it loads and is reviewable.
4. **Stats → Vocab SRS widget** — due counts render.
5. Reload the page — previously-learned cards still show as learned (proves saved state still matches).

- [x] **Step 6: Commit**

```bash
git add src/components/VocabTab.jsx src/components/stats/VocabSrsWidget.jsx
git commit -m "refactor: vocab components key learned/SRS/review on card.id"
```

---

## Task 4: Final verification

- [x] `npm test` → all green (230, 0 failures).
- [x] `npm run lint` → clean.
- [x] `git diff origin/main -- src/data/content.js` → empty (content untouched).
- [x] No `card.de` key-usages remain: `grep -rn "\.de\b" src --include=*.jsx --include=*.js | grep -v "\.test\." | grep -E "srsKey|markLearned|recordItem\('vocab'|learnedWords\[|=== target|=== reviewTarget"` returns nothing. (The display `{card.de}`, chat `msg.de`, and translate `exercise.de` *detail* usages are expected to remain.)

---

## Out of scope (later Phase 1 cycles)

Do not touch here: `validation.normalize` diacritics, `prompts`, `grammar`, moving `content.js` into `packs/de/`, storage-key namespacing, the German rank/achievement strings in `gamification.js`, and the translate exercises (already keyed on English).
