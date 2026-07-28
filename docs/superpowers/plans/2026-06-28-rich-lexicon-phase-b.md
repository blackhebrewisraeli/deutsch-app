# Rich Lexicon — Phase B (Structure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a normalized rich-word **lexicon** + **decks-as-views** behind a resolver, migrate today's 40 curated cards into it, and surface the new fields in `VocabTab` — without changing the array-of-cards shape consumers depend on or breaking SRS history.

**Architecture:** A `LEXICON` object (id → rich `LexiconEntry`) and a `DECKS` object (deck → `cardIds` or an `auto` rule) live in the German pack. A language-agnostic `resolve.js` joins them into the exact `[{ de, en, ipa, id, … }]` arrays that `VocabTab`, `VocabSrsWidget`, and `App.jsx` SRS already consume. Migrated entries keep their **surface-form ids** (`"das Brot"`) so SRS progress survives; new fields ride along on each resolved card.

**Tech Stack:** Vanilla ES modules, React (function components), Vitest + Testing Library, ESLint/Prettier (enforced by `.husky/pre-commit` → `lint-staged` + `npm test`).

## Global Constraints

- **Never bypass `.husky/pre-commit`.** Each commit runs `lint-staged` + full `npm test` (~3 min). Work on the branch `feat/rich-lexicon-import`; land via PR.
- **Consumer shape is frozen:** `activePack.content.decks[deckId]` MUST remain an object keyed by deckId whose values are arrays of card objects exposing at least `{ de, en, ipa, id }`. `de` is the **display** form (`"das Brot"`), `en` is a **string** (primary gloss), `id` is a **string**.
- **SRS continuity:** the 4 migrated decks (`greetings`, `food`, `travel`, `numbers`) keep their current ids = the current surface form (`card.de` today). Do not rekey them.
- **No network at runtime** for content. Lexicon is static module data in this phase.
- **Phase B authors structure, not bulk content.** `examples` is OPTIONAL in Phase B validation (empty array allowed). The ≥1-example *import filter* is Phase A only.
- ESM imports in `src/` use no file extension (Vite resolves them); this is browser/Vite code, not `api/` serverless code.

## File Structure

- Create `src/packs/de/lexicon.js` — `LEXICON`: the 40 migrated rich entries, keyed by id.
- Create `src/packs/de/decks.js` — `DECKS`: deck definitions referencing lexicon ids.
- Create `src/packs/resolve.js` — language-agnostic `resolveCard` / `resolveDeck` / `resolveDecks`.
- Create `src/packs/resolve.test.js` — resolver unit tests.
- Create `src/packs/de/lexicon.test.js` — lexicon data-shape + validator tests.
- Modify `src/packs/validate.js` — add `validateLexiconEntry` + enums.
- Modify `src/packs/validate.test.js` — tests for `validateLexiconEntry`.
- Modify `src/packs/de/index.js` — wire `content.decks` via resolver; expose `lexicon` + `deckDefs`.
- Modify `src/packs/packs.test.js` — update the wiring test to the new model.
- Modify `src/data/content.js` — remove `PRESET_DECKS` (superseded).
- Modify `src/data/content.test.js` — remove the `PRESET_DECKS` describe block.
- Modify `src/components/VocabTab.jsx` — render plural + first example on the card face.
- Modify `src/components/VocabTab.test.jsx` — assert plural/example render.

---

## Task 1: `validateLexiconEntry` schema validator

**Files:**
- Modify: `src/packs/validate.js`
- Test: `src/packs/validate.test.js`

**Interfaces:**
- Produces: `validateLexiconEntry(entry) => true` (throws `Error` with a message naming the first violation). Exported constants `POS` (string[]), `ARTICLES = ['der','die','das']`, `CEFR = ['A1','A2','B1']`.
- The `LexiconEntry` shape it enforces:
  ```js
  {
    id: string,                       // non-empty
    de: string,                       // non-empty (lemma/headword)
    en: string[],                     // length >= 1, each non-empty
    pos: one of POS,
    article: null | 'der'|'die'|'das',// required (non-null) when pos==='noun'
    ipa: null | string,
    plural: null | string,
    cefr: null | 'A1'|'A2'|'B1',
    freqRank: null | number(>0),
    tags: string[],                   // may be empty
    examples: Array<{de,en,source}>,  // may be empty; each de/en/source non-empty
    verb: null | { aux:'haben'|'sein', partizip2:string, present:{ich,du,er,wir,ihr,sie} },
                                      // required (non-null) when pos==='verb'
    source: { dict:string, license:string, sentences?:string }
  }
  ```
  `POS = ['noun','verb','adj','adv','prep','num','phrase','pron','conj']`.

- [x] **Step 1: Write the failing tests**

Append to `src/packs/validate.test.js`:

