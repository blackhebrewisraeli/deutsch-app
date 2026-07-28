# LanguagePack Phase 0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the `LanguagePack` interface and load the existing German content through it, so the engine assumes nothing about the language — with the app behaving identically.

**Architecture:** A module singleton (`src/packs/index.js` → `activePack`) assembles a German `LanguagePack` from today's `src/data/content.js`. The 8 sites that import content directly switch to reading `activePack.content`. A new language-agnostic `src/lib/matching.js` owns exact/fuzzy answer-checking, applying the pack's `normalize`. Additive-first: build new modules (no consumers) before repointing imports, then route the two matching call sites last.

**Tech Stack:** React + Vite, Vitest (`globals: false` — import test fns explicitly), jsdom. Pre-commit hook runs the full suite (212 tests) — keep it green at every commit.

**Spec:** `docs/superpowers/specs/2026-06-09-languagepack-contract-design.md`

---

## File Structure

| File | Responsibility | New? |
|------|----------------|------|
| `src/lib/matching.js` | Language-agnostic `exactMatch` / `fuzzyMatch` over a pack-supplied `normalize` | Create |
| `src/lib/matching.test.js` | Unit tests for matching | Create |
| `src/packs/validate.js` | `validateLanguagePack(pack)` shape checker | Create |
| `src/packs/validate.test.js` | Unit tests for the checker | Create |
| `src/packs/de/index.js` | The German `LanguagePack`, assembled from `content.js` | Create |
| `src/packs/index.js` | Pack registry → exports `activePack` (German) | Create |
| `src/packs/packs.test.js` | Asserts `activePack` satisfies the contract + wiring | Create |
| `src/App.jsx` | Repoint `PRESET_DECKS` import | Modify |
| `src/components/ChatTab.jsx` | Repoint `SCENARIOS`, `CHAT_TASKS` | Modify |
| `src/components/AlphabetTab.jsx` | Repoint `ALPHABET`, `ALPHABET_QUIZ_GROUPS` | Modify |
| `src/components/VocabTab.jsx` | Repoint `PRESET_DECKS` + route typed answer through `fuzzyMatch` | Modify |
| `src/components/TranslateTab.jsx` | Repoint `TRANSLATE_SENTENCES_*` | Modify |
| `src/components/chat/ScenarioPicker.jsx` | Repoint `SCENARIOS` | Modify |
| `src/components/stats/VocabSrsWidget.jsx` | Repoint `PRESET_DECKS` | Modify |
| `src/lib/gamification.js` | Repoint `PRESET_DECKS` | Modify |
| `src/components/translate/TileExercise.jsx` | Route tile check through `exactMatch` | Modify |

`src/data/content.js` is **not** modified — `packs/de` wraps it (physically moving it is Phase 1).

---

## Task 1: Engine matching module

**Files:**
- Create: `src/lib/matching.js`
- Test: `src/lib/matching.test.js`

- [x] **Step 1: Write the failing test**

Create `src/lib/matching.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { exactMatch, fuzzyMatch } from './matching';

const norm = (s) => s.trim().toLowerCase();

describe('exactMatch', () => {
  it('is true for equal strings after normalize', () => {
    expect(exactMatch('Die Katze ist groß.', '  die katze ist groß.  ', norm)).toBe(true);
  });
  it('is false when content differs', () => {
    expect(exactMatch('Er isst Brot.', 'Er trinkt Brot.', norm)).toBe(false);
  });
});

describe('fuzzyMatch', () => {
  it('reports distance 0 and ok for an exact (normalized) match', () => {
    expect(fuzzyMatch('apple', 'APPLE', norm)).toEqual({ ok: true, distance: 0 });
  });
  it('reports the edit distance for near matches', () => {
    expect(fuzzyMatch('apple', 'aple', norm)).toEqual({ ok: true, distance: 1 });
  });
  it('is not ok past maxDistance', () => {
    const res = fuzzyMatch('apple', 'orange', norm, 2);
    expect(res.ok).toBe(false);
    expect(res.distance).toBeGreaterThan(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/matching.test.js`
Expected: FAIL — `Failed to resolve import "./matching"`.

- [x] **Step 3: Write minimal implementation**

Create `src/lib/matching.js`:

