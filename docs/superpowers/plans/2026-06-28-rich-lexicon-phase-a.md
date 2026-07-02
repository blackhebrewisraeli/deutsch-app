# Rich Lexicon — Phase A (Import + Runtime) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline import pipeline that turns Wiktextract/Tatoeba/Leipzig data into chunked static lexicon artifacts, and the async runtime that lazy-loads those chunks into frequency/CEFR/topical decks — without bloating the bundle, breaking offline use, or churning SRS history.

**Architecture:** Two halves sharing one artifact contract. **A-i** = a Node ESM pipeline in `scripts/import-lexicon/` (pure, fixture-tested modules; the user runs the heavy download locally). **A-ii** = `src/packs/lexiconStore.js` (async index+chunk loader reusing Phase B `resolveCard`), new auto-deck definitions, `VocabTab` loading states, PWA runtime caching, and licensing docs.

**Tech Stack:** Node 20 ESM (built-in `fetch`, `node:fs`, `node:readline`), Vite + `vite-plugin-pwa` (Workbox), React, Vitest + Testing Library.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — it runs `lint-staged` + full `npm test` (~3 min). Work on branch `feat/rich-lexicon-phase-a` (based on the Phase B branch); land via PR. The commit appears to hang ~3 min during tests — wait (allow 10 min).
- **`src/` ESM imports use NO file extension** (Vite resolves them). **`scripts/` ESM imports MUST use explicit `.js` extensions** (run by native Node, which requires them). This split is real — match each directory.
- **Artifact contract is fixed** (see §Artifact Contract below): `public/lexicon/manifest.json`, `index.json`, `chunk-NN.json`. Both halves must agree on it exactly.
- **`LexiconEntry` shape is Phase B's** — every imported entry must pass `validateLexiconEntry` (from `src/packs/validate.js`). `chunkSize` = 500. Chunk index = `floor((rank - 1) / chunkSize)`.
- **ID scheme:** imported `id = "{posPrefix}:{lemmaSlug}"`; homograph collisions get a gloss-slug suffix on ALL colliding members (deterministic regardless of order). Curated 40 keep legacy surface-form ids — do not touch them.
- **CEFR bands from rank:** 1–1000 → `A1`, 1001–2500 → `A2`, 2501–5000 → `B1`.
- **Consumer card shape frozen:** resolved cards expose `{ de (display), en (string), ipa, id, … }`; SRS keys off `card.id`.
- **Licensing:** Wiktionary-derived data is CC BY-SA 4.0; Tatoeba/Leipzig are CC BY. App code stays MIT.

## Artifact Contract

`public/lexicon/`:
- `manifest.json`: `{ version:1, generatedAt:ISO, sources:{wiktextract,tatoeba,leipzig}, total:int, chunkSize:500, chunkCount:int }`
- `index.json`: `[{ id, rank, cefr, tags, chunk }]` — one row per entry (lightweight selection index).
- `chunk-NN.json`: `{ [id]: LexiconEntry }` — `NN` is zero-padded two-digit chunk index.

## File Structure

A-i (`scripts/import-lexicon/`, Node ESM, `.js` extensions on imports):
- `ids.js` — `posPrefix`, `slug`, `entryId`, `disambiguateIds` (deterministic homograph ids); `cefrForRank`.
- `parseWiktextract.js` — one raw Wiktextract record → intermediate parsed word (or null).
- `joinTatoeba.js` — build a lemma→sentences map; `attachExamples`.
- `rankLeipzig.js` — parse a frequency list → `Map<lemmaLower, rank>`; `assignRanks`.
- `mapEntry.js` — parsed word + rank + examples → `LexiconEntry`.
- `filter.js` — `cleanExamples`, `keepEntry` (required-field + profanity/length).
- `chunk.js` — entries[] → `{ manifest, index, chunks }` objects (pure); `writeArtifacts` (fs).
- `report.js` — counts/rejection-reasons/sample.
- `download.js` — fetch raw dumps to a gitignored cache (thin, network).
- `index.js` — orchestrator wiring the modules; `npm run import:lexicon`.
- Tests: `*.test.js` colocated; fixtures under `scripts/import-lexicon/__fixtures__/`.

A-ii (`src/`):
- `src/packs/lexiconStore.js` — async `loadIndex`, `loadChunks`, `resolveAutoDeck`, cache reset.
- `src/packs/de/autoDecks.js` — frequency/CEFR/topical auto-deck defs + group labels.
- Modify `src/packs/resolve.js` — add `auto.by==='tag'`; (tests close Phase B gaps).
- Modify `src/components/VocabTab.jsx` — grouped deck list + async load/loading/error states.
- Modify `vite.config.js` — Workbox runtime caching for `/lexicon/.*\.json`.
- Create `public/lexicon/` SAMPLE artifacts (committed, tiny) for tests/dev.
- Create `CONTENT_LICENSE.md`; modify `README.md`.

---

# PART A-i — Import pipeline

## Task 1: ID helpers + CEFR band

**Files:**
- Create: `scripts/import-lexicon/ids.js`
- Test: `scripts/import-lexicon/ids.test.js`

**Interfaces:**
- Produces:
  - `posPrefix(pos)` → `'n'|'v'|'adj'|'adv'|'prep'|'num'|'pron'|'conj'|'x'` (`'x'` for unknown).
  - `slug(s)` → lowercased, German letters kept, runs of non-`[a-z0-9äöüß]` collapsed to `-`, trimmed of leading/trailing `-`.
  - `entryId(pos, lemma)` → `` `${posPrefix(pos)}:${slug(lemma)}` ``.
  - `disambiguateIds(entries)` → given `[{ pos, lemma, glosses, ... }]`, returns the same array with an added `id`; when ≥2 share a base id, every colliding member's id becomes `` `${base}:${slug(glosses[0])}` ``; if still colliding, append `-2`, `-3`… by stable input order.
  - `cefrForRank(rank)` → `'A1'|'A2'|'B1'` per the band rule; `null` if `rank == null`.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/ids.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { posPrefix, slug, entryId, disambiguateIds, cefrForRank } from './ids.js';

describe('posPrefix', () => {
  it('maps known pos and falls back to x', () => {
    expect(posPrefix('noun')).toBe('n');
    expect(posPrefix('verb')).toBe('v');
    expect(posPrefix('adj')).toBe('adj');
    expect(posPrefix('whatever')).toBe('x');
  });
});

describe('slug', () => {
  it('lowercases and keeps German letters', () => {
    expect(slug('Brot')).toBe('brot');
    expect(slug('Fußgänger')).toBe('fußgänger');
    expect(slug('Wo ist...?')).toBe('wo-ist');
    expect(slug('zu Hause')).toBe('zu-hause');
  });
});

describe('entryId', () => {
  it('combines pos prefix and lemma slug', () => {
    expect(entryId('noun', 'Brot')).toBe('n:brot');
    expect(entryId('verb', 'gehen')).toBe('v:gehen');
  });
});

describe('disambiguateIds', () => {
  it('leaves unique ids unsuffixed', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Brot', glosses: ['bread'] },
      { pos: 'verb', lemma: 'gehen', glosses: ['to go'] },
    ]);
    expect(out.map((e) => e.id)).toEqual(['n:brot', 'v:gehen']);
  });
  it('suffixes ALL members of a collision with the gloss slug', () => {
    const out = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['financial institution'] },
    ]);
    expect(out.map((e) => e.id).sort()).toEqual(['n:bank:bench', 'n:bank:financial-institution']);
  });
  it('is order-independent for the same input set', () => {
    const a = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['bank'] },
    ]).map((e) => e.id).sort();
    const b = disambiguateIds([
      { pos: 'noun', lemma: 'Bank', glosses: ['bank'] },
      { pos: 'noun', lemma: 'Bank', glosses: ['bench'] },
    ]).map((e) => e.id).sort();
    expect(a).toEqual(b);
  });
});