```js
import {
  validateLexiconEntry,
  POS,
  ARTICLES,
  CEFR,
} from './validate';

const validNoun = {
  id: 'das Brot',
  de: 'Brot',
  en: ['bread'],
  pos: 'noun',
  article: 'das',
  ipa: '[das bʁoːt]',
  plural: 'Brote',
  cefr: 'A1',
  freqRank: null,
  tags: ['food'],
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'authored' }],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};

const validPhrase = {
  id: 'Hallo',
  de: 'Hallo',
  en: ['hello'],
  pos: 'phrase',
  article: null,
  ipa: '[ˈhalo]',
  plural: null,
  cefr: 'A1',
  freqRank: null,
  tags: ['greetings'],
  examples: [],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};

describe('validateLexiconEntry', () => {
  it('exports POS/ARTICLES/CEFR enums', () => {
    expect(POS).toContain('noun');
    expect(ARTICLES).toEqual(['der', 'die', 'das']);
    expect(CEFR).toEqual(['A1', 'A2', 'B1']);
  });
  it('returns true for a well-formed noun entry', () => {
    expect(validateLexiconEntry(validNoun)).toBe(true);
  });
  it('returns true for a well-formed phrase with empty examples', () => {
    expect(validateLexiconEntry(validPhrase)).toBe(true);
  });
  it('throws when id is empty', () => {
    expect(() => validateLexiconEntry({ ...validNoun, id: '' })).toThrow(/id/);
  });
  it('throws when en is not a non-empty array', () => {
    expect(() => validateLexiconEntry({ ...validNoun, en: [] })).toThrow(/en/);
  });
  it('throws when pos is unknown', () => {
    expect(() => validateLexiconEntry({ ...validNoun, pos: 'xyz' })).toThrow(/pos/);
  });
  it('throws when a noun has no article', () => {
    expect(() => validateLexiconEntry({ ...validNoun, article: null })).toThrow(/article/);
  });
  it('throws when article is invalid', () => {
    expect(() => validateLexiconEntry({ ...validNoun, article: 'le' })).toThrow(/article/);
  });
  it('throws when cefr is invalid', () => {
    expect(() => validateLexiconEntry({ ...validNoun, cefr: 'C2' })).toThrow(/cefr/);
  });
  it('throws when an example is missing en', () => {
    expect(() =>
      validateLexiconEntry({ ...validNoun, examples: [{ de: 'x', source: 'authored' }] })
    ).toThrow(/example/);
  });
  it('throws when a verb entry has no verb block', () => {
    expect(() =>
      validateLexiconEntry({ ...validNoun, pos: 'verb', article: null, verb: null })
    ).toThrow(/verb/);
  });
  it('accepts a valid verb entry', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        id: 'gehen',
        de: 'gehen',
        en: ['to go'],
        pos: 'verb',
        article: null,
        plural: null,
        verb: {
          aux: 'sein',
          partizip2: 'gegangen',
          present: { ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen' },
        },
      })
    ).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/packs/validate.test.js`
Expected: FAIL — `validateLexiconEntry is not a function` / `POS` undefined.

- [x] **Step 3: Implement the validator**

Append to `src/packs/validate.js`:

```js
export const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'num', 'phrase', 'pron', 'conj'];
export const ARTICLES = ['der', 'die', 'das'];
export const CEFR = ['A1', 'A2', 'B1'];

/**
 * Asserts a value satisfies the LexiconEntry shape.
 * Throws an Error describing the first violation; returns true on success.
 * @param {object} entry
 * @returns {true}
 */
export function validateLexiconEntry(entry) {
  const fail = (msg) => {
    throw new Error(`Invalid LexiconEntry: ${msg}`);
  };
  const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

  if (!entry || typeof entry !== 'object') fail('entry must be an object');
  if (!nonEmptyStr(entry.id)) fail('id must be a non-empty string');
  if (!nonEmptyStr(entry.de)) fail('de must be a non-empty string');

  if (!Array.isArray(entry.en) || entry.en.length === 0 || !entry.en.every(nonEmptyStr)) {
    fail('en must be a non-empty array of non-empty strings');
  }

  if (!POS.includes(entry.pos)) fail(`pos must be one of ${POS.join('|')}`);

  if (entry.article !== null && !ARTICLES.includes(entry.article)) {
    fail(`article must be null or one of ${ARTICLES.join('|')}`);
  }
  if (entry.pos === 'noun' && entry.article === null) {
    fail('article is required for nouns');
  }

  if (entry.ipa !== null && typeof entry.ipa !== 'string') fail('ipa must be null or a string');
  if (entry.plural !== null && typeof entry.plural !== 'string') fail('plural must be null or a string');

  if (entry.cefr !== null && !CEFR.includes(entry.cefr)) {
    fail(`cefr must be null or one of ${CEFR.join('|')}`);
  }
  if (entry.freqRank !== null && !(typeof entry.freqRank === 'number' && entry.freqRank > 0)) {
    fail('freqRank must be null or a positive number');
  }

  if (!Array.isArray(entry.tags) || !entry.tags.every((t) => typeof t === 'string')) {
    fail('tags must be an array of strings');
  }

  if (!Array.isArray(entry.examples)) fail('examples must be an array');
  for (const ex of entry.examples) {
    if (!ex || typeof ex !== 'object') fail('each example must be an object');
    if (!nonEmptyStr(ex.de) || !nonEmptyStr(ex.en) || !nonEmptyStr(ex.source)) {
      fail('each example must have non-empty de, en, source');
    }
  }

  if (entry.verb !== null) {
    const v = entry.verb;
    if (!v || typeof v !== 'object') fail('verb must be null or an object');
    if (!['haben', 'sein'].includes(v.aux)) fail('verb.aux must be haben or sein');
    if (!nonEmptyStr(v.partizip2)) fail('verb.partizip2 must be a non-empty string');
    if (!v.present || typeof v.present !== 'object') fail('verb.present must be an object');
    for (const p of ['ich', 'du', 'er', 'wir', 'ihr', 'sie']) {
      if (!nonEmptyStr(v.present[p])) fail(`verb.present.${p} must be a non-empty string`);
    }
  }
  if (entry.pos === 'verb' && entry.verb === null) fail('verb block is required for verbs');

  if (!entry.source || typeof entry.source !== 'object') fail('source must be an object');
  if (!nonEmptyStr(entry.source.dict) || !nonEmptyStr(entry.source.license)) {
    fail('source.dict and source.license must be non-empty strings');
  }

  return true;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/packs/validate.test.js`
