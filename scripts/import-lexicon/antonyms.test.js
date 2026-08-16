import { describe, it, expect } from 'vitest';
import { pruneAntonyms } from './antonyms.js';

const entry = (over) => ({
  id: 'x:x',
  de: 'x',
  pos: 'adj',
  antonyms: [],
  ...over,
});

describe('pruneAntonyms', () => {
  it('drops an antonym that is not itself a headword in the lexicon', () => {
    // "nid" is a dialect form Wiktionary lists against "ob". A learner will
    // never meet it in this app, so it is not worth drilling.
    const out = pruneAntonyms([
      entry({ id: 'a:hell', de: 'hell', antonyms: ['dunkel', 'nid'] }),
      entry({ id: 'a:dunkel', de: 'dunkel' }),
    ]);
    expect(out[0].antonyms).toEqual(['dunkel']);
  });

  it('clears antonyms on function words, where sense-bleed concentrates', () => {
    // "zu" the preposition inherits the antonyms of "zu" the adjective
    // (closed/open), which reads as nonsense on a card asking for an opposite.
    const out = pruneAntonyms([
      entry({ id: 'p:zu', de: 'zu', pos: 'prep', antonyms: ['auf'] }),
      entry({ id: 'a:auf', de: 'auf', pos: 'adj' }),
    ]);
    expect(out[0].antonyms).toEqual([]);
  });

  it('keeps content parts of speech', () => {
    const out = pruneAntonyms([
      entry({ id: 'n:ende', de: 'Ende', pos: 'noun', antonyms: ['Anfang'] }),
      entry({ id: 'n:anfang', de: 'Anfang', pos: 'noun' }),
    ]);
    expect(out[0].antonyms).toEqual(['Anfang']);
  });

  it('matches headwords case-insensitively', () => {
    const out = pruneAntonyms([
      entry({ id: 'v:bauen', de: 'bauen', pos: 'verb', antonyms: ['Zerstören'] }),
      entry({ id: 'v:zerstoeren', de: 'zerstören', pos: 'verb' }),
    ]);
    expect(out[0].antonyms).toEqual(['Zerstören']);
  });

  it('clears a denylisted headword and drops a denylisted antonym token', () => {
    // "Haben ↔ Soll" are bookkeeping terms; "und" is not an opposite of
    // anything. Neither is detectable structurally — see the lists in the module.
    const out = pruneAntonyms([
      entry({ id: 'n:haben', de: 'Haben', pos: 'noun', antonyms: ['Soll'] }),
      entry({ id: 'n:soll', de: 'Soll', pos: 'noun' }),
      entry({ id: 'v:weniger', de: 'weniger', pos: 'adv', antonyms: ['mehr', 'und'] }),
      entry({ id: 'a:mehr', de: 'mehr', pos: 'adv' }),
    ]);
    expect(out.find((e) => e.de === 'Haben').antonyms).toEqual([]);
    expect(out.find((e) => e.de === 'weniger').antonyms).toEqual(['mehr']);
  });

  it('leaves every other field untouched', () => {
    const [out] = pruneAntonyms([entry({ de: 'hell', cefr: 'A1', antonyms: ['nope'] })]);
    expect(out.cefr).toBe('A1');
    expect(out.de).toBe('hell');
  });
});
