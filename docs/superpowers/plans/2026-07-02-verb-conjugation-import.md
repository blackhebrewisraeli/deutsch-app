# Verb Conjugation Import (best-effort) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop dropping verbs from the imported lexicon — extract a best-effort conjugation block (present tense, past participle, auxiliary) from Wiktextract, relax the schema so verbs ship with whatever was extractable, and keep them at the filter.

**Architecture:** Three small changes wired in order: (1) relax `validateLexiconEntry`'s verb rules; (2) extract a `verb` block in `parseWiktextract`; (3) pass it through `mapEntry` and stop dropping verbs in `filter`. Data-only — no UI change (verbs already flow through `resolveCard`).

**Tech Stack:** Node ESM (Vitest). Pipeline is `scripts/import-lexicon/`; the validator is shared `src/packs/validate.js`.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — `lint-staged` + full `npm test` (~15s–3min) per commit; no `--no-verify`; wait up to 10 min.
- **`scripts/` ESM imports use explicit `.js` extensions**; **`src/` imports use none**.
- **Relaxed `verb` block shape (exact):** `null` OR `{ aux: null|'haben'|'sein', partizip2: null|string, present: { ich, du, er, wir, ihr, sie } }` where each `present` value is `null` OR a non-empty string, and **all six keys must be present** (missing key = invalid).
- **No fabrication:** an unknown auxiliary stays `null` (never defaulted to `haben`).
- **`verb: null` when no conjugation data at all** is extracted.
- Match existing 2-space indent / quote style.

## File Structure
- Modify `src/packs/validate.js` — relax the verb block; remove "verb required for verbs".
- Modify `src/packs/validate.test.js` — update/extend verb tests.
- Modify `scripts/import-lexicon/parseWiktextract.js` — add `verbFromForms`; return `verb`.
- Modify `scripts/import-lexicon/__fixtures__/wiktextract-sample.js` — add verb fixtures.
- Modify `scripts/import-lexicon/parseWiktextract.test.js` — verb parsing tests; fix the NOUN_BROT `toEqual`.
- Modify `scripts/import-lexicon/mapEntry.js` — pass `verb` through.
- Modify `scripts/import-lexicon/mapEntry.test.js` — verb mapping test.
- Modify `scripts/import-lexicon/filter.js` — remove the verb drop.
- Modify `scripts/import-lexicon/filter.test.js` — verb now kept.

---

## Task 1: Relax the verb validator

**Files:**
- Modify: `src/packs/validate.js:99-109`
- Modify: `src/packs/validate.test.js`

**Interfaces:**
- Consumes: existing `validateLexiconEntry`, `nonEmptyStr` helper (in-file).
- Produces: `validateLexiconEntry` now accepts `verb: null` for any pos (including verbs), and validates a present verb block against the relaxed shape.

- [x] **Step 1: Update the failing tests**

In `src/packs/validate.test.js`, REPLACE the test at lines ~118-122 (`it('throws when a verb entry has no verb block', …)`) with the following, and add the sibling cases. (Keep the existing `it('accepts a valid verb entry', …)` full-block test.)

```js
  it('accepts a verb entry with a null verb block (best-effort)', () => {
    expect(
      validateLexiconEntry({ ...validNoun, id: 'v:gehen', de: 'gehen', en: ['to go'], pos: 'verb', article: null, plural: null, verb: null })
    ).toBe(true);
  });
  it('accepts a partial verb block (null aux, some present forms null)', () => {
    expect(
      validateLexiconEntry({
        ...validNoun, id: 'v:machen', de: 'machen', en: ['to make'], pos: 'verb', article: null, plural: null,
        verb: {
          aux: null,
          partizip2: 'gemacht',
          present: { ich: 'mache', du: null, er: null, wir: null, ihr: null, sie: null },
        },
      })
    ).toBe(true);
  });
  it('throws when verb.aux is not null/haben/sein', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun, pos: 'verb', article: null,
        verb: { aux: 'werden', partizip2: null, present: { ich: null, du: null, er: null, wir: null, ihr: null, sie: null } },
      })
    ).toThrow(/aux/);
  });
  it('throws when a present key is missing from the verb block', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun, pos: 'verb', article: null,
        verb: { aux: null, partizip2: null, present: { ich: 'gehe' } },
      })
    ).toThrow(/present/);
  });
```