Expected: PASS (all cases).

- [x] **Step 5: Commit**

```bash
git add src/packs/validate.js src/packs/validate.test.js
git commit -m "feat(packs): add validateLexiconEntry schema validator"
```

---

## Task 2: German lexicon — migrate the 40 curated cards

**Files:**
- Create: `src/packs/de/lexicon.js`
- Test: `src/packs/de/lexicon.test.js`

**Interfaces:**
- Consumes: `validateLexiconEntry`, `POS` (Task 1).
- Produces: `export const LEXICON` — a plain object keyed by entry `id` → `LexiconEntry`. Ids are the legacy surface forms (`"das Brot"`, `"Hallo"`, `"eins"`). `en` is an array (first element = the legacy `en` string). `ipa` is kept identical to today's values (article included for nouns). Nouns split the article into `article` and store the bare lemma in `de`.

- [x] **Step 1: Write the failing test**

Create `src/packs/de/lexicon.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LEXICON } from './lexicon';
import { validateLexiconEntry } from '../validate';

const ids = Object.keys(LEXICON);

describe('LEXICON', () => {
  it('has 40 entries', () => {
    expect(ids).toHaveLength(40);
  });
  it('every entry key equals its entry.id', () => {
    for (const [id, entry] of Object.entries(LEXICON)) {
      expect(entry.id).toBe(id);
    }
  });
  it('every entry satisfies validateLexiconEntry', () => {
    for (const entry of Object.values(LEXICON)) {
      expect(validateLexiconEntry(entry)).toBe(true);
    }
  });
  it('noun display form (article + lemma) equals the legacy surface id', () => {
    for (const entry of Object.values(LEXICON)) {
      if (entry.pos === 'noun') {
        expect(`${entry.article} ${entry.de}`).toBe(entry.id);
      }
    }
  });
  it('non-noun entries store the surface form directly in de and id', () => {
    for (const entry of Object.values(LEXICON)) {
      if (entry.pos !== 'noun') {
        expect(entry.de).toBe(entry.id);
      }
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/packs/de/lexicon.test.js`
Expected: FAIL — cannot resolve `./lexicon`.

- [x] **Step 3: Implement the lexicon**