```js
// Language-agnostic answer matching. The pack supplies `normalize`;
// the matching algorithms here know nothing about any specific language.
import { levenshtein } from './utils';

/**
 * Exact equality after normalization.
 * @param {string} expected
 * @param {string} given
 * @param {(s: string) => string} normalize
 * @returns {boolean}
 */
export function exactMatch(expected, given, normalize) {
  return normalize(expected) === normalize(given);
}

/**
 * Fuzzy match via Levenshtein distance on normalized strings.
 * @param {string} expected
 * @param {string} given
 * @param {(s: string) => string} normalize
 * @param {number} [maxDistance=2]
 * @returns {{ ok: boolean, distance: number }}
 */
export function fuzzyMatch(expected, given, normalize, maxDistance = 2) {
  const distance = levenshtein(normalize(expected), normalize(given));
  return { ok: distance <= maxDistance, distance };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/matching.test.js`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/matching.js src/lib/matching.test.js
git commit -m "feat(engine): add language-agnostic matching module"
```

---

## Task 2: LanguagePack validator

**Files:**
- Create: `src/packs/validate.js`
- Test: `src/packs/validate.test.js`

- [x] **Step 1: Write the failing test**

Create `src/packs/validate.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateLanguagePack } from './validate';

const validPack = {
  meta: {
    id: 'xx', name: 'X', nativeName: 'X', locale: 'xx-XX',
    direction: 'ltr', flag: '🏳', themeId: 'xx', cefrLevels: ['A1'],
  },
  content: {
    alphabet: [], alphabetQuiz: [], decks: {}, scenarios: [],
    chatTasks: {}, translateSentences: { A1: [] },
  },
  validation: { normalize: (s) => s },
  grammar: {}, prompts: {},
};

