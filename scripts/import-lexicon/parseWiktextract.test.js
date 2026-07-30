import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseWiktextract.js';
import {
  NOUN_BROT,
  VERB_GEHEN,
  NON_GERMAN,
  NO_GLOSS,
  NOUN_WITH_DUPLICATE_GLOSSES,
  VERB_FULL,
  VERB_PARTIAL,
  VERB_NO_FORMS,
  FORM_OF_SAGTE,
  ALT_OF_RAUM,
  MIXED_ALT_OF,
} from './__fixtures__/wiktextract-sample.js';

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
      verb: null,
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
  it('drops non-lemma inflected-form records (all senses form-of)', () => {
    expect(parseRecord(FORM_OF_SAGTE)).toBe(null);
  });
  it('deduplicates glosses and caps at 3', () => {
    const out = parseRecord(NOUN_WITH_DUPLICATE_GLOSSES);
    expect(out.glosses).toHaveLength(3);
    expect(out.glosses).toEqual(['house', 'home', 'building']);
  });

  it('drops alternative-form records (all senses alt-of)', () => {
    expect(parseRecord(ALT_OF_RAUM)).toBe(null);
  });

  it('keeps the real senses of a record that also has an alt-of sense', () => {
    const out = parseRecord(MIXED_ALT_OF);
    expect(out.glosses).toEqual(['defiance, spite']);
  });

  it('cleans glosses: label stripped, parenthetical cut, synonyms capped', () => {
    const record = {
      word: 'in',
      pos: 'prep',
      lang_code: 'de',
      forms: [],
      sounds: [],
      senses: [
        {
          glosses: ['[with dative] in, inside, within, at (inside a building)'],
          tags: [],
        },
      ],
    };
    expect(parseRecord(record).glosses).toEqual(['in, inside, within']);
  });
});

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