Create `src/packs/de/lexicon.js`. Author all 40 entries. (`source` is `{ dict: 'authored', license: 'MIT' }` for every migrated entry; these are the app's own hand-written cards, not imported.)

```js
// German lexicon — Phase B. The 40 originally-curated cards, migrated to the
// rich LexiconEntry shape. Keys are the legacy surface-form ids so SRS history
// is preserved. en values keep the legacy English string as the first gloss;
// ipa values are unchanged from the original cards.
const SRC = { dict: 'authored', license: 'MIT' };

/** @type {Record<string, object>} */
export const LEXICON = {
  // ── greetings (phrases / interjections) ──
  Hallo: { id: 'Hallo', de: 'Hallo', en: ['Hello'], pos: 'phrase', article: null, ipa: '[ˈhalo]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Guten Morgen': { id: 'Guten Morgen', de: 'Guten Morgen', en: ['Good morning'], pos: 'phrase', article: null, ipa: '[ˈɡuːtn̩ ˈmɔʁɡn̩]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Guten Tag': { id: 'Guten Tag', de: 'Guten Tag', en: ['Good day'], pos: 'phrase', article: null, ipa: '[ˈɡuːtn̩ taːk]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Guten Abend': { id: 'Guten Abend', de: 'Guten Abend', en: ['Good evening'], pos: 'phrase', article: null, ipa: '[ˈɡuːtn̩ ˈaːbn̩t]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Auf Wiedersehen': { id: 'Auf Wiedersehen', de: 'Auf Wiedersehen', en: ['Goodbye'], pos: 'phrase', article: null, ipa: '[aʊ̯f ˈviːdɐzeːən]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Tschüss': { id: 'Tschüss', de: 'Tschüss', en: ['Bye'], pos: 'phrase', article: null, ipa: '[tʃʏs]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Wie geht es dir?': { id: 'Wie geht es dir?', de: 'Wie geht es dir?', en: ['How are you?'], pos: 'phrase', article: null, ipa: '[viː ɡeːt ɛs diːɐ̯]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  'Mir geht es gut': { id: 'Mir geht es gut', de: 'Mir geht es gut', en: ["I'm well"], pos: 'phrase', article: null, ipa: '[miːɐ̯ ɡeːt ɛs ɡuːt]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  Bitte: { id: 'Bitte', de: 'Bitte', en: ['Please'], pos: 'phrase', article: null, ipa: '[ˈbɪtə]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },
  Danke: { id: 'Danke', de: 'Danke', en: ['Thank you'], pos: 'phrase', article: null, ipa: '[ˈdaŋkə]', plural: null, cefr: 'A1', freqRank: null, tags: ['greetings'], examples: [], verb: null, source: SRC },

  // ── food (nouns) ──
  'das Brot': { id: 'das Brot', de: 'Brot', en: ['bread'], pos: 'noun', article: 'das', ipa: '[das bʁoːt]', plural: 'Brote', cefr: 'A1', freqRank: null, tags: ['food'], examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'authored' }], verb: null, source: SRC },
  'der Käse': { id: 'der Käse', de: 'Käse', en: ['cheese'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈkɛːzə]', plural: 'Käse', cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'das Wasser': { id: 'das Wasser', de: 'Wasser', en: ['water'], pos: 'noun', article: 'das', ipa: '[das ˈvasɐ]', plural: 'Wässer', cefr: 'A1', freqRank: null, tags: ['food'], examples: [{ de: 'Ich trinke Wasser.', en: 'I drink water.', source: 'authored' }], verb: null, source: SRC },
  'der Apfel': { id: 'der Apfel', de: 'Apfel', en: ['apple'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈapfl̩]', plural: 'Äpfel', cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'das Fleisch': { id: 'das Fleisch', de: 'Fleisch', en: ['meat'], pos: 'noun', article: 'das', ipa: '[das flaɪ̯ʃ]', plural: null, cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'der Kaffee': { id: 'der Kaffee', de: 'Kaffee', en: ['coffee'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈkafe]', plural: 'Kaffees', cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'die Milch': { id: 'die Milch', de: 'Milch', en: ['milk'], pos: 'noun', article: 'die', ipa: '[diː mɪlç]', plural: null, cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'das Bier': { id: 'das Bier', de: 'Bier', en: ['beer'], pos: 'noun', article: 'das', ipa: '[das biːɐ̯]', plural: 'Biere', cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'die Suppe': { id: 'die Suppe', de: 'Suppe', en: ['soup'], pos: 'noun', article: 'die', ipa: '[diː ˈzʊpə]', plural: 'Suppen', cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },
  'der Zucker': { id: 'der Zucker', de: 'Zucker', en: ['sugar'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈtsʊkɐ]', plural: null, cefr: 'A1', freqRank: null, tags: ['food'], examples: [], verb: null, source: SRC },

  // ── travel ──
  'der Bahnhof': { id: 'der Bahnhof', de: 'Bahnhof', en: ['train station'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈbaːnhoːf]', plural: 'Bahnhöfe', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'der Flughafen': { id: 'der Flughafen', de: 'Flughafen', en: ['airport'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈfluːkhaːfn̩]', plural: 'Flughäfen', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'das Hotel': { id: 'das Hotel', de: 'Hotel', en: ['hotel'], pos: 'noun', article: 'das', ipa: '[das hoˈtɛl]', plural: 'Hotels', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'die Karte': { id: 'die Karte', de: 'Karte', en: ['map / ticket'], pos: 'noun', article: 'die', ipa: '[diː ˈkaʁtə]', plural: 'Karten', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'der Koffer': { id: 'der Koffer', de: 'Koffer', en: ['suitcase'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ ˈkɔfɐ]', plural: 'Koffer', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'der Pass': { id: 'der Pass', de: 'Pass', en: ['passport'], pos: 'noun', article: 'der', ipa: '[deːɐ̯ pas]', plural: 'Pässe', cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  links: { id: 'links', de: 'links', en: ['left'], pos: 'adv', article: null, ipa: '[lɪŋks]', plural: null, cefr: 'A1', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  rechts: { id: 'rechts', de: 'rechts', en: ['right'], pos: 'adv', article: null, ipa: '[ʁɛçts]', plural: null, cefr: 'A1', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  geradeaus: { id: 'geradeaus', de: 'geradeaus', en: ['straight ahead'], pos: 'adv', article: null, ipa: '[ɡəˈʁaːdəˌʔaʊ̯s]', plural: null, cefr: 'A2', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },
  'Wo ist...?': { id: 'Wo ist...?', de: 'Wo ist...?', en: ['Where is...?'], pos: 'phrase', article: null, ipa: '[voː ɪst]', plural: null, cefr: 'A1', freqRank: null, tags: ['travel'], examples: [], verb: null, source: SRC },

  // ── numbers (numerals) ──
  eins: { id: 'eins', de: 'eins', en: ['one'], pos: 'num', article: null, ipa: '[aɪ̯ns]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  zwei: { id: 'zwei', de: 'zwei', en: ['two'], pos: 'num', article: null, ipa: '[t͡svaɪ̯]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  drei: { id: 'drei', de: 'drei', en: ['three'], pos: 'num', article: null, ipa: '[dʁaɪ̯]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  vier: { id: 'vier', de: 'vier', en: ['four'], pos: 'num', article: null, ipa: '[fiːɐ̯]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  'fünf': { id: 'fünf', de: 'fünf', en: ['five'], pos: 'num', article: null, ipa: '[fʏnf]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  sechs: { id: 'sechs', de: 'sechs', en: ['six'], pos: 'num', article: null, ipa: '[zɛks]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  sieben: { id: 'sieben', de: 'sieben', en: ['seven'], pos: 'num', article: null, ipa: '[ˈziːbn̩]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  acht: { id: 'acht', de: 'acht', en: ['eight'], pos: 'num', article: null, ipa: '[axt]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  neun: { id: 'neun', de: 'neun', en: ['nine'], pos: 'num', article: null, ipa: '[nɔɪ̯n]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
  zehn: { id: 'zehn', de: 'zehn', en: ['ten'], pos: 'num', article: null, ipa: '[t͡seːn]', plural: null, cefr: 'A1', freqRank: null, tags: ['numbers'], examples: [], verb: null, source: SRC },
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/packs/de/lexicon.test.js`
Expected: PASS (40 entries, all valid, display/id invariants hold).

- [x] **Step 5: Commit**

```bash
git add src/packs/de/lexicon.js src/packs/de/lexicon.test.js
git commit -m "feat(packs): migrate 40 curated cards into rich German lexicon"
```

---

## Task 3: Deck definitions (decks-as-views)

**Files:**
- Create: `src/packs/de/decks.js`
- Test: extend `src/packs/de/lexicon.test.js`

**Interfaces:**
- Consumes: `LEXICON` ids (Task 2).
- Produces: `export const DECKS` — object keyed by deckId. Curated decks: `{ name, icon, cardIds: string[] }`. (Auto decks like `{ name, icon, auto: { by, range } }` are SUPPORTED by the resolver in Task 4 but none are shipped in Phase B — there is no frequency data yet.) Deck order and ids reproduce today's 4 decks exactly.

- [x] **Step 1: Write the failing test**

Append to `src/packs/de/lexicon.test.js`:

```js
import { DECKS } from './decks';

describe('DECKS', () => {
  it('has the 4 legacy decks in order', () => {
    expect(Object.keys(DECKS)).toEqual(['greetings', 'food', 'travel', 'numbers']);
  });
  it('each curated deck has 10 cardIds, all resolvable in LEXICON', () => {
    for (const def of Object.values(DECKS)) {
      expect(def.cardIds).toHaveLength(10);
      for (const id of def.cardIds) {
        expect(LEXICON[id]).toBeDefined();
      }
    }
  });
  it('every deck has a name and icon', () => {
    for (const def of Object.values(DECKS)) {
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.icon).toBe('string');
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/packs/de/lexicon.test.js`
Expected: FAIL — cannot resolve `./decks`.

- [x] **Step 3: Implement the deck definitions**

Create `src/packs/de/decks.js`:

```js
// Deck definitions: ordered views over the lexicon. Curated decks list the
// lexicon ids they include; the resolver joins them into card arrays.
export const DECKS = {
  greetings: {
    name: 'Greetings',
    icon: '👋',
    cardIds: [
      'Hallo', 'Guten Morgen', 'Guten Tag', 'Guten Abend', 'Auf Wiedersehen',
      'Tschüss', 'Wie geht es dir?', 'Mir geht es gut', 'Bitte', 'Danke',
    ],
  },
  food: {
    name: 'Food & Drink',
    icon: '🍞',
    cardIds: [
      'das Brot', 'der Käse', 'das Wasser', 'der Apfel', 'das Fleisch',
      'der Kaffee', 'die Milch', 'das Bier', 'die Suppe', 'der Zucker',
    ],
  },
  travel: {
    name: 'Travel',
    icon: '✈',
    cardIds: [
      'der Bahnhof', 'der Flughafen', 'das Hotel', 'die Karte', 'der Koffer',
      'der Pass', 'links', 'rechts', 'geradeaus', 'Wo ist...?',
    ],
  },
  numbers: {
    name: 'Numbers',
    icon: '🔢',
    cardIds: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'],
  },
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/packs/de/lexicon.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/packs/de/decks.js src/packs/de/lexicon.test.js
git commit -m "feat(packs): add German deck definitions as lexicon views"
```

---

## Task 4: Resolver — lexicon + deck defs → card arrays

**Files:**
- Create: `src/packs/resolve.js`
- Test: `src/packs/resolve.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (pure functions over its arguments).
- Produces:
  - `resolveCard(entry) => { id, de, en, ipa, article, plural, pos, cefr, tags, freqRank, examples, verb, glosses }`
    - `de` = `entry.article ? `${entry.article} ${entry.de}` : entry.de` (display form)
    - `en` = `entry.en[0]` (string — what existing consumers read)
    - `glosses` = `entry.en` (full array, for future use)
    - all other rich fields passed through unchanged
  - `resolveDeck(deckDef, lexicon) => resolvedCard[]`
    - if `deckDef.cardIds`: map each id → `lexicon[id]`; throw `Error` naming a missing id; then `resolveCard`
    - if `deckDef.auto`: filter `Object.values(lexicon)` by the rule, then `resolveCard`:
      - `auto.by === 'freq'`: keep entries with `freqRank` inside `[auto.range[0], auto.range[1]]` (inclusive), sorted ascending by `freqRank`
      - `auto.by === 'cefr'`: keep entries with `entry.cefr === auto.level`
    - throw if `deckDef` has neither `cardIds` nor a recognized `auto.by`
  - `resolveDecks(deckDefs, lexicon) => Record<deckId, resolvedCard[]>`

- [x] **Step 1: Write the failing test**

Create `src/packs/resolve.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveCard, resolveDeck, resolveDecks } from './resolve';