- [x] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/packs/validate.test.js`
Expected: FAIL — the null-block and partial-block cases throw under the current strict rules; the "missing present key" message differs.

- [x] **Step 3: Relax the validator**

In `src/packs/validate.js`, replace the block at lines 99-109 with:

```js
  if (entry.verb !== null) {
    const v = entry.verb;
    if (!v || typeof v !== 'object') fail('verb must be null or an object');
    if (v.aux !== null && !['haben', 'sein'].includes(v.aux)) {
      fail('verb.aux must be null, haben, or sein');
    }
    if (v.partizip2 !== null && typeof v.partizip2 !== 'string') {
      fail('verb.partizip2 must be null or a string');
    }
    if (!v.present || typeof v.present !== 'object') fail('verb.present must be an object');
    for (const p of ['ich', 'du', 'er', 'wir', 'ihr', 'sie']) {
      if (v.present[p] !== null && !nonEmptyStr(v.present[p])) {
        fail(`verb.present.${p} must be null or a non-empty string`);
      }
    }
  }
```

(Note: the old line `if (entry.pos === 'verb' && entry.verb === null) fail('verb block is required for verbs');` is DELETED — do not keep it. A missing `present` key still fails because `v.present[p]` is `undefined`, which is `!== null` and not a non-empty string.)

- [x] **Step 4: Run to verify all pass**

Run: `npx vitest run src/packs/validate.test.js`
Expected: PASS (including the retained full-block test).

- [x] **Step 5: Commit**

```bash
git add src/packs/validate.js src/packs/validate.test.js
git commit -m "feat(packs): relax verb block validation (best-effort, nullable fields)"
```

---

## Task 2: Extract a verb block in the parser

**Files:**
- Modify: `scripts/import-lexicon/parseWiktextract.js`
- Modify: `scripts/import-lexicon/__fixtures__/wiktextract-sample.js`
- Modify: `scripts/import-lexicon/parseWiktextract.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseRecord(raw)` now returns an extra field `verb` — the relaxed block (all six `present` keys, `null` for gaps) or `null` when no conjugation data is found. Only populated for `pos === 'verb'`.

- [x] **Step 1: Add verb fixtures**

Append to `scripts/import-lexicon/__fixtures__/wiktextract-sample.js`:

```js
export const VERB_FULL = {
  word: 'gehen',
  pos: 'verb',
  lang_code: 'de',
  forms: [
    { form: 'gehe', tags: ['present', 'indicative', 'first-person', 'singular'] },
    { form: 'gehst', tags: ['present', 'indicative', 'second-person', 'singular'] },
    { form: 'geht', tags: ['present', 'indicative', 'third-person', 'singular'] },
    { form: 'gehen', tags: ['present', 'indicative', 'first-person', 'plural'] },
    { form: 'geht', tags: ['present', 'indicative', 'second-person', 'plural'] },
    { form: 'gehen', tags: ['present', 'indicative', 'third-person', 'plural'] },
    { form: 'gegangen', tags: ['participle', 'past'] },
    { form: 'sein', tags: ['auxiliary'] },
  ],
  sounds: [{ ipa: '[ˈɡeːən]' }],
  senses: [{ glosses: ['to go'], examples: [{ text: 'Wir gehen.', english: 'We go.' }] }],
};

export const VERB_PARTIAL = {
  word: 'machen',
  pos: 'verb',
  lang_code: 'de',
  forms: [
    { form: 'mache', tags: ['present', 'indicative', 'first-person', 'singular'] },
    { form: 'gemacht', tags: ['participle', 'past'] },
  ],
  sounds: [],
  senses: [{ glosses: ['to make'] }],
};

export const VERB_NO_FORMS = {
  word: 'testen',
  pos: 'verb',
  lang_code: 'de',
  forms: [],
  sounds: [],
  senses: [{ glosses: ['to test'] }],
};
```

- [x] **Step 2: Write the failing tests + fix the noun assertion**

In `scripts/import-lexicon/parseWiktextract.test.js`:

First, update the import line to include the new fixtures:

```js
import {
  NOUN_BROT,
  VERB_GEHEN,
  NON_GERMAN,
  NO_GLOSS,
  VERB_FULL,
  VERB_PARTIAL,
  VERB_NO_FORMS,
} from './__fixtures__/wiktextract-sample.js';
```

(If a `NOUN_WITH_DUPLICATE_GLOSSES` fixture is also imported there, keep it.)

Second, the NOUN_BROT test uses `toEqual` on the whole object — add `verb: null` to its expected object so it still matches:

```js
    expect(parseRecord(NOUN_BROT)).toEqual({
      lemma: 'Brot',
      pos: 'noun',
      article: 'das',
      plural: 'Brote',
      ipa: '[bʁoːt]',
      glosses: ['bread'],
      topics: ['food'],
      rawExamples: [{ de: 'Ich esse Brot.', en: 'I eat bread.' }],
      verb: null,
    });