describe('validateLanguagePack', () => {
  it('returns true for a well-formed pack', () => {
    expect(validateLanguagePack(validPack)).toBe(true);
  });
  it('throws when validation.normalize is missing', () => {
    expect(() => validateLanguagePack({ ...validPack, validation: {} })).toThrow(/normalize/);
  });
  it('throws when a declared cefrLevel has no sentence bank', () => {
    expect(() =>
      validateLanguagePack({ ...validPack, content: { ...validPack.content, translateSentences: {} } })
    ).toThrow(/translateSentences/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/packs/validate.test.js`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [x] **Step 3: Write minimal implementation**

Create `src/packs/validate.js`:

```js
/**
 * Asserts a value satisfies the LanguagePack contract shape.
 * Throws an Error describing the first violation; returns true on success.
 * @param {object} pack
 * @returns {true}
 */
export function validateLanguagePack(pack) {
  const fail = (msg) => {
    throw new Error(`Invalid LanguagePack: ${msg}`);
  };
  if (!pack || typeof pack !== 'object') fail('pack must be an object');

  const m = pack.meta;
  if (!m || typeof m !== 'object') fail('meta is required');
  for (const k of ['id', 'name', 'nativeName', 'locale', 'direction', 'themeId']) {
    if (typeof m[k] !== 'string') fail(`meta.${k} must be a string`);
  }
  if (!Array.isArray(m.cefrLevels)) fail('meta.cefrLevels must be an array');

  const c = pack.content;
  if (!c || typeof c !== 'object') fail('content is required');
  for (const k of ['alphabet', 'alphabetQuiz', 'scenarios']) {
    if (!Array.isArray(c[k])) fail(`content.${k} must be an array`);
  }
  for (const k of ['decks', 'chatTasks', 'translateSentences']) {
    if (!c[k] || typeof c[k] !== 'object') fail(`content.${k} must be an object`);
  }
  for (const lvl of m.cefrLevels) {
    if (!Array.isArray(c.translateSentences[lvl])) {
      fail(`content.translateSentences.${lvl} must be an array`);
    }
  }

  if (!pack.validation || typeof pack.validation.normalize !== 'function') {
    fail('validation.normalize must be a function');
  }
  return true;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/packs/validate.test.js`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/packs/validate.js src/packs/validate.test.js
git commit -m "feat(packs): add validateLanguagePack shape checker"
```

---

## Task 3: German pack + registry

**Files:**
- Create: `src/packs/de/index.js`, `src/packs/index.js`
- Test: `src/packs/packs.test.js`

- [x] **Step 1: Write the failing test**

Create `src/packs/packs.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { activePack, getPack } from './index';
import { validateLanguagePack } from './validate';
import {
  ALPHABET,
  PRESET_DECKS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  ALPHABET_QUIZ_GROUPS,
} from '../data/content';

describe('activePack', () => {
  it('satisfies the LanguagePack contract', () => {
    expect(validateLanguagePack(activePack)).toBe(true);
  });
  it('is German', () => {
    expect(activePack.meta.id).toBe('de');
    expect(activePack.meta.locale).toBe('de-DE');
    expect(activePack.meta.cefrLevels).toEqual(['A1', 'A2', 'B1']);
  });
  it('wires content straight from content.js (same references)', () => {
    expect(activePack.content.alphabet).toBe(ALPHABET);
    expect(activePack.content.decks).toBe(PRESET_DECKS);
    expect(activePack.content.scenarios).toBe(SCENARIOS);
    expect(activePack.content.chatTasks).toBe(CHAT_TASKS);
    expect(activePack.content.alphabetQuiz).toBe(ALPHABET_QUIZ_GROUPS);
    expect(activePack.content.translateSentences.A1).toBe(TRANSLATE_SENTENCES_A1);
  });
  it('ships a Phase-0 normalize equal to trim+lowercase', () => {
    expect(activePack.validation.normalize('  Groß  ')).toBe('groß');
  });
  it('is resolvable by id via getPack', () => {
    expect(getPack('de')).toBe(activePack);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/packs/packs.test.js`
Expected: FAIL — `Failed to resolve import "./index"`.

- [x] **Step 3a: Write the German pack**

Create `src/packs/de/index.js`:

```js
// German LanguagePack. Phase 0: wires content straight from the existing
// content.js. validation/grammar/prompts are declared per the contract and
// populated in Phase 1.
import {
  ALPHABET,
  ALPHABET_QUIZ_GROUPS,
  PRESET_DECKS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../data/content';

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
  content: {
    alphabet: ALPHABET,
    alphabetQuiz: ALPHABET_QUIZ_GROUPS,
    decks: PRESET_DECKS,
    scenarios: SCENARIOS,
    chatTasks: CHAT_TASKS,
    translateSentences: {
      A1: TRANSLATE_SENTENCES_A1,
      A2: TRANSLATE_SENTENCES_A2,
      B1: TRANSLATE_SENTENCES_B1,
    },
  },
  // Phase 0: reproduces today's behavior (trim + lowercase). Phase 1 adds the
  // real ß/ä/ö/ü diacritic policy.
  validation: {
    normalize: (s) => s.trim().toLowerCase(),
    // accepts is optional; engine default = normalize-then-equals.
  },
  grammar: {}, // Phase 1
  prompts: {}, // Phase 1
};
```

- [x] **Step 3b: Write the registry**

Create `src/packs/index.js`:

```js
// Pack registry. Phase 0: German only. The active pack is a module singleton;
// a Context/hook can wrap it in Phase 4 when the language picker arrives.
import { dePack } from './de';

const PACKS = { de: dePack };

/** @param {string} id @returns {object|undefined} */
export function getPack(id) {
  return PACKS[id];
}

/** The active language pack. */
export const activePack = dePack;
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/packs/packs.test.js`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/packs/de/index.js src/packs/index.js src/packs/packs.test.js
git commit -m "feat(packs): add German LanguagePack + registry (activePack)"
```

---

## Task 4: Repoint the 8 content import sites

Each site swaps `import … from '…/data/content'` for a destructure off `activePack.content`, preserving the existing local names so the rest of each file is untouched. After all 8, the full suite must stay green.

- [x] **Step 1: `src/lib/gamification.js`**

Replace line 6:
```js
import { PRESET_DECKS } from '../data/content';
```
with:
```js
import { activePack } from '../packs';
const { decks: PRESET_DECKS } = activePack.content;
```

- [x] **Step 2: `src/App.jsx`**

Replace line 18:
```js
import { PRESET_DECKS } from './data/content';
```
with:
```js
import { activePack } from './packs';
const { decks: PRESET_DECKS } = activePack.content;
```

- [x] **Step 3: `src/components/ChatTab.jsx`**

Replace line 5:
```js
import { SCENARIOS, CHAT_TASKS } from '../data/content';
```
with:
```js
import { activePack } from '../packs';
const { scenarios: SCENARIOS, chatTasks: CHAT_TASKS } = activePack.content;
```

- [x] **Step 4: `src/components/AlphabetTab.jsx`**

Replace line 15:
```js
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from '../data/content';
```
with:
```js
import { activePack } from '../packs';
const { alphabet: ALPHABET, alphabetQuiz: ALPHABET_QUIZ_GROUPS } = activePack.content;
```

- [x] **Step 5: `src/components/VocabTab.jsx`**

Replace line 16:
```js
import { PRESET_DECKS } from '../data/content';
```
with:
```js
import { activePack } from '../packs';
const { decks: PRESET_DECKS } = activePack.content;
```
(Keep this `activePack` import — Task 5 reuses it for matching.)

- [x] **Step 6: `src/components/TranslateTab.jsx`**

Replace lines 4–8:
```js
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../data/content';
```
with:
```js
import { activePack } from '../packs';
const {
  A1: TRANSLATE_SENTENCES_A1,
  A2: TRANSLATE_SENTENCES_A2,
  B1: TRANSLATE_SENTENCES_B1,
} = activePack.content.translateSentences;
```

- [x] **Step 7: `src/components/chat/ScenarioPicker.jsx`**

Replace line 2:
```js
import { SCENARIOS } from '../../data/content';
```
with:
```js
import { activePack } from '../../packs';
const { scenarios: SCENARIOS } = activePack.content;
```

- [x] **Step 8: `src/components/stats/VocabSrsWidget.jsx`**

Replace line 12:
```js
import { PRESET_DECKS } from '../../data/content';
```
with:
```js
import { activePack } from '../../packs';
const { decks: PRESET_DECKS } = activePack.content;
```

- [x] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — `Test Files 25 passed (25)`, `Tests 225 passed (225)` (212 prior + 13 new from Tasks 1–3). No regressions: the data behind every name is identical (same references).

- [x] **Step 10: Commit**

```bash
git add src/App.jsx src/lib/gamification.js src/components/ChatTab.jsx src/components/AlphabetTab.jsx src/components/VocabTab.jsx src/components/TranslateTab.jsx src/components/chat/ScenarioPicker.jsx src/components/stats/VocabSrsWidget.jsx
git commit -m "refactor: load content through activePack (repoint 8 import sites)"
```

---

## Task 5: Route the two matching call sites through `matching.js`

Behavior-preserving: `normalize` (trim+lowercase) reproduces current outcomes for the curated data.

**Files:**
- Modify: `src/components/VocabTab.jsx`, `src/components/translate/TileExercise.jsx`

- [x] **Step 1: `VocabTab.jsx` — swap the import**

VocabTab line 18 currently:
```js
import { shuffle, levenshtein } from '../lib/utils';
```
Change to (drop `levenshtein`, add `fuzzyMatch`):
```js
import { shuffle } from '../lib/utils';
import { fuzzyMatch } from '../lib/matching';
```
(`activePack` is already imported from Task 4 Step 5.)

- [x] **Step 2: `VocabTab.jsx` — route the typed answer (line 132)**

Replace:
```js
    const dist = levenshtein(typedAnswer.trim(), card.en);
```
with:
```js
    const { distance: dist } = fuzzyMatch(card.en, typedAnswer, activePack.validation.normalize);
```
The next line (`const res = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';`) is unchanged.

- [x] **Step 3: `TileExercise.jsx` — add imports**

At the top of `src/components/translate/TileExercise.jsx`, add:
```js
import { activePack } from '../../packs';
import { exactMatch } from '../../lib/matching';
```

- [x] **Step 4: `TileExercise.jsx` — route the check (line 44)**

Replace:
```js
    const isCorrect = answer === correct;
```
with:
```js
    const isCorrect = exactMatch(correct, answer, activePack.validation.normalize);
```

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — `Tests 225 passed (225)`. Answer-checking outcomes unchanged.

- [x] **Step 6: Manual smoke test**

Run: `npm run dev`, then in the browser:
1. **Vocab** → type a correct English answer for a card → still graded `correct`; a 1–2 char typo → `almost`; nonsense → `wrong`.
2. **Translate (A1 tiles)** → assemble a correct sentence → `correct`; wrong order → `wrong`.
3. **Alphabet**, **Chat** (pick a scenario), **Stats** tabs render with the same German content.

Expected: behaves exactly as before.

- [x] **Step 7: Commit**

```bash
git add src/components/VocabTab.jsx src/components/translate/TileExercise.jsx
git commit -m "refactor: route answer-checking through matching.js + pack.normalize"
```

---

## Final verification

- [x] Run `npm test` → `Tests 225 passed (225)`.
- [x] Run `npm run lint` → clean.
- [x] Confirm `src/data/content.js` is unchanged (`git diff main -- src/data/content.js` is empty).
- [x] Confirm no remaining direct imports: `grep -rn "data/content" src --include=*.jsx --include=*.js | grep -v packs/de | grep -v "\.test\."` returns only `src/packs/de/index.js`.

---

## Out of scope (Phase 1+, per spec)

Do **not** do these now: populate `validation.normalize` diacritics / `grammar` / `prompts`; re-key SRS/stats off `card.de`; move `content.js` into `packs/de/`; namespace storage keys; touch `TypingExercise`/`BlankExercise`; extract theme tokens or UI strings.