const noun = {
  id: 'das Brot', de: 'Brot', en: ['bread', 'loaf'], pos: 'noun', article: 'das',
  ipa: '[das bʁoːt]', plural: 'Brote', cefr: 'A1', freqRank: 5, tags: ['food'],
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'authored' }],
  verb: null, source: { dict: 'authored', license: 'MIT' },
};
const phrase = {
  id: 'Hallo', de: 'Hallo', en: ['Hello'], pos: 'phrase', article: null,
  ipa: '[ˈhalo]', plural: null, cefr: 'A1', freqRank: 100, tags: ['greetings'],
  examples: [], verb: null, source: { dict: 'authored', license: 'MIT' },
};
const lexicon = { 'das Brot': noun, Hallo: phrase };

describe('resolveCard', () => {
  it('composes noun display form from article + lemma', () => {
    expect(resolveCard(noun).de).toBe('das Brot');
  });
  it('leaves non-noun de unchanged', () => {
    expect(resolveCard(phrase).de).toBe('Hallo');
  });
  it('exposes en as the primary gloss string and glosses as the full array', () => {
    const c = resolveCard(noun);
    expect(c.en).toBe('bread');
    expect(c.glosses).toEqual(['bread', 'loaf']);
  });
  it('preserves the id and rich fields', () => {
    const c = resolveCard(noun);
    expect(c.id).toBe('das Brot');
    expect(c.plural).toBe('Brote');
    expect(c.examples).toEqual(noun.examples);
  });
});