```

Third, add a new describe block for verb extraction:

```js
describe('parseRecord — verb conjugation', () => {
  it('extracts a full present table, partizip2, and aux', () => {
    expect(parseRecord(VERB_FULL).verb).toEqual({
      aux: 'sein',
      partizip2: 'gegangen',
      present: { ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen' },
    });
  });
  it('extracts a partial block with null for missing fields', () => {
    expect(parseRecord(VERB_PARTIAL).verb).toEqual({
      aux: null,
      partizip2: 'gemacht',
      present: { ich: 'mache', du: null, er: null, wir: null, ihr: null, sie: null },
    });
  });
  it('returns verb: null when there is no conjugation data', () => {
    expect(parseRecord(VERB_NO_FORMS).verb).toBe(null);
  });
  it('leaves verb null for non-verbs', () => {
    expect(parseRecord(NOUN_BROT).verb).toBe(null);
  });
});
```

- [x] **Step 3: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/parseWiktextract.test.js`
Expected: FAIL — `parseRecord(...).verb` is `undefined` (field doesn't exist yet); NOUN_BROT `toEqual` now expects `verb: null`.

- [x] **Step 4: Implement `verbFromForms` + return `verb`**

In `scripts/import-lexicon/parseWiktextract.js`, add near the other helpers (after `firstIpa`):

```js
const PERSON_SLOT = {
  'first-person|singular': 'ich',
  'second-person|singular': 'du',
  'third-person|singular': 'er',
  'first-person|plural': 'wir',
  'second-person|plural': 'ihr',
  'third-person|plural': 'sie',
};

function verbFromForms(forms) {
  const present = { ich: null, du: null, er: null, wir: null, ihr: null, sie: null };
  let partizip2 = null;
  let aux = null;
  let found = false;

  for (const f of forms || []) {
    if (!f.form) continue;
    const tags = f.tags || [];
    const has = (t) => tags.includes(t);

    if (has('present') && has('indicative')) {
      const person = ['first-person', 'second-person', 'third-person'].find((p) => has(p));
      const number = ['singular', 'plural'].find((n) => has(n));
      const slot = person && number ? PERSON_SLOT[`${person}|${number}`] : null;
      if (slot && present[slot] === null) {
        present[slot] = f.form;
        found = true;
      }
    }
    if (partizip2 === null && has('participle') && (has('past') || has('perfect'))) {
      partizip2 = f.form;
      found = true;
    }
    if (aux === null && has('auxiliary') && ['haben', 'sein'].includes(f.form)) {
      aux = f.form;
      found = true;
    }
  }

  return found ? { aux, partizip2, present } : null;
}
```

Then, in the `return { … }` of `parseRecord`, add the `verb` field (after `rawExamples`):

```js
    verb: pos === 'verb' ? verbFromForms(raw.forms) : null,
```

- [x] **Step 5: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/parseWiktextract.test.js`
Expected: PASS (verb cases + updated NOUN_BROT).

- [x] **Step 6: Commit**

```bash
git add scripts/import-lexicon/parseWiktextract.js scripts/import-lexicon/parseWiktextract.test.js scripts/import-lexicon/__fixtures__/wiktextract-sample.js
git commit -m "feat(import): extract best-effort verb conjugation from Wiktextract forms"
```

---

## Task 3: Pass verb through mapEntry; keep verbs at the filter

**Files:**
- Modify: `scripts/import-lexicon/mapEntry.js`
- Modify: `scripts/import-lexicon/mapEntry.test.js`
- Modify: `scripts/import-lexicon/filter.js:13-18`
- Modify: `scripts/import-lexicon/filter.test.js`

**Interfaces:**
- Consumes: the parser's `verb` block (Task 2); the relaxed validator (Task 1).
- Produces: `mapEntry(word)` sets `verb: word.verb ?? null`; `keepEntry` no longer drops verbs.

- [x] **Step 1: Write the failing mapEntry test**

In `scripts/import-lexicon/mapEntry.test.js`, add a verb case (the existing noun test stays). `validateLexiconEntry` is already imported there.

```js
it('passes a verb conjugation block through and stays valid', () => {
  const verbWord = {
    id: 'v:gehen', lemma: 'gehen', pos: 'verb', article: null, plural: null,
    ipa: '[ˈɡeːən]', glosses: ['to go'], topics: [], freqRank: 12, cefr: 'A1',
    examples: [{ de: 'Wir gehen.', en: 'We go.', source: 'tatoeba' }],
    verb: { aux: 'sein', partizip2: 'gegangen', present: { ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen' } },
  };
  const entry = mapEntry(verbWord);
  expect(entry.verb).toEqual(verbWord.verb);
  expect(entry.pos).toBe('verb');
  expect(validateLexiconEntry(entry)).toBe(true);
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/mapEntry.test.js`
Expected: FAIL — `entry.verb` is `null` (mapEntry hardcodes it).

- [x] **Step 3: Pass verb through in mapEntry**

In `scripts/import-lexicon/mapEntry.js`, change the `verb` line from `verb: null,` to:

```js
    verb: word.verb ?? null,
```

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/mapEntry.test.js`
Expected: PASS (noun test still passes — a noun word has no `verb`, so `?? null` yields `null`).

- [x] **Step 5: Write the failing filter test**

In `scripts/import-lexicon/filter.test.js`, REPLACE the test `it('drops a verb without a verb block', …)` (around line 26) with:

```js
  it('keeps a verb even without a verb block (best-effort)', () => {
    expect(keepEntry({ ...base, pos: 'verb', article: null, verb: null }).keep).toBe(true);
  });
```

- [x] **Step 6: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/filter.test.js`
Expected: FAIL — `keepEntry` currently returns `{ keep: false, reason: 'verb missing verb block' }`.

- [x] **Step 7: Remove the verb drop in filter**

In `scripts/import-lexicon/filter.js`, delete this line from `keepEntry` (line ~15):

```js
  if (entry.pos === 'verb' && entry.verb === null) return { keep: false, reason: 'verb missing verb block' };
```

`keepEntry` now reads:

```js
export function keepEntry(entry) {
  if (entry.pos === 'noun' && !entry.article) return { keep: false, reason: 'noun missing article' };
  if (!entry.examples || entry.examples.length === 0) return { keep: false, reason: 'no example' };
  return { keep: true, reason: null };
}
```

- [x] **Step 8: Run the focused tests + full suite**

Run: `npx vitest run scripts/import-lexicon/mapEntry.test.js scripts/import-lexicon/filter.test.js`
Expected: PASS.
Run: `npm test`
Expected: PASS (all files).

- [x] **Step 9: Commit**

```bash
git add scripts/import-lexicon/mapEntry.js scripts/import-lexicon/mapEntry.test.js scripts/import-lexicon/filter.js scripts/import-lexicon/filter.test.js
git commit -m "feat(import): ship verbs — pass conjugation through mapEntry, stop dropping at filter"
```

---

## Self-Review

**Spec coverage:**
- §1 relaxed schema → Task 1 (validator) + enforced shape in Tasks 2/3 data.
- §2 validator changes → Task 1.
- §3 filter change → Task 3 (Steps 5-7).
- §4 parser extraction → Task 2.
- §5 mapEntry passthrough → Task 3 (Steps 1-3).
- §6 testing → parser (Task 2), validator (Task 1), mapEntry (Task 3), filter (Task 3).
- §7 UI deferred → no task (correct).
- §8 no aux default → `verbFromForms` leaves `aux: null` (Task 2); validator allows null aux (Task 1).

**Placeholder scan:** No TBD/TODO; every step has complete code. The Wiktextract verb-tag paths are the documented confirm-locally seam (same as noun genders), fixture-driven here.

**Type consistency:** The relaxed `verb` shape (`aux: null|'haben'|'sein'`, `partizip2: null|string`, `present` with six null|string keys) is identical across the validator (Task 1), the parser output (Task 2), and the mapEntry/test data (Task 3). `verbFromForms` returns exactly that shape or `null`. The `present` object always carries all six keys.

## Notes / risks for the implementer
- The only `toEqual`-on-whole-object assertion affected is NOUN_BROT in the parser test — Task 2 Step 2 updates it. All other affected tests use field-level asserts.
- `npm test` runs the whole suite (~15s–3min) per commit via the pre-commit hook.
- Verb-form tag strings are best-known guesses; a real-dump mismatch degrades to `verb: null` (safe), never a crash.