describe('cefrForRank', () => {
  it('maps rank to band', () => {
    expect(cefrForRank(1)).toBe('A1');
    expect(cefrForRank(1000)).toBe('A1');
    expect(cefrForRank(1001)).toBe('A2');
    expect(cefrForRank(2500)).toBe('A2');
    expect(cefrForRank(2501)).toBe('B1');
    expect(cefrForRank(5000)).toBe('B1');
    expect(cefrForRank(null)).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/ids.test.js`
Expected: FAIL — cannot resolve `./ids.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/ids.js`:

```js
const POS_PREFIX = {
  noun: 'n', verb: 'v', adj: 'adj', adv: 'adv',
  prep: 'prep', num: 'num', pron: 'pron', conj: 'conj',
};

export function posPrefix(pos) {
  return POS_PREFIX[pos] || 'x';
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function entryId(pos, lemma) {
  return `${posPrefix(pos)}:${slug(lemma)}`;
}

export function disambiguateIds(entries) {
  const base = entries.map((e) => ({ ...e, id: entryId(e.pos, e.lemma) }));
  const counts = new Map();
  for (const e of base) counts.set(e.id, (counts.get(e.id) || 0) + 1);

  // First pass: gloss-slug suffix for every member of a collision set.
  const withGloss = base.map((e) =>
    counts.get(e.id) > 1
      ? { ...e, id: `${e.id}:${slug((e.glosses && e.glosses[0]) || 'x')}` }
      : e
  );

  // Second pass: if a gloss-suffixed id still collides, append -2, -3… by order.
  const seen = new Map();
  return withGloss.map((e) => {
    const n = (seen.get(e.id) || 0) + 1;
    seen.set(e.id, n);
    return n === 1 ? e : { ...e, id: `${e.id}-${n}` };
  });
}

export function cefrForRank(rank) {
  if (rank == null) return null;
  if (rank <= 1000) return 'A1';
  if (rank <= 2500) return 'A2';
  return 'B1';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/ids.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/ids.js scripts/import-lexicon/ids.test.js
git commit -m "feat(import): id + cefr helpers for lexicon pipeline"
```

---

## Task 2: Parse a Wiktextract record

**Files:**
- Create: `scripts/import-lexicon/parseWiktextract.js`
- Create: `scripts/import-lexicon/__fixtures__/wiktextract-sample.js`
- Test: `scripts/import-lexicon/parseWiktextract.test.js`

**Schema note (confirm on first real run):** kaikki.org German extraction emits one JSON object per line with fields: `word` (lemma), `pos` (`"noun"|"verb"|"adj"|...`), `lang_code` (`"de"`), `forms: [{ form, tags: [...] }]` (gender appears as a tag `masculine|feminine|neuter` on a `canonical`-tagged form or any form; plural appears as a form tagged `plural`), `sounds: [{ ipa, tags }]`, `senses: [{ glosses: [...], tags, topics: [...], examples: [{ text, english }] }]`. The parser below reads exactly these paths. **Before the full local run, the user should `head` a few real lines and confirm these paths; adjust the field accessors in this one module if the real dump differs.**

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseRecord(raw)` → `null` (if `lang_code !== 'de'`, no `word`, no usable gloss, or pos not in the kept set) or an intermediate:
  ```js
  { lemma, pos, article, plural, ipa, glosses, topics, rawExamples }
  ```
  - `pos` mapped via `mapPos(raw.pos)` to the kept set `noun|verb|adj|adv|prep|num|pron|conj` (else record dropped).
  - `article`: `'der'|'die'|'das'` from a gender tag (`masculine→der`, `feminine→die`, `neuter→das`) found in any `forms[].tags`; `null` if none / non-noun.
  - `plural`: the `form` of the first `forms` entry whose `tags` include `'plural'`; else `null`.
  - `ipa`: first `sounds[].ipa` that exists; else `null`.
  - `glosses`: flattened non-empty `senses[].glosses` (strings), deduped, capped at 3.
  - `topics`: union of `senses[].topics` (strings), deduped.
  - `rawExamples`: `senses[].examples` mapped to `{ de: text, en: english||null }`, only where `text` is non-empty.

- [ ] **Step 1: Write the fixture**

Create `scripts/import-lexicon/__fixtures__/wiktextract-sample.js`:

```js
// Minimal but realistic Wiktextract records (kaikki.org German extraction shape).
export const NOUN_BROT = {
  word: 'Brot',
  pos: 'noun',
  lang_code: 'de',
  forms: [
    { form: 'Brot', tags: ['canonical', 'neuter'] },
    { form: 'Brote', tags: ['plural'] },
  ],
  sounds: [{ ipa: '[bʁoːt]' }],
  senses: [
    { glosses: ['bread'], topics: ['food'], examples: [{ text: 'Ich esse Brot.', english: 'I eat bread.' }] },
  ],
};

export const VERB_GEHEN = {
  word: 'gehen',
  pos: 'verb',
  lang_code: 'de',
  forms: [],
  sounds: [{ ipa: '[ˈɡeːən]' }],
  senses: [{ glosses: ['to go', 'to walk'], examples: [{ text: 'Wir gehen.', english: 'We go.' }] }],
};

export const NON_GERMAN = { word: 'bread', pos: 'noun', lang_code: 'en', senses: [{ glosses: ['bread'] }] };

export const NO_GLOSS = { word: 'Xyz', pos: 'noun', lang_code: 'de', senses: [{ glosses: [] }] };
```

- [ ] **Step 2: Write the failing test**

Create `scripts/import-lexicon/parseWiktextract.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseWiktextract.js';
import { NOUN_BROT, VERB_GEHEN, NON_GERMAN, NO_GLOSS } from './__fixtures__/wiktextract-sample.js';

describe('parseRecord', () => {
  it('parses a noun with gender, plural, ipa, gloss, topic, example', () => {
    expect(parseRecord(NOUN_BROT)).toEqual({
      lemma: 'Brot',
      pos: 'noun',
      article: 'das',
      plural: 'Brote',
      ipa: '[bʁoːt]',
      glosses: ['bread'],
      topics: ['food'],
      rawExamples: [{ de: 'Ich esse Brot.', en: 'I eat bread.' }],
    });
  });
  it('parses a verb (no article/plural) and caps glosses', () => {
    const out = parseRecord(VERB_GEHEN);
    expect(out.pos).toBe('verb');
    expect(out.article).toBe(null);
    expect(out.plural).toBe(null);
    expect(out.glosses).toEqual(['to go', 'to walk']);
  });
  it('drops non-German records', () => {
    expect(parseRecord(NON_GERMAN)).toBe(null);
  });
  it('drops records with no usable gloss', () => {
    expect(parseRecord(NO_GLOSS)).toBe(null);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/parseWiktextract.test.js`
Expected: FAIL — cannot resolve `./parseWiktextract.js`.

- [ ] **Step 4: Implement**

Create `scripts/import-lexicon/parseWiktextract.js`:

```js
const KEPT_POS = {
  noun: 'noun', verb: 'verb', adj: 'adj', adjective: 'adj', adv: 'adv', adverb: 'adv',
  prep: 'prep', preposition: 'prep', num: 'num', numeral: 'num',
  pron: 'pron', pronoun: 'pron', conj: 'conj', conjunction: 'conj',
};
const GENDER_ARTICLE = { masculine: 'der', feminine: 'die', neuter: 'das' };

function mapPos(pos) {
  return KEPT_POS[pos] || null;
}

function articleFromForms(forms) {
  for (const f of forms || []) {
    for (const t of f.tags || []) {
      if (GENDER_ARTICLE[t]) return GENDER_ARTICLE[t];
    }
  }
  return null;
}

function pluralFromForms(forms) {
  const f = (forms || []).find((x) => (x.tags || []).includes('plural') && x.form);
  return f ? f.form : null;
}

function firstIpa(sounds) {
  const s = (sounds || []).find((x) => x.ipa);
  return s ? s.ipa : null;
}

export function parseRecord(raw) {
  if (!raw || raw.lang_code !== 'de' || !raw.word) return null;
  const pos = mapPos(raw.pos);
  if (!pos) return null;

  const senses = raw.senses || [];
  const glosses = [
    ...new Set(senses.flatMap((s) => (s.glosses || []).filter((g) => typeof g === 'string' && g.trim()))),
  ].slice(0, 3);
  if (glosses.length === 0) return null;

  const topics = [...new Set(senses.flatMap((s) => s.topics || []).filter(Boolean))];
  const rawExamples = senses
    .flatMap((s) => s.examples || [])
    .filter((e) => e && typeof e.text === 'string' && e.text.trim())
    .map((e) => ({ de: e.text, en: typeof e.english === 'string' && e.english.trim() ? e.english : null }));

  return {
    lemma: raw.word,
    pos,
    article: pos === 'noun' ? articleFromForms(raw.forms) : null,
    plural: pos === 'noun' ? pluralFromForms(raw.forms) : null,
    ipa: firstIpa(raw.sounds),
    glosses,
    topics,
    rawExamples,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/parseWiktextract.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-lexicon/parseWiktextract.js scripts/import-lexicon/parseWiktextract.test.js scripts/import-lexicon/__fixtures__/wiktextract-sample.js
git commit -m "feat(import): parse Wiktextract German records"
```

---

## Task 3: Join Tatoeba example sentences

**Files:**
- Create: `scripts/import-lexicon/joinTatoeba.js`
- Test: `scripts/import-lexicon/joinTatoeba.test.js`

**Schema note:** Tatoeba ships `sentences.csv` (`id\ttext`, with a language column in the full export `id\tlang\ttext`) and `links.csv` (`sentence_id\ttranslation_id`). This module does NOT parse files (that's the orchestrator's job via `node:readline`); it works on already-parsed pair objects so it is unit-testable. A "pair" = `{ de: string, en: string }`.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildExampleIndex(pairs)` → `Map<string, Array<{de,en}>>` keyed by every lowercased word token in the German sentence (so a lemma lookup can find sentences containing it). Caps each bucket at 20 to bound memory.
  - `attachExamples(parsed, index, max=2)` → returns up to `max` `{ de, en, source:'tatoeba' }` examples whose German sentence contains the lemma (case-insensitive whole-word match), preferring shorter sentences; `[]` if none.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/joinTatoeba.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildExampleIndex, attachExamples } from './joinTatoeba.js';

const pairs = [
  { de: 'Ich esse Brot.', en: 'I eat bread.' },
  { de: 'Das Brot ist frisch und das Brot ist gut.', en: 'The bread is fresh and the bread is good.' },
  { de: 'Wir gehen nach Hause.', en: 'We go home.' },
];

describe('buildExampleIndex + attachExamples', () => {
  it('finds sentences containing the lemma, shortest first', () => {
    const index = buildExampleIndex(pairs);
    const out = attachExamples({ lemma: 'Brot' }, index, 2);
    expect(out).toEqual([
      { de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' },
      { de: 'Das Brot ist frisch und das Brot ist gut.', en: 'The bread is fresh and the bread is good.', source: 'tatoeba' },
    ]);
  });
  it('respects the max cap', () => {
    const index = buildExampleIndex(pairs);
    expect(attachExamples({ lemma: 'Brot' }, index, 1)).toHaveLength(1);
  });
  it('returns [] when no sentence contains the lemma', () => {
    const index = buildExampleIndex(pairs);
    expect(attachExamples({ lemma: 'Quark' }, index, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/joinTatoeba.test.js`
Expected: FAIL — cannot resolve `./joinTatoeba.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/joinTatoeba.js`:

```js
const BUCKET_CAP = 20;

function tokens(sentence) {
  return [...new Set(sentence.toLowerCase().match(/[a-zäöüß]+/g) || [])];
}

export function buildExampleIndex(pairs) {
  const index = new Map();
  for (const pair of pairs) {
    if (!pair.de || !pair.en) continue;
    for (const tok of tokens(pair.de)) {
      let bucket = index.get(tok);
      if (!bucket) {
        bucket = [];
        index.set(tok, bucket);
      }
      if (bucket.length < BUCKET_CAP) bucket.push(pair);
    }
  }
  return index;
}

export function attachExamples(parsed, index, max = 2) {
  const key = parsed.lemma.toLowerCase();
  const bucket = index.get(key) || [];
  return bucket
    .slice()
    .sort((a, b) => a.de.length - b.de.length)
    .slice(0, max)
    .map((p) => ({ de: p.de, en: p.en, source: 'tatoeba' }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/joinTatoeba.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/joinTatoeba.js scripts/import-lexicon/joinTatoeba.test.js
git commit -m "feat(import): join Tatoeba example sentences by lemma"
```

---

## Task 4: Leipzig frequency ranking

**Files:**
- Create: `scripts/import-lexicon/rankLeipzig.js`
- Test: `scripts/import-lexicon/rankLeipzig.test.js`

**Schema note:** Leipzig word files are tab-separated `rank\tword\tfrequency` (or `word\tfrequency` ordered by frequency). This module works on a pre-built rank map so it is unit-testable; the orchestrator builds the map from the file.

**Interfaces:**
- Consumes: `cefrForRank` from `./ids.js`.
- Produces:
  - `assignRanks(parsedList, rankMap)` → for each parsed word, look up `rankMap.get(lemma.toLowerCase())`; set `freqRank` (number|null) and `cefr` (`cefrForRank(freqRank)`). Returns a NEW array, unsorted.
  - `topByRank(list, n)` → entries with a non-null `freqRank`, sorted ascending by rank, sliced to `n`.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/rankLeipzig.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { assignRanks, topByRank } from './rankLeipzig.js';

const rankMap = new Map([['brot', 142], ['gehen', 12]]);

describe('assignRanks', () => {
  it('assigns freqRank + cefr from the map, null when absent', () => {
    const out = assignRanks(
      [{ lemma: 'Brot' }, { lemma: 'gehen' }, { lemma: 'Quark' }],
      rankMap
    );
    expect(out).toEqual([
      { lemma: 'Brot', freqRank: 142, cefr: 'A1' },
      { lemma: 'gehen', freqRank: 12, cefr: 'A1' },
      { lemma: 'Quark', freqRank: null, cefr: null },
    ]);
  });
});

describe('topByRank', () => {
  it('keeps ranked entries, sorts ascending, slices to n', () => {
    const out = topByRank(
      [{ lemma: 'Brot', freqRank: 142 }, { lemma: 'gehen', freqRank: 12 }, { lemma: 'Quark', freqRank: null }],
      1
    );
    expect(out.map((e) => e.lemma)).toEqual(['gehen']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/rankLeipzig.test.js`
Expected: FAIL — cannot resolve `./rankLeipzig.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/rankLeipzig.js`:

```js
import { cefrForRank } from './ids.js';

export function assignRanks(parsedList, rankMap) {
  return parsedList.map((p) => {
    const freqRank = rankMap.get(p.lemma.toLowerCase()) ?? null;
    return { ...p, freqRank, cefr: cefrForRank(freqRank) };
  });
}

export function topByRank(list, n) {
  return list
    .filter((e) => e.freqRank != null)
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, n);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/rankLeipzig.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/rankLeipzig.js scripts/import-lexicon/rankLeipzig.test.js
git commit -m "feat(import): Leipzig frequency ranking + cefr banding"
```

---

## Task 5: Map to LexiconEntry

**Files:**
- Create: `scripts/import-lexicon/mapEntry.js`
- Test: `scripts/import-lexicon/mapEntry.test.js`

**Interfaces:**
- Consumes: nothing (operates on an already id-assigned, ranked, example-attached word).
- Produces: `mapEntry(word)` → a `LexiconEntry` (Phase B shape). Input `word` has: `id, lemma, pos, article, plural, ipa, glosses, topics, freqRank, cefr, examples`. Output:
  ```js
  {
    id, de: lemma, en: glosses, pos, article, ipa, plural,
    cefr, freqRank, tags: topics, examples,
    verb: null,            // verb conjugation enrichment deferred (YAGNI for A)
    source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
  }
  ```
  Note: `verb` stays `null` even for verbs in Phase A — the parser does not extract conjugation tables, and `validateLexiconEntry` only requires the verb block when `pos==='verb'`. **Therefore `mapEntry` sets `pos` to `'verb'` only would fail validation; to stay valid, verbs are mapped with `pos` unchanged but a minimal `verb` block is NOT available.** To avoid shipping invalid entries, `mapEntry` returns `pos: word.pos` and, for verbs, sets `verb` to `null` AND the filter (Task 6) drops `pos==='verb'` entries that lack a verb block. (Verb conjugation import is a follow-up.)

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/mapEntry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mapEntry } from './mapEntry.js';
import { validateLexiconEntry } from '../../src/packs/validate.js';

const noun = {
  id: 'n:brot', lemma: 'Brot', pos: 'noun', article: 'das', plural: 'Brote',
  ipa: '[bʁoːt]', glosses: ['bread'], topics: ['food'], freqRank: 142, cefr: 'A1',
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
};

describe('mapEntry', () => {
  it('produces a valid LexiconEntry for a noun', () => {
    const entry = mapEntry(noun);
    expect(entry).toEqual({
      id: 'n:brot', de: 'Brot', en: ['bread'], pos: 'noun', article: 'das',
      ipa: '[bʁoːt]', plural: 'Brote', cefr: 'A1', freqRank: 142, tags: ['food'],
      examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
      verb: null,
      source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
    });
    expect(validateLexiconEntry(entry)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/mapEntry.test.js`
Expected: FAIL — cannot resolve `./mapEntry.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/mapEntry.js`:

```js
export function mapEntry(word) {
  return {
    id: word.id,
    de: word.lemma,
    en: word.glosses,
    pos: word.pos,
    article: word.article ?? null,
    ipa: word.ipa ?? null,
    plural: word.plural ?? null,
    cefr: word.cefr ?? null,
    freqRank: word.freqRank ?? null,
    tags: word.topics ?? [],
    examples: word.examples ?? [],
    verb: null,
    source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/mapEntry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/mapEntry.js scripts/import-lexicon/mapEntry.test.js
git commit -m "feat(import): map parsed words to LexiconEntry"
```

---

## Task 6: Filter (required fields + clean examples)

**Files:**
- Create: `scripts/import-lexicon/filter.js`
- Test: `scripts/import-lexicon/filter.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `cleanExamples(examples, { maxLen=120 })` → keep only examples with non-empty `de`+`en`, `de.length <= maxLen`, and no blocklisted token (small bundled list `BLOCKLIST`); returns the filtered array.
  - `keepEntry(entry)` → `{ keep: boolean, reason: string|null }`. Drops: noun without `article`; `pos==='verb'` with `verb===null` (conjugation not imported in Phase A); entry with zero examples after cleaning. Returns the FIRST failing reason or `{keep:true,reason:null}`.
  - `applyFilter(entries)` → `{ kept: entry[], rejected: [{id, reason}] }`; runs `cleanExamples` on each entry first (mutating its `examples`), then `keepEntry`.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/filter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cleanExamples, keepEntry, applyFilter } from './filter.js';

const ex = (de, en) => ({ de, en, source: 'tatoeba' });

describe('cleanExamples', () => {
  it('drops over-long and empty examples', () => {
    const long = 'a'.repeat(200);
    expect(cleanExamples([ex('Ich esse Brot.', 'I eat bread.'), ex(long, 'x'), ex('', 'y')], {})).toEqual([
      ex('Ich esse Brot.', 'I eat bread.'),
    ]);
  });
});

describe('keepEntry', () => {
  const base = { id: 'n:brot', pos: 'noun', article: 'das', verb: null, examples: [ex('Ich esse Brot.', 'I eat bread.')] };
  it('keeps a valid noun', () => {
    expect(keepEntry(base)).toEqual({ keep: true, reason: null });
  });
  it('drops a noun without an article', () => {
    expect(keepEntry({ ...base, article: null }).keep).toBe(false);
  });
  it('drops a verb without a verb block', () => {
    expect(keepEntry({ ...base, pos: 'verb', article: null }).reason).toMatch(/verb/);
  });
  it('drops an entry with no examples', () => {
    expect(keepEntry({ ...base, examples: [] }).reason).toMatch(/example/);
  });
});

describe('applyFilter', () => {
  it('partitions kept vs rejected and cleans examples', () => {
    const long = 'a'.repeat(200);
    const entries = [
      { id: 'n:brot', pos: 'noun', article: 'das', verb: null, examples: [ex('Ich esse Brot.', 'I eat bread.')] },
      { id: 'n:bad', pos: 'noun', article: null, verb: null, examples: [ex('x', 'y')] },
      { id: 'n:nolex', pos: 'noun', article: 'die', verb: null, examples: [ex(long, 'y')] },
    ];
    const { kept, rejected } = applyFilter(entries);
    expect(kept.map((e) => e.id)).toEqual(['n:brot']);
    expect(rejected.map((r) => r.id).sort()).toEqual(['n:bad', 'n:nolex']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/filter.test.js`
Expected: FAIL — cannot resolve `./filter.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/filter.js`:

```js
// Minimal blocklist; expand as the import report surfaces issues.
const BLOCKLIST = ['ficken', 'scheiße', 'arsch', 'fotze', 'wichser'];

export function cleanExamples(examples, { maxLen = 120 } = {}) {
  return (examples || []).filter((e) => {
    if (!e || !e.de || !e.en) return false;
    if (e.de.length > maxLen) return false;
    const lower = e.de.toLowerCase();
    return !BLOCKLIST.some((w) => lower.includes(w));
  });
}

export function keepEntry(entry) {
  if (entry.pos === 'noun' && !entry.article) return { keep: false, reason: 'noun missing article' };
  if (entry.pos === 'verb' && entry.verb === null) return { keep: false, reason: 'verb missing verb block' };
  if (!entry.examples || entry.examples.length === 0) return { keep: false, reason: 'no example' };
  return { keep: true, reason: null };
}

export function applyFilter(entries) {
  const kept = [];
  const rejected = [];
  for (const entry of entries) {
    entry.examples = cleanExamples(entry.examples);
    const { keep, reason } = keepEntry(entry);
    if (keep) kept.push(entry);
    else rejected.push({ id: entry.id, reason });
  }
  return { kept, rejected };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/filter.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/filter.js scripts/import-lexicon/filter.test.js
git commit -m "feat(import): required-field + example cleanliness filter"
```

---

## Task 7: Chunk + manifest + index (pure builder)

**Files:**
- Create: `scripts/import-lexicon/chunk.js`
- Test: `scripts/import-lexicon/chunk.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildArtifacts(entries, { chunkSize=500, sources={} })` → pure, returns `{ manifest, index, chunks }`:
    - `entries` must already be sorted ascending by `freqRank`. Chunk index for position `i` = `Math.floor(i / chunkSize)`.
    - `index`: `[{ id, rank: freqRank, cefr, tags, chunk }]` in the same order.
    - `chunks`: `Array<{ name: 'chunk-NN.json', data: {[id]: entry} }>` (NN zero-padded to 2 digits).
    - `manifest`: `{ version:1, generatedAt: <ISO from new Date().toISOString()>, sources, total: entries.length, chunkSize, chunkCount: chunks.length }`.
  - `writeArtifacts(outDir, { manifest, index, chunks })` → writes the files with `node:fs` (mkdir -p, pretty JSON). Tested via a tmp dir.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/chunk.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifacts, writeArtifacts } from './chunk.js';

const mk = (id, rank, cefr, tags = []) => ({
  id, de: id, en: ['x'], pos: 'noun', article: 'das', ipa: null, plural: null,
  cefr, freqRank: rank, tags, examples: [{ de: 'a', en: 'b', source: 'tatoeba' }],
  verb: null, source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0' },
});

describe('buildArtifacts', () => {
  it('splits entries into chunks and builds the index + manifest', () => {
    const entries = [mk('n:a', 1, 'A1', ['food']), mk('n:b', 2, 'A1'), mk('n:c', 3, 'A1')];
    const { manifest, index, chunks } = buildArtifacts(entries, { chunkSize: 2, sources: { tatoeba: 'x' } });
    expect(manifest.total).toBe(3);
    expect(manifest.chunkSize).toBe(2);
    expect(manifest.chunkCount).toBe(2);
    expect(index).toEqual([
      { id: 'n:a', rank: 1, cefr: 'A1', tags: ['food'], chunk: 0 },
      { id: 'n:b', rank: 2, cefr: 'A1', tags: [], chunk: 0 },
      { id: 'n:c', rank: 3, cefr: 'A1', tags: [], chunk: 1 },
    ]);
    expect(chunks.map((c) => c.name)).toEqual(['chunk-00.json', 'chunk-01.json']);
    expect(Object.keys(chunks[0].data)).toEqual(['n:a', 'n:b']);
    expect(chunks[1].data['n:c'].id).toBe('n:c');
  });
});

describe('writeArtifacts', () => {
  it('writes manifest, index, and chunk files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lex-'));
    const entries = [mk('n:a', 1, 'A1')];
    writeArtifacts(dir, buildArtifacts(entries, { chunkSize: 500 }));
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(dir, 'index.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'chunk-00.json'), 'utf8'))['n:a'].id).toBe('n:a');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/chunk.test.js`
Expected: FAIL — cannot resolve `./chunk.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/chunk.js`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pad2 = (n) => String(n).padStart(2, '0');

export function buildArtifacts(entries, { chunkSize = 500, sources = {} } = {}) {
  const chunkCount = Math.max(1, Math.ceil(entries.length / chunkSize));
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    name: `chunk-${pad2(i)}.json`,
    data: {},
  }));
  const index = entries.map((entry, i) => {
    const chunk = Math.floor(i / chunkSize);
    chunks[chunk].data[entry.id] = entry;
    return { id: entry.id, rank: entry.freqRank, cefr: entry.cefr, tags: entry.tags, chunk };
  });
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources,
    total: entries.length,
    chunkSize,
    chunkCount: entries.length === 0 ? 0 : chunkCount,
  };
  return { manifest, index, chunks };
}

export function writeArtifacts(outDir, { manifest, index, chunks }) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
  for (const c of chunks) writeFileSync(join(outDir, c.name), JSON.stringify(c.data));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/chunk.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/chunk.js scripts/import-lexicon/chunk.test.js
git commit -m "feat(import): chunk/index/manifest artifact builder"
```

---

## Task 8: Orchestrator + download + report + npm script

**Files:**
- Create: `scripts/import-lexicon/download.js`
- Create: `scripts/import-lexicon/report.js`
- Create: `scripts/import-lexicon/index.js`
- Test: `scripts/import-lexicon/report.test.js`
- Modify: `package.json` (add `import:lexicon` script)
- Modify: `.gitignore` (ignore the raw-download cache)

**Interfaces:**
- Consumes: all prior A-i modules + `disambiguateIds`, `entryId` from `./ids.js`.
- Produces:
  - `report.js`: `buildReport({ parsedCount, rankedCount, kept, rejected })` → `{ total, kept, rejected, byReason: {reason: count}, sample: id[] }` (sample = up to 10 random kept ids). Pure + tested.
  - `download.js`: `ensureRaw(cacheDir)` → downloads the three dumps if missing (network; not unit-tested). Exposes the dump URLs as constants the README documents.
  - `index.js`: the orchestrator (default export `run({ n=5000, cacheDir, outDir })`) wiring parse→join→rank→map→id→filter→chunk→write→report. Network-dependent; invoked by the npm script, not unit-tested.

- [ ] **Step 1: Write the failing test (report only — the orchestrator/download are network glue)**

Create `scripts/import-lexicon/report.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildReport } from './report.js';

describe('buildReport', () => {
  it('summarizes counts and rejection reasons', () => {
    const r = buildReport({
      parsedCount: 100,
      rankedCount: 80,
      kept: [{ id: 'n:a' }, { id: 'n:b' }],
      rejected: [{ id: 'n:x', reason: 'no example' }, { id: 'n:y', reason: 'no example' }, { id: 'n:z', reason: 'noun missing article' }],
    });
    expect(r.total).toBe(80);
    expect(r.kept).toBe(2);
    expect(r.rejected).toBe(3);
    expect(r.byReason).toEqual({ 'no example': 2, 'noun missing article': 1 });
    expect(r.sample.length).toBeLessThanOrEqual(10);
    expect(r.sample.every((id) => ['n:a', 'n:b'].includes(id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/report.test.js`
Expected: FAIL — cannot resolve `./report.js`.

- [ ] **Step 3: Implement `report.js`**

Create `scripts/import-lexicon/report.js`:

```js
export function buildReport({ parsedCount, rankedCount, kept, rejected }) {
  const byReason = {};
  for (const r of rejected) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  const ids = kept.map((e) => e.id);
  const sample = [];
  const pool = ids.slice();
  while (sample.length < Math.min(10, pool.length)) {
    const i = Math.floor(Math.random() * pool.length);
    sample.push(pool.splice(i, 1)[0]);
  }
  return { parsedCount, rankedCount, total: kept.length, kept: kept.length, rejected: rejected.length, byReason, sample };
}
```

- [ ] **Step 4: Implement `download.js`**

Create `scripts/import-lexicon/download.js`:

```js
import { mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

// Pinned source URLs — update + record the resolved version in manifest.sources.
export const SOURCES = {
  wiktextract: 'https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl',
  tatoebaSentences: 'https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2',
  tatoebaLinks: 'https://downloads.tatoeba.org/exports/links.tar.bz2',
  leipzig: 'https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_100K.tar.gz',
};

async function fetchTo(url, dest) {
  if (existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    Readable.fromWeb(res.body).pipe(out).on('finish', resolve).on('error', reject);
  });
  return dest;
}

export async function ensureRaw(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const paths = {};
  for (const [key, url] of Object.entries(SOURCES)) {
    paths[key] = await fetchTo(url, join(cacheDir, url.split('/').pop()));
  }
  return paths;
}
```

- [ ] **Step 5: Implement the orchestrator `index.js`**

Create `scripts/import-lexicon/index.js`:

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureRaw, SOURCES } from './download.js';
import { parseRecord } from './parseWiktextract.js';
import { buildExampleIndex, attachExamples } from './joinTatoeba.js';
import { assignRanks, topByRank } from './rankLeipzig.js';
import { disambiguateIds } from './ids.js';
import { mapEntry } from './mapEntry.js';
import { applyFilter } from './filter.js';
import { buildArtifacts, writeArtifacts } from './chunk.js';
import { buildReport } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// NOTE: the readers below assume decompressed inputs. Decompress the Tatoeba/
// Leipzig archives into cacheDir first (documented in README), or extend these
// readers. The Wiktextract .jsonl is read directly.
async function readParsed(jsonlPath) {
  const rl = createInterface({ input: createReadStream(jsonlPath), crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = parseRecord(JSON.parse(line));
    if (parsed) out.push(parsed);
  }
  return out;
}

async function readTatoebaPairs(sentencesTsv, _linksCsv) {
  // Minimal de+en pairing: expects a pre-joined TSV "de\ten" in cacheDir as
  // tatoeba-de-en.tsv (produced by the documented prep step). Falls back to [].
  const pairs = [];
  const rl = createInterface({ input: createReadStream(sentencesTsv), crlfDelay: Infinity });
  for await (const line of rl) {
    const [de, en] = line.split('\t');
    if (de && en) pairs.push({ de, en });
  }
  return pairs;
}

async function readRankMap(freqTsv) {
  const map = new Map();
  const rl = createInterface({ input: createReadStream(freqTsv), crlfDelay: Infinity });
  let rank = 0;
  for await (const line of rl) {
    const word = line.split('\t')[1] || line.split('\t')[0];
    if (word) map.set(word.toLowerCase(), ++rank);
  }
  return map;
}

export async function run({ n = 5000, cacheDir, outDir } = {}) {
  cacheDir = cacheDir || join(ROOT, '.cache', 'lexicon-raw');
  outDir = outDir || join(ROOT, 'public', 'lexicon');

  await ensureRaw(cacheDir);
  const parsed = await readParsed(join(cacheDir, 'tatoeba-or-wiktextract.jsonl'));
  const pairs = await readTatoebaPairs(join(cacheDir, 'tatoeba-de-en.tsv'));
  const rankMap = await readRankMap(join(cacheDir, 'freq.tsv'));

  const exIndex = buildExampleIndex(pairs);
  const ranked = topByRank(assignRanks(parsed, rankMap), n);
  const withIds = disambiguateIds(ranked); // adds .id
  const mapped = withIds.map((w) => mapEntry({ ...w, examples: attachExamples(w, exIndex, 2) }));
  const { kept, rejected } = applyFilter(mapped);

  const artifacts = buildArtifacts(kept, { chunkSize: 500, sources: SOURCES });
  writeArtifacts(outDir, artifacts);

  const report = buildReport({ parsedCount: parsed.length, rankedCount: ranked.length, kept, rejected });
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

> **Implementer note:** the three `read*` helpers depend on the exact decompressed file shapes, which the user confirms locally (README documents the decompress/prep step). They are deliberately thin and may need small adjustments against the real files on first run — this is the expected "develop against real data" seam. The pure modules (Tasks 1–7) are fully tested; the orchestrator only wires them.

- [ ] **Step 6: Add the npm script and gitignore the cache**

In `package.json` `scripts`, add:

```json
    "import:lexicon": "node scripts/import-lexicon/index.js",
```

In `.gitignore`, add:

```
.cache/
```

- [ ] **Step 7: Run report test + full suite**

Run: `npx vitest run scripts/import-lexicon/report.test.js`
Expected: PASS.
Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 8: Commit**

```bash
git add scripts/import-lexicon/download.js scripts/import-lexicon/report.js scripts/import-lexicon/index.js scripts/import-lexicon/report.test.js package.json .gitignore
git commit -m "feat(import): orchestrator, downloader, report + import:lexicon script"
```

---

# PART A-ii — Runtime loading + decks + UI

## Task 9: Committed sample artifacts (test/dev fixture)

**Files:**
- Create: `public/lexicon/manifest.json`
- Create: `public/lexicon/index.json`
- Create: `public/lexicon/chunk-00.json`
- Create: `public/lexicon/chunk-01.json`
- Test: `src/packs/lexiconSample.test.js`

**Interfaces:**
- Produces: a tiny, valid artifact set (6 entries across 2 chunks of size 3) that the runtime tests and local dev use until the user runs the full import. Each entry passes `validateLexiconEntry`. Covers ≥1 entry per shipped deck type (freq, cefr A1/A2, a `food` tag).

- [ ] **Step 1: Write the failing test**

Create `src/packs/lexiconSample.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateLexiconEntry } from './validate';
import manifest from '../../public/lexicon/manifest.json';
import index from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';

describe('sample lexicon artifacts', () => {
  it('manifest matches chunk count and total', () => {
    expect(manifest.chunkCount).toBe(2);
    expect(manifest.total).toBe(index.length);
  });
  it('every index row points at a present, valid entry', () => {
    const chunks = [chunk0, chunk1];
    for (const row of index) {
      const entry = chunks[row.chunk][row.id];
      expect(entry).toBeDefined();
      expect(validateLexiconEntry(entry)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/lexiconSample.test.js`
Expected: FAIL — cannot find `../../public/lexicon/manifest.json`.

- [ ] **Step 3: Create the sample artifacts**

`public/lexicon/manifest.json`:

```json
{
  "version": 1,
  "generatedAt": "2026-06-28T00:00:00.000Z",
  "sources": { "wiktextract": "sample", "tatoeba": "sample", "leipzig": "sample" },
  "total": 6,
  "chunkSize": 3,
  "chunkCount": 2
}
```

`public/lexicon/index.json`:

```json
[
  { "id": "n:brot", "rank": 142, "cefr": "A1", "tags": ["food"], "chunk": 0 },
  { "id": "n:wasser", "rank": 88, "cefr": "A1", "tags": ["food"], "chunk": 0 },
  { "id": "n:haus", "rank": 60, "cefr": "A1", "tags": ["home"], "chunk": 0 },
  { "id": "n:bahnhof", "rank": 1200, "cefr": "A2", "tags": ["travel"], "chunk": 1 },
  { "id": "n:freund", "rank": 300, "cefr": "A1", "tags": ["people"], "chunk": 1 },
  { "id": "n:arbeit", "rank": 1500, "cefr": "A2", "tags": ["work"], "chunk": 1 }
]
```

`public/lexicon/chunk-00.json`:

```json
{
  "n:brot": { "id": "n:brot", "de": "Brot", "en": ["bread"], "pos": "noun", "article": "das", "ipa": "[bʁoːt]", "plural": "Brote", "cefr": "A1", "freqRank": 142, "tags": ["food"], "examples": [{ "de": "Ich esse Brot.", "en": "I eat bread.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } },
  "n:wasser": { "id": "n:wasser", "de": "Wasser", "en": ["water"], "pos": "noun", "article": "das", "ipa": "[ˈvasɐ]", "plural": "Wässer", "cefr": "A1", "freqRank": 88, "tags": ["food"], "examples": [{ "de": "Ich trinke Wasser.", "en": "I drink water.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } },
  "n:haus": { "id": "n:haus", "de": "Haus", "en": ["house"], "pos": "noun", "article": "das", "ipa": "[haʊ̯s]", "plural": "Häuser", "cefr": "A1", "freqRank": 60, "tags": ["home"], "examples": [{ "de": "Das Haus ist groß.", "en": "The house is big.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } }
}
```

`public/lexicon/chunk-01.json`:

```json
{
  "n:bahnhof": { "id": "n:bahnhof", "de": "Bahnhof", "en": ["train station"], "pos": "noun", "article": "der", "ipa": "[ˈbaːnhoːf]", "plural": "Bahnhöfe", "cefr": "A2", "freqRank": 1200, "tags": ["travel"], "examples": [{ "de": "Der Bahnhof ist dort.", "en": "The station is there.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } },
  "n:freund": { "id": "n:freund", "de": "Freund", "en": ["friend"], "pos": "noun", "article": "der", "ipa": "[fʁɔɪ̯nt]", "plural": "Freunde", "cefr": "A1", "freqRank": 300, "tags": ["people"], "examples": [{ "de": "Er ist mein Freund.", "en": "He is my friend.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } },
  "n:arbeit": { "id": "n:arbeit", "de": "Arbeit", "en": ["work"], "pos": "noun", "article": "die", "ipa": "[ˈaʁbaɪ̯t]", "plural": "Arbeiten", "cefr": "A2", "freqRank": 1500, "tags": ["work"], "examples": [{ "de": "Die Arbeit ist schwer.", "en": "The work is hard.", "source": "tatoeba" }], "verb": null, "source": { "dict": "wiktionary", "license": "CC-BY-SA-4.0", "sentences": "tatoeba" } }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/lexiconSample.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/lexicon/ src/packs/lexiconSample.test.js
git commit -m "feat(lexicon): committed sample artifacts for dev + tests"
```

---

## Task 10: `resolveDeck` tag support + close Phase B test gaps

**Files:**
- Modify: `src/packs/resolve.js:45-48`
- Test: `src/packs/resolve.test.js`

**Interfaces:**
- Consumes: existing `resolveDeck`.
- Produces: `resolveDeck` additionally handles `auto.by === 'tag'` → keep entries whose `tags` include `auto.tag`, sorted ascending by `freqRank` (nulls last). Existing `freq`/`cefr` behavior unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/packs/resolve.test.js` (inside the existing `describe('resolveDeck', …)` block or as a new one):

```js
describe('resolveDeck auto.by=tag and sort coverage', () => {
  const e = (id, rank, cefr, tags) => ({
    id, de: id, en: [id], pos: 'noun', article: 'das', ipa: null, plural: null,
    cefr, freqRank: rank, tags, examples: [], verb: null, source: { dict: 'w', license: 'l' },
  });
  const lex = {
    'n:a': e('n:a', 3, 'A1', ['food']),
    'n:b': e('n:b', 1, 'A1', ['food']),
    'n:c': e('n:c', 2, 'A2', ['travel']),
  };
  it('filters by tag and sorts ascending by freqRank', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: 'food' } }, lex);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:a']);
  });
  it('freq band sorts multiple entries ascending', () => {
    const cards = resolveDeck({ auto: { by: 'freq', range: [1, 3] } }, lex);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c', 'n:a']);
  });
  it('throws on an unknown auto.by', () => {
    expect(() => resolveDeck({ auto: { by: 'bogus' } }, lex)).toThrow(/bogus/);
  });
});
```

- [ ] **Step 2: Run to verify the tag/throw tests fail**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: FAIL — `auto.by='tag'` currently hits the `unknown auto.by "tag"` throw.

- [ ] **Step 3: Implement the tag branch**

In `src/packs/resolve.js`, inside the `if (deckDef.auto) {` block, AFTER the `cefr` branch and BEFORE the `throw new Error(\`resolveDeck: unknown auto.by …\`)`, add:

```js
    if (deckDef.auto.by === 'tag') {
      return all
        .filter((e) => Array.isArray(e.tags) && e.tags.includes(deckDef.auto.tag))
        .sort((a, b) => (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity))
        .map(resolveCard);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packs/resolve.js src/packs/resolve.test.js
git commit -m "feat(packs): resolveDeck tag decks + multi-entry sort coverage"
```

---

## Task 11: Async lexicon store

**Files:**
- Create: `src/packs/lexiconStore.js`
- Test: `src/packs/lexiconStore.test.js`

**Interfaces:**
- Consumes: `resolveCard` from `./resolve`.
- Produces:
  - `loadIndex()` → `Promise<indexRows[]>`; fetches `/lexicon/index.json` once, memoized.
  - `loadChunks(chunkIds)` → `Promise<Record<id, entry>>`; fetches each `/lexicon/chunk-NN.json` once (memoized), merged.
  - `resolveAutoDeck(deckDef)` → `Promise<card[]>`: filter the index by `deckDef.auto` (`freq` range / `cefr` level / `tag`), order ascending by rank, load the needed chunks, `resolveCard` each.
  - `__resetCache()` → clears memo (tests only).
  - Uses global `fetch`; chunk filename = `chunk-${String(chunk).padStart(2,'0')}.json`.

- [ ] **Step 1: Write the failing test**

Create `src/packs/lexiconStore.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndex, resolveAutoDeck, __resetCache } from './lexiconStore';
import index from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';

const fixtures = {
  '/lexicon/index.json': index,
  '/lexicon/chunk-00.json': chunk0,
  '/lexicon/chunk-01.json': chunk1,
};

beforeEach(() => {
  __resetCache();
  globalThis.fetch = vi.fn((url) => {
    const key = Object.keys(fixtures).find((k) => url.endsWith(k));
    if (!key) return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) });
  });
});

describe('loadIndex', () => {
  it('fetches the index once and memoizes', async () => {
    await loadIndex();
    await loadIndex();
    const calls = globalThis.fetch.mock.calls.filter((c) => String(c[0]).endsWith('/lexicon/index.json'));
    expect(calls).toHaveLength(1);
  });
});

describe('resolveAutoDeck', () => {
  it('resolves a freq-band deck ordered by rank, loading only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'freq', range: [1, 200] } });
    // ranks in [1,200]: n:haus(60), n:wasser(88), n:brot(142) — all in chunk 0
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    expect(cards[0].de).toBe('das Haus'); // resolveCard display form
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) => String(c[0]).endsWith('chunk-01.json'));
    expect(chunk1Calls).toHaveLength(0); // chunk 1 not needed
  });
  it('resolves a cefr deck across chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'cefr', level: 'A2' } });
    expect(cards.map((c) => c.id).sort()).toEqual(['n:arbeit', 'n:bahnhof']);
  });
  it('resolves a tag deck', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(cards.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']); // 88 then 142
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: FAIL — cannot resolve `./lexiconStore`.

- [ ] **Step 3: Implement**

Create `src/packs/lexiconStore.js`:

```js
import { resolveCard } from './resolve';

const BASE = '/lexicon';
let indexPromise = null;
const chunkPromises = new Map();

export function __resetCache() {
  indexPromise = null;
  chunkPromises.clear();
}

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`).then((r) => {
      if (!r.ok) throw new Error(`lexicon index ${r.status}`);
      return r.json();
    });
  }
  return indexPromise;
}

function chunkName(chunk) {
  return `chunk-${String(chunk).padStart(2, '0')}.json`;
}

function loadChunk(chunk) {
  if (!chunkPromises.has(chunk)) {
    chunkPromises.set(
      chunk,
      fetch(`${BASE}/${chunkName(chunk)}`).then((r) => {
        if (!r.ok) throw new Error(`lexicon ${chunkName(chunk)} ${r.status}`);
        return r.json();
      })
    );
  }
  return chunkPromises.get(chunk);
}

export async function loadChunks(chunkIds) {
  const datas = await Promise.all([...new Set(chunkIds)].map(loadChunk));
  return Object.assign({}, ...datas);
}

function matches(row, auto) {
  if (auto.by === 'freq') return row.rank != null && row.rank >= auto.range[0] && row.rank <= auto.range[1];
  if (auto.by === 'cefr') return row.cefr === auto.level;
  if (auto.by === 'tag') return Array.isArray(row.tags) && row.tags.includes(auto.tag);
  throw new Error(`resolveAutoDeck: unknown auto.by "${auto.by}"`);
}

export async function resolveAutoDeck(deckDef) {
  const index = await loadIndex();
  const rows = index
    .filter((row) => matches(row, deckDef.auto))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const entries = await loadChunks(rows.map((r) => r.chunk));
  return rows.map((r) => resolveCard(entries[r.id]));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/lexiconStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packs/lexiconStore.js src/packs/lexiconStore.test.js
git commit -m "feat(packs): async lexicon store (index + chunk lazy loading)"
```

---

## Task 12: Auto-deck definitions

**Files:**
- Create: `src/packs/de/autoDecks.js`
- Test: `src/packs/de/autoDecks.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const AUTO_DECKS` — an ordered array of `{ id, name, icon, group, auto }` deck descriptors:
  - group `'Frequency'`: `core-100` `{by:'freq',range:[1,100]}`, `top-500` `{by:'freq',range:[1,500]}`.
  - group `'CEFR'`: `cefr-a1`/`cefr-a2`/`cefr-b1` `{by:'cefr',level:'A1'|'A2'|'B1'}`.
  - group `'Topics'`: a curated allow-list of `{by:'tag',tag}` — `food, travel, home, people, work, body, nature, time` (icons chosen per topic).
  - Also `export const DECK_GROUPS = ['Curated','Frequency','CEFR','Topics']` (display order; Curated covers the Phase B `DECKS`).

- [ ] **Step 1: Write the failing test**

Create `src/packs/de/autoDecks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { AUTO_DECKS, DECK_GROUPS } from './autoDecks';

describe('AUTO_DECKS', () => {
  it('has unique ids and a valid auto rule each', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of AUTO_DECKS) {
      expect(typeof d.name).toBe('string');
      expect(typeof d.icon).toBe('string');
      expect(DECK_GROUPS).toContain(d.group);
      expect(['freq', 'cefr', 'tag']).toContain(d.auto.by);
    }
  });
  it('covers all three deck types', () => {
    expect(AUTO_DECKS.some((d) => d.auto.by === 'freq')).toBe(true);
    expect(AUTO_DECKS.some((d) => d.auto.by === 'cefr')).toBe(true);
    expect(AUTO_DECKS.some((d) => d.auto.by === 'tag')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/de/autoDecks.test.js`
Expected: FAIL — cannot resolve `./autoDecks`.

- [ ] **Step 3: Implement**

Create `src/packs/de/autoDecks.js`:

```js
// Auto decks: views over the imported lexicon, resolved lazily by lexiconStore.
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics'];

export const AUTO_DECKS = [
  { id: 'core-100', name: 'Core 100', icon: '⭐', group: 'Frequency', auto: { by: 'freq', range: [1, 100] } },
  { id: 'top-500', name: 'Top 500', icon: '🔝', group: 'Frequency', auto: { by: 'freq', range: [1, 500] } },
  { id: 'cefr-a1', name: 'A1', icon: '🟢', group: 'CEFR', auto: { by: 'cefr', level: 'A1' } },
  { id: 'cefr-a2', name: 'A2', icon: '🔵', group: 'CEFR', auto: { by: 'cefr', level: 'A2' } },
  { id: 'cefr-b1', name: 'B1', icon: '🟣', group: 'CEFR', auto: { by: 'cefr', level: 'B1' } },
  { id: 'tag-food', name: 'Food', icon: '🍞', group: 'Topics', auto: { by: 'tag', tag: 'food' } },
  { id: 'tag-travel', name: 'Travel', icon: '✈', group: 'Topics', auto: { by: 'tag', tag: 'travel' } },
  { id: 'tag-home', name: 'Home', icon: '🏠', group: 'Topics', auto: { by: 'tag', tag: 'home' } },
  { id: 'tag-people', name: 'People', icon: '🧑', group: 'Topics', auto: { by: 'tag', tag: 'people' } },
  { id: 'tag-work', name: 'Work', icon: '💼', group: 'Topics', auto: { by: 'tag', tag: 'work' } },
  { id: 'tag-body', name: 'Body', icon: '✋', group: 'Topics', auto: { by: 'tag', tag: 'body' } },
  { id: 'tag-nature', name: 'Nature', icon: '🌳', group: 'Topics', auto: { by: 'tag', tag: 'nature' } },
  { id: 'tag-time', name: 'Time', icon: '⏰', group: 'Topics', auto: { by: 'tag', tag: 'time' } },
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/de/autoDecks.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packs/de/autoDecks.js src/packs/de/autoDecks.test.js
git commit -m "feat(packs): frequency/cefr/topical auto-deck definitions"
```

---

## Task 13: VocabTab — grouped deck list + async deck loading

**Files:**
- Modify: `src/components/VocabTab.jsx`
- Test: `src/components/VocabTab.test.jsx`

**Interfaces:**
- Consumes: `AUTO_DECKS`, `DECK_GROUPS` from `../packs/de/autoDecks`; `resolveAutoDeck` from `../packs/lexiconStore`; existing curated `PRESET_DECKS` alias.
- Produces: the deck selector lists curated decks (group "Curated") plus the auto decks grouped by `DECK_GROUPS`. Selecting an auto deck sets `activeDeck` from an async fetch with a **loading** state and an **error** state (retry). Curated decks remain synchronous. SRS/queue logic unchanged (operates on whatever `activeDeck` array is current).

- [ ] **Step 1: Add async deck state + loader (implementation)**

In `src/components/VocabTab.jsx`:

1. Add imports near the other pack imports (no extension):
```js
import { AUTO_DECKS, DECK_GROUPS } from '../packs/de/autoDecks';
import { resolveAutoDeck } from '../packs/lexiconStore';
```
2. Add state for async decks, near the other `useState` calls:
```js
  const [asyncDeck, setAsyncDeck] = useState(null); // resolved card[] for an auto deck
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState(false);
```
3. Replace the `activeDeck` derivation so an auto deck (id present in AUTO_DECKS) uses `asyncDeck`:
```js
  const isAuto = AUTO_DECKS.some((d) => d.id === deckId);
  const activeDeck =
    deckId === 'custom' && customCards
      ? customCards
      : isAuto
        ? asyncDeck || []
        : PRESET_DECKS[deckId] || [];
```
4. Add an effect that loads an auto deck when selected:
```js
  useEffect(() => {
    const def = AUTO_DECKS.find((d) => d.id === deckId);
    if (!def) return;
    let cancelled = false;
    setDeckLoading(true);
    setDeckError(false);
    setAsyncDeck(null);
    resolveAutoDeck(def)
      .then((cards) => {
        if (!cancelled) setAsyncDeck(cards);
      })
      .catch(() => {
        if (!cancelled) setDeckError(true);
      })
      .finally(() => {
        if (!cancelled) setDeckLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId]);
```
5. In the right-hand column, before the `{card && (…)}` block, add loading/error UI:
```jsx
          {isAuto && deckLoading && (
            <div style={{ padding: SPACE[8], textAlign: 'center', fontFamily: FONTS.mono, color: COLORS.mute }}>
              Loading deck…
            </div>
          )}
          {isAuto && deckError && (
            <div style={{ padding: SPACE[8], textAlign: 'center', fontFamily: FONTS.mono, color: COLORS.red }}>
              Could not load this deck.{' '}
              <button type="button" onClick={() => setDeckId(deckId)} style={{ textDecoration: 'underline' }}>
                Retry
              </button>
            </div>
          )}
```
6. Render the grouped auto-deck buttons in the left column under the existing preset list. After the preset decks `</div>` block (the one closing the curated list), add a grouped section:
```jsx
          {DECK_GROUPS.filter((g) => g !== 'Curated').map((group) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <SectionLabel num="" text={group} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AUTO_DECKS.filter((d) => d.group === group).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDeckId(d.id)}
                    aria-pressed={deckId === d.id}
                    style={{
                      padding: '8px 12px',
                      background: deckId === d.id ? COLORS.ink : COLORS.card,
                      color: deckId === d.id ? COLORS.paper : COLORS.ink,
                      border: 'none',
                      borderRadius: RADIUS.md,
                      fontFamily: FONTS.display,
                      fontSize: FONT_SIZE.base,
                      cursor: 'pointer',
                    }}
                  >
                    {d.icon} {d.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
```

> Note: `SectionLabel` is already imported in this file. If it requires a non-empty `num`, pass `num={group[0]}` instead of `num=""` — match its actual prop contract (check `./UI`).

- [ ] **Step 2: Write the test**

Add to `src/components/VocabTab.test.jsx` (mirror the file's existing harness; mock `fetch` like `lexiconStore.test.js` does, importing the sample JSON):

```jsx
import indexJson from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';
import { __resetCache } from '../packs/lexiconStore';

describe('auto deck loading', () => {
  beforeEach(() => {
    __resetCache();
    const fixtures = {
      '/lexicon/index.json': indexJson,
      '/lexicon/chunk-00.json': chunk0,
      '/lexicon/chunk-01.json': chunk1,
    };
    globalThis.fetch = vi.fn((url) => {
      const key = Object.keys(fixtures).find((k) => String(url).endsWith(k));
      return key
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) })
        : Promise.resolve({ ok: false, status: 404 });
    });
  });

  it('loads a Topics deck and shows its cards', async () => {
    const user = userEvent.setup();
    render(<VocabTab level="a1" learnedWords={{}} markLearned={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Food/i }));
    // first food card by rank is n:wasser → display "das Wasser"
    expect(await screen.findByText('das Wasser')).toBeInTheDocument();
  });
});
```

> Ensure `vi`, `userEvent`, `screen`, `render`, `beforeEach`, `describe`, `it`, `expect` are imported as the existing tests in this file do.

- [ ] **Step 3: Run the focused test**

Run: `npx vitest run src/components/VocabTab.test.jsx`
Expected: PASS (loading resolves to the card). If queue ordering hides the first card, assert on any card known to be in the deck.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/VocabTab.jsx src/components/VocabTab.test.jsx
git commit -m "feat(vocab): grouped deck list + async auto-deck loading"
```

---

## Task 14: PWA runtime caching + licensing/docs

**Files:**
- Modify: `vite.config.js:14-19`
- Create: `CONTENT_LICENSE.md`
- Modify: `README.md`
- Modify: `src/components/VocabTab.jsx` (one-line attribution under the deck area)
- Test: `src/packs/contentLicense.test.js`

**Interfaces:**
- Produces: Workbox runtime-caching for `/lexicon/*.json`; a `CONTENT_LICENSE.md` documenting CC BY-SA (Wiktionary) + CC BY (Tatoeba/Leipzig) with attribution; a README "Importing vocabulary" section; an in-app attribution line.

- [ ] **Step 1: Write the failing test (docs presence guard)**

Create `src/packs/contentLicense.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('CONTENT_LICENSE.md', () => {
  it('documents the three sources and their licenses', () => {
    const txt = readFileSync(new URL('../../CONTENT_LICENSE.md', import.meta.url), 'utf8');
    expect(txt).toMatch(/CC BY-SA 4\.0/);
    expect(txt).toMatch(/Wiktionary/);
    expect(txt).toMatch(/Tatoeba/);
    expect(txt).toMatch(/Leipzig/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/packs/contentLicense.test.js`
Expected: FAIL — file not found.

- [ ] **Step 3: Create `CONTENT_LICENSE.md`**

```markdown
# Content licensing

The app **code** is MIT (see LICENSE). The imported **vocabulary content** under
`public/lexicon/` is derived from third-party datasets and carries their licenses:

## Wiktionary (via Wiktextract / kaikki.org) — CC BY-SA 4.0
Word data (lemmas, gender, plural, IPA, glosses, part of speech) is derived from
the English Wiktionary, licensed **CC BY-SA 4.0**
(https://creativecommons.org/licenses/by-sa/4.0/). The lexicon content subset is
redistributed under the same license. Source: Wiktextract, https://kaikki.org.

## Tatoeba — CC BY 2.0 FR
Example sentences are from the Tatoeba Project (https://tatoeba.org), licensed
**CC BY 2.0 FR** (https://creativecommons.org/licenses/by/2.0/fr/).

## Leipzig Corpora Collection — CC BY
Word-frequency ordering is derived from the Leipzig Corpora Collection
(https://wortschatz.uni-leipzig.de), licensed **CC BY**.

Attribution is also surfaced in-app in the vocabulary section.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/packs/contentLicense.test.js`
Expected: PASS.

- [ ] **Step 5: Add Workbox runtime caching**

In `vite.config.js`, change the `workbox` block to add `runtimeCaching` (keep `globPatterns`, `navigateFallback`, `navigateFallbackDenylist`):

```js
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/lexicon\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lexicon-json',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
```

- [ ] **Step 6: Add the README section + in-app attribution**

In `README.md`, add a section "## Importing vocabulary" describing: `npm run import:lexicon`, the pinned source URLs (from `scripts/import-lexicon/download.js`'s `SOURCES`), the decompress/prep step for Tatoeba/Leipzig, that output lands in `public/lexicon/`, and the CC BY-SA note (link `CONTENT_LICENSE.md`).

In `src/components/VocabTab.jsx`, add a small attribution line at the bottom of the deck/left column:

```jsx
          <div style={{ marginTop: 12, fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
            Vocabulary from Wiktionary (CC BY-SA), Tatoeba & Leipzig (CC BY).
          </div>
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add vite.config.js CONTENT_LICENSE.md README.md src/components/VocabTab.jsx src/packs/contentLicense.test.js
git commit -m "feat(lexicon): PWA caching for chunks + content licensing/attribution"
```

---

## Self-Review

**Spec coverage:**
- §1 Artifact contract → Task 7 (builder) + Task 9 (sample) + Task 11 (consumer).
- §2 ID scheme (deterministic homographs) → Task 1.
- §3 Pipeline modules → Tasks 1–8.
- §4 Runtime async loading + PWA caching → Tasks 11, 14.
- §5 UI loading/error/grouped decks → Task 13.
- §6 Licensing/docs → Task 14.
- §7 Testing → fixture/mocked-fetch tests across Tasks 1–13.
- Decks (freq/cefr/topical) → Task 12 + resolver tag support Task 10.
- CEFR bands → Task 1 (`cefrForRank`).

**Placeholder scan:** Pipeline `read*` helpers in Task 8 and the parser field paths in Task 2 are explicitly flagged as the "develop against real data" seam (the user runs the import locally); the pure modules they wire are fully tested. No `TBD`/`TODO`/"handle edge cases" placeholders. Source dump versions in `manifest.sources` are filled at import time by design.

**Type consistency:** `LexiconEntry` fields match Phase B's `validateLexiconEntry` and `resolveCard` across Tasks 5, 9, 11. Artifact `index` row shape `{id,rank,cefr,tags,chunk}` is identical in Tasks 7, 9, 11. `auto` rule shapes (`{by:'freq',range}`,`{by:'cefr',level}`,`{by:'tag',tag}`) match across Tasks 10, 11, 12, 13. Chunk filename `chunk-NN.json` (2-digit pad) consistent in Tasks 7, 9, 11.

## Notes / risks for the implementer
- **Wiktextract field paths (Task 2)** and **decompress/prep of Tatoeba+Leipzig (Task 8)** are the only spots that depend on real external data shapes — confirm against a small real sample before the full local run; adjust only those modules.
- Verbs ship with `verb:null` and are dropped by the filter (no conjugation import in Phase A) — that's intentional; a verb-conjugation pass is a follow-up.
- The committed `public/lexicon/` SAMPLE is overwritten when the user runs the real import; the sample tests assert schema/shape, not specific words, except `lexiconStore.test.js`/`VocabTab` which key off sample ids — regenerate or update those if the sample is replaced before the real run.
- `npm test` runs the full suite (~3 min) per commit via the pre-commit hook.