describe('resolveDeck', () => {
  it('resolves a curated deck by cardIds, preserving order', () => {
    const cards = resolveDeck({ cardIds: ['Hallo', 'das Brot'] }, lexicon);
    expect(cards.map((c) => c.id)).toEqual(['Hallo', 'das Brot']);
    expect(cards.map((c) => c.de)).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on a missing cardId', () => {
    expect(() => resolveDeck({ cardIds: ['nope'] }, lexicon)).toThrow(/nope/);
  });
  it('resolves an auto freq-band deck sorted by freqRank', () => {
    const cards = resolveDeck({ auto: { by: 'freq', range: [1, 50] } }, lexicon);
    expect(cards.map((c) => c.id)).toEqual(['das Brot']); // freqRank 5 in [1,50]; Hallo 100 excluded
  });
  it('resolves an auto cefr deck', () => {
    const cards = resolveDeck({ auto: { by: 'cefr', level: 'A1' } }, lexicon);
    expect(cards.map((c) => c.id).sort()).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on an unrecognized deck def', () => {
    expect(() => resolveDeck({}, lexicon)).toThrow();
  });
});

describe('resolveDecks', () => {
  it('resolves every deck in a map', () => {
    const out = resolveDecks({ a: { cardIds: ['Hallo'] } }, lexicon);
    expect(out.a.map((c) => c.id)).toEqual(['Hallo']);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: FAIL — cannot resolve `./resolve`.

- [x] **Step 3: Implement the resolver**

Create `src/packs/resolve.js`:

```js
// Language-agnostic resolution of lexicon + deck definitions into the
// array-of-cards shape the UI and SRS consume.

/** @param {object} entry LexiconEntry @returns {object} resolved card */
export function resolveCard(entry) {
  return {
    id: entry.id,
    de: entry.article ? `${entry.article} ${entry.de}` : entry.de,
    en: entry.en[0],
    glosses: entry.en,
    ipa: entry.ipa,
    article: entry.article,
    plural: entry.plural,
    pos: entry.pos,
    cefr: entry.cefr,
    tags: entry.tags,
    freqRank: entry.freqRank,
    examples: entry.examples,
    verb: entry.verb,
  };
}

/**
 * @param {object} deckDef { cardIds } | { auto: { by, range?, level? } }
 * @param {Record<string, object>} lexicon
 * @returns {object[]}
 */
export function resolveDeck(deckDef, lexicon) {
  if (Array.isArray(deckDef.cardIds)) {
    return deckDef.cardIds.map((id) => {
      const entry = lexicon[id];
      if (!entry) throw new Error(`resolveDeck: unknown cardId "${id}"`);
      return resolveCard(entry);
    });
  }
  if (deckDef.auto) {
    const all = Object.values(lexicon);
    if (deckDef.auto.by === 'freq') {
      const [min, max] = deckDef.auto.range;
      return all
        .filter((e) => e.freqRank !== null && e.freqRank >= min && e.freqRank <= max)
        .sort((a, b) => a.freqRank - b.freqRank)
        .map(resolveCard);
    }
    if (deckDef.auto.by === 'cefr') {
      return all.filter((e) => e.cefr === deckDef.auto.level).map(resolveCard);
    }
    throw new Error(`resolveDeck: unknown auto.by "${deckDef.auto.by}"`);
  }
  throw new Error('resolveDeck: deckDef needs cardIds or auto');
}

/**
 * @param {Record<string, object>} deckDefs
 * @param {Record<string, object>} lexicon
 * @returns {Record<string, object[]>}
 */
export function resolveDecks(deckDefs, lexicon) {
  return Object.fromEntries(
    Object.entries(deckDefs).map(([id, def]) => [id, resolveDeck(def, lexicon)])
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/packs/resolve.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/packs/resolve.js src/packs/resolve.test.js
git commit -m "feat(packs): add lexicon/deck resolver"
```

---

## Task 5: Wire the pack to the resolver; retire `PRESET_DECKS`

**Files:**
- Modify: `src/packs/de/index.js`
- Modify: `src/packs/packs.test.js`
- Modify: `src/data/content.js`
- Modify: `src/data/content.test.js`

**Interfaces:**
- Consumes: `LEXICON` (Task 2), `DECKS` (Task 3), `resolveDecks` (Task 4).
- Produces: `activePack.content.decks` is now `resolveDecks(DECKS, LEXICON)` (object keyed by deckId → resolved card arrays). Also exposes `activePack.content.lexicon = LEXICON` and `activePack.content.deckDefs = DECKS`. `cardId` unchanged (`(card) => card.de`, used for custom AI decks).

- [x] **Step 1: Update the pack wiring**

In `src/packs/de/index.js`, remove the `PRESET_DECKS` import and the `tagDeck`/`tagDecks`/`tagDecks(PRESET_DECKS)` machinery, and wire the resolver. The file becomes:

```js
// German LanguagePack. Content is assembled from the rich lexicon + deck
// definitions via the resolver; alphabet/scenarios/chat/translate still come
// straight from content.js.
import {
  ALPHABET,
  ALPHABET_QUIZ_GROUPS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../data/content';
import { LEXICON } from './lexicon';
import { DECKS } from './decks';
import { resolveDecks } from '../resolve';

// Card identity for German: the surface form is the stable id.
const cardId = (card) => card.de;

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
    lexicon: LEXICON,
    deckDefs: DECKS,
    decks: resolveDecks(DECKS, LEXICON),
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

- [x] **Step 2: Update `packs.test.js`**

In `src/packs/packs.test.js`, replace the `PRESET_DECKS` import and the wiring test that referenced it. Change the import block at the top to drop `PRESET_DECKS`:

```js
import {
  ALPHABET,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  ALPHABET_QUIZ_GROUPS,
} from '../data/content';
import { LEXICON } from './de/lexicon';
import { DECKS } from './de/decks';
```

Replace the `it('wires content straight from content.js …')` test with:

```js
  it('wires alphabet/scenarios/chat straight from content.js', () => {
    expect(activePack.content.alphabet).toBe(ALPHABET);
    expect(activePack.content.scenarios).toBe(SCENARIOS);
    expect(activePack.content.chatTasks).toBe(CHAT_TASKS);
    expect(activePack.content.alphabetQuiz).toBe(ALPHABET_QUIZ_GROUPS);
    expect(activePack.content.translateSentences.A1).toBe(TRANSLATE_SENTENCES_A1);
  });
  it('resolves decks from the lexicon + deck defs', () => {
    expect(Object.keys(activePack.content.decks)).toEqual(Object.keys(DECKS));
    expect(activePack.content.lexicon).toBe(LEXICON);
    expect(activePack.content.deckDefs).toBe(DECKS);
  });
  it('preserves legacy surface-form ids on resolved cards (SRS continuity)', () => {
    const food = activePack.content.decks.food;
    expect(food[0].id).toBe('das Brot');
    expect(food[0].de).toBe('das Brot'); // display form
    expect(food[0].en).toBe('bread'); // primary gloss as a string
  });
```

In the `cardId + tagged decks` describe block, update the second test (the deck cards no longer have `id === de` for nouns, since `de` is now the display form while `id` is also the display form — they DO still match for these legacy decks). Keep:

```js
  it('preset deck cards carry an id equal to the display de', () => {
    const card = activePack.content.decks.greetings[0];
    expect(card.id).toBe(card.de);
  });
```

(For greetings the lemma has no article so `id === de` trivially; this still holds for every legacy card because each id equals its display form.)

- [x] **Step 3: Remove `PRESET_DECKS` from `content.js`**

In `src/data/content.js`, delete the entire `export const PRESET_DECKS = { … };` block (lines ~34–83). Leave `ALPHABET`, `SCENARIOS`, `CHAT_TASKS`, the `TRANSLATE_SENTENCES_*`, and `ALPHABET_QUIZ_GROUPS` untouched.

- [x] **Step 4: Remove the `PRESET_DECKS` tests from `content.test.js`**

In `src/data/content.test.js`, delete `PRESET_DECKS` from the import list and delete the entire `describe('PRESET_DECKS', …)` block. (Deck/card shape is now covered by `lexicon.test.js` + `resolve.test.js`.)

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all files green (no remaining references to `PRESET_DECKS`).

If anything still imports `PRESET_DECKS`, grep and fix:
Run: `grep -rn "PRESET_DECKS" src` — expected: only local aliases inside components (e.g. `const { decks: PRESET_DECKS } = activePack.content;`), never an import from `../data/content`.

- [x] **Step 6: Commit**

```bash
git add src/packs/de/index.js src/packs/packs.test.js src/data/content.js src/data/content.test.js
git commit -m "refactor(packs): resolve decks from lexicon; retire PRESET_DECKS"
```

---

## Task 6: Surface plural + example on the vocab card

**Files:**
- Modify: `src/components/VocabTab.jsx:454-470` (card face block)
- Test: `src/components/VocabTab.test.jsx`

**Interfaces:**
- Consumes: resolved cards now carry `plural` (string|null) and `examples` (array). `card.de` is the display form (gender already visible via the article, e.g. `"das Brot"`).
- Produces: when present, the card face shows the plural and the first example sentence.

- [x] **Step 1: Add the rendering to the card face**

In `src/components/VocabTab.jsx`, inside the card-face `<div>`, immediately AFTER the IPA block (the `{card.ipa && ( … )}` ending at line ~469), add:

```jsx
                {card.plural && (
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.caps,
                      color: COLORS.mute,
                      marginTop: SPACE[2],
                    }}
                  >
                    PL: {card.plural}
                  </div>
                )}
                {card.examples?.length > 0 && (
                  <div
                    style={{
                      marginTop: SPACE[3],
                      fontFamily: FONTS.body,
                      fontSize: FONT_SIZE.md,
                      fontStyle: 'italic',
                      opacity: 0.75,
                    }}
                  >
                    {card.examples[0].de}
                  </div>
                )}
```

- [x] **Step 2: Write the failing test**

Add to `src/components/VocabTab.test.jsx` (follow the existing render/setup pattern already in that file — same imports and `render(<VocabTab … />)` harness). Add a test that selects the Food deck and asserts the plural + example render for "das Brot":

```jsx
it('shows plural and example sentence for a noun card', async () => {
  const user = userEvent.setup();
  render(
    <VocabTab level="a1" learnedWords={{}} markLearned={() => {}} />
  );
  // Switch to the Food & Drink deck.
  await user.click(screen.getByRole('button', { name: /Food & Drink/i }));
  // The card face shows the plural label and the first example sentence.
  expect(await screen.findByText(/PL: Brote/)).toBeInTheDocument();
  expect(screen.getByText('Ich esse Brot.')).toBeInTheDocument();
});
```

> Note: the SRS queue orders cards; "das Brot" is the first Food card and has no prior SRS state in the test (fresh `loadState`), so it appears in the initial queue. If queue ordering makes it non-first, advance with the on-screen answer flow until the Brot card shows, or assert against whichever Food card carries a plural+example — but "das Brot" is authored with both specifically to anchor this test.

- [x] **Step 3: Run the test to verify it fails (before Step 1 is applied) / passes (after)**

Run: `npx vitest run src/components/VocabTab.test.jsx`
Expected: PASS once Step 1 rendering is in place. If it fails on queue ordering, adjust the test to click through to the Brot card per the note.

- [x] **Step 4: Run the full suite + lint**

Run: `npm test`
Expected: PASS (all files).

- [x] **Step 5: Commit**

```bash
git add src/components/VocabTab.jsx src/components/VocabTab.test.jsx
git commit -m "feat(vocab): show plural and example sentence on the card face"
```

---

## Self-Review

**Spec coverage (Phase B sections of the design):**
- Data model `LexiconEntry` → Task 1 (validator encodes the shape) + Task 2 (data).
- Decks-as-views → Task 3.
- Resolver returning the consumer shape, composing display `de`, preserving ids → Task 4 + verified in Task 5.
- Migrate existing 40 cards, SRS continuity → Task 2 + Task 5 tests.
- Phase B UI (plumb new fields through VocabTab) → Task 6.
- Auto-deck support (so Phase A only adds data) → Task 4 (tested via fixture; none shipped, per "Phase B authors structure, not bulk content").
- Regression: existing tests stay green → Task 5/6 update only the tests that asserted the retired Phase-0 wiring; all others unchanged.

Deferred to Phase A (correctly out of this plan): import pipeline, ~5k words, chunked lazy loading, profanity/length filters, `CONTENT_LICENSE.md`, frequency-band decks, homograph id rule, chunk granularity.

**Placeholder scan:** No TBD/TODO; every code step includes complete code. ✓

**Type consistency:** `resolveCard` field names (`de`, `en`, `glosses`, `id`, `plural`, `examples`, `cefr`, `freqRank`, `tags`, `verb`, `article`, `pos`, `ipa`) are consistent across Tasks 4–6. `validateLexiconEntry` field set matches the `LEXICON` entries in Task 2. `DECKS` ids in Task 3 match `LEXICON` keys in Task 2. ✓

## Notes / risks for the implementer
- Keep `card.ipa` strings byte-identical to the originals (they include the article for nouns) so the displayed IPA does not change.
- `npm test` runs the whole suite (~3 min) on every commit via the pre-commit hook; budget for it.
- If `VocabTab.test.jsx` lacks `userEvent`/`screen` imports, mirror the existing test setup already in that file rather than introducing a new harness.
