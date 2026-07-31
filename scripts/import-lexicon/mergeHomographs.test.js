import { describe, it, expect } from 'vitest';
import { renderedGerman, mergedAnswer, mergeHomographs } from './mergeHomographs.js';

// Minimal but real: these mirror entries in public/lexicon, trimmed to the
// fields mergeHomographs reads.
const entry = (over) => ({
  id: 'x:x',
  de: 'x',
  en: ['x'],
  pos: 'adv',
  article: null,
  ipa: null,
  plural: null,
  cefr: null,
  freqRank: 100,
  tags: [],
  examples: [],
  verb: null,
  source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
  ...over,
});

describe('renderedGerman', () => {
  it('prefixes the article for nouns', () => {
    expect(renderedGerman(entry({ de: 'Tor', article: 'das' }))).toBe('das Tor');
  });

  it('returns the bare lemma when there is no article', () => {
    expect(renderedGerman(entry({ de: 'in', article: null }))).toBe('in');
  });
});

describe('mergedAnswer', () => {
  it('joins the first synonym of each sense with a middle dot', () => {
    const senses = [
      entry({ id: 'conj:doch', en: ['though; yet; but'] }),
      entry({ id: 'adv:doch', en: ['after all; yet; however'] }),
    ];
    expect(mergedAnswer(senses)).toBe('though · after all');
  });

  it('deduplicates senses case-insensitively', () => {
    const senses = [
      entry({ id: 'prep:in', en: ['in, inside, within'] }),
      entry({ id: 'adj:in', en: ['In, popular'] }),
    ];
    expect(mergedAnswer(senses)).toBe('in');
  });

  it('skips meta-linguistic senses', () => {
    const senses = [
      entry({ id: 'prep:nach', en: ['after, past'] }),
      entry({ id: 'adv:nach', en: ['Separated form of nach'] }),
    ];
    expect(mergedAnswer(senses)).toBe('after');
  });

  // Caught by reading real merged output: `die Gleiche` answered a clean
  // "equality" before the merge and came out
  // "equality · nominalization of gleich: female equivalent of Gleicher".
  it('skips a nominalization sense', () => {
    const senses = [
      entry({ id: 'n:gleiche:equality', en: ['equality'] }),
      entry({
        id: 'n:gleiche:nominalization',
        en: ['nominalization of gleich: female equivalent of Gleicher: female equal'],
      }),
    ];
    expect(mergedAnswer(senses)).toBe('equality');
  });

  it('skips a nominalization sense even when it is the primary', () => {
    const senses = [
      entry({ id: 'n:schoene:nominalization', en: ['nominalization of schön'] }),
      entry({ id: 'n:schoene:beauty', en: ['beauty'] }),
    ];
    expect(mergedAnswer(senses)).toBe('beauty');
  });

  it('caps at two senses', () => {
    const senses = [entry({ en: ['one'] }), entry({ en: ['two'] }), entry({ en: ['three'] })];
    expect(mergedAnswer(senses)).toBe('one · two');
  });

  it('falls back to the primary first synonym when every sense is skipped', () => {
    const senses = [entry({ en: ['inflection of gehen'] }), entry({ en: ['preterite of sehen'] })];
    expect(mergedAnswer(senses)).toBe('inflection of gehen');
  });
});

describe('mergeHomographs', () => {
  it('leaves a lexicon with no duplicates untouched', () => {
    const input = [entry({ id: 'a:1', de: 'eins' }), entry({ id: 'a:2', de: 'zwei' })];
    const { entries, retiredIds } = mergeHomographs(input);
    expect(entries).toEqual(input);
    expect(retiredIds).toEqual([]);
  });

  it('merges a cross-part-of-speech pair, keeping the primary id', () => {
    const input = [
      entry({ id: 'prep:in', pos: 'prep', de: 'in', en: ['in, inside, within'], freqRank: 65 }),
      entry({ id: 'adj:in', pos: 'adj', de: 'in', en: ['in, popular'], freqRank: 65 }),
    ];
    const { entries, retiredIds } = mergeHomographs(input);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('prep:in');
    expect(entries[0].pos).toBe('prep');
    expect(entries[0].en[0]).toBe('in');
    expect(retiredIds).toEqual(['adj:in']);
  });

  it('keeps every sense gloss in the rest of the en array', () => {
    const input = [
      entry({ id: 'conj:doch', de: 'doch', en: ['though; yet; but'] }),
      entry({ id: 'adv:doch', de: 'doch', en: ['after all; yet; however', 'really; just'] }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries[0].en).toEqual([
      'though · after all',
      'though; yet; but',
      'after all; yet; however',
      'really; just',
    ]);
  });

  it('merges a same-part-of-speech noun pair', () => {
    const input = [
      entry({
        id: 'n:tag:day-a-24-hour-period',
        pos: 'noun',
        de: 'Tag',
        article: 'der',
        en: ['day'],
        freqRank: 243,
      }),
      entry({
        id: 'n:tag:tag-label',
        pos: 'noun',
        de: 'Tag',
        article: 'der',
        en: ['tag'],
        freqRank: 243,
      }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('n:tag:day-a-24-hour-period');
    expect(entries[0].en[0]).toBe('day · tag');
  });

  it('collapses identical senses to a single answer', () => {
    const input = [
      entry({ id: 'conj:seit', de: 'seit', en: ['since'] }),
      entry({ id: 'prep:seit', de: 'seit', en: ['since', 'for'] }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries[0].en[0]).toBe('since');
  });

  it('leaves a gender-distinguished pair as two separate entries', () => {
    const input = [
      entry({ id: 'n:tor:fool', pos: 'noun', de: 'Tor', article: 'der', en: ['fool'] }),
      entry({ id: 'n:tor:gate', pos: 'noun', de: 'Tor', article: 'das', en: ['gate, archway'] }),
    ];
    const { entries, retiredIds } = mergeHomographs(input);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.id)).toEqual(['n:tor:fool', 'n:tor:gate']);
    expect(retiredIds).toEqual([]);
  });

  it('elects the lowest freqRank as primary regardless of input order', () => {
    const input = [
      entry({ id: 'adv:da', de: 'da', en: ['there'], freqRank: 900 }),
      entry({ id: 'conj:da', de: 'da', en: ['since'], freqRank: 40 }),
    ];
    const { entries, retiredIds } = mergeHomographs(input);
    expect(entries[0].id).toBe('conj:da');
    expect(entries[0].en[0]).toBe('since · there');
    expect(retiredIds).toEqual(['adv:da']);
  });

  it('breaks a freqRank tie on existing order', () => {
    const input = [
      entry({ id: 'first:w', de: 'w', en: ['one'], freqRank: 50 }),
      entry({ id: 'second:w', de: 'w', en: ['two'], freqRank: 50 }),
    ];
    expect(mergeHomographs(input).entries[0].id).toBe('first:w');
  });

  it('treats a null freqRank as ranking last', () => {
    const input = [
      entry({ id: 'a:w', de: 'w', en: ['one'], freqRank: null }),
      entry({ id: 'b:w', de: 'w', en: ['two'], freqRank: 700 }),
    ];
    expect(mergeHomographs(input).entries[0].id).toBe('b:w');
  });

  it('inherits verb conjugation when the primary has none', () => {
    const conj = {
      aux: 'haben',
      partizip2: 'gesiebt',
      present: {
        ich: 'siebe',
        du: 'siebst',
        er: 'siebt',
        wir: 'sieben',
        ihr: 'siebt',
        sie: 'sieben',
      },
    };
    const input = [
      entry({ id: 'num:sieben', pos: 'num', de: 'sieben', en: ['seven'], verb: null }),
      entry({ id: 'v:sieben', pos: 'verb', de: 'sieben', en: ['to sieve'], verb: conj }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries[0].id).toBe('num:sieben');
    expect(entries[0].verb).toEqual(conj);
  });

  it('keeps the primary verb conjugation when it has one', () => {
    const primaryConj = {
      aux: 'haben',
      partizip2: 'a',
      present: { ich: 'a', du: null, er: null, wir: null, ihr: null, sie: null },
    };
    const otherConj = {
      aux: 'sein',
      partizip2: 'b',
      present: { ich: 'b', du: null, er: null, wir: null, ihr: null, sie: null },
    };
    const input = [
      entry({ id: 'v:a', de: 'w', en: ['one'], verb: primaryConj }),
      entry({ id: 'v:b', de: 'w', en: ['two'], verb: otherConj }),
    ];
    expect(mergeHomographs(input).entries[0].verb).toEqual(primaryConj);
  });

  it('unions tags and deduplicates examples by German text', () => {
    const ex = (de) => ({ de, en: null, source: 'tatoeba' });
    const input = [
      entry({
        id: 'a:w',
        de: 'w',
        en: ['one'],
        tags: ['sports'],
        examples: [ex('Eins.'), ex('Zwei.')],
      }),
      entry({
        id: 'b:w',
        de: 'w',
        en: ['two'],
        tags: ['sports', 'law'],
        examples: [ex('Zwei.'), ex('Drei.')],
      }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries[0].tags).toEqual(['sports', 'law']);
    expect(entries[0].examples.map((e) => e.de)).toEqual(['Eins.', 'Zwei.', 'Drei.']);
  });

  it('preserves the relative order of surviving entries', () => {
    const input = [
      entry({ id: 'a:1', de: 'eins' }),
      entry({ id: 'prep:in', de: 'in', en: ['in, inside'] }),
      entry({ id: 'a:2', de: 'zwei' }),
      entry({ id: 'adj:in', de: 'in', en: ['popular'] }),
    ];
    const { entries } = mergeHomographs(input);
    expect(entries.map((e) => e.id)).toEqual(['a:1', 'prep:in', 'a:2']);
  });

  it('does not mutate its input', () => {
    const input = [
      entry({ id: 'prep:in', de: 'in', en: ['in, inside'] }),
      entry({ id: 'adj:in', de: 'in', en: ['popular'] }),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    mergeHomographs(input);
    expect(input).toEqual(snapshot);
  });
});
