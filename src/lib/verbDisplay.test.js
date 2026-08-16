import { describe, it, expect } from 'vitest';
import { formatVerb, perfectLine, preteriteLine } from './verbDisplay';
import { grammar as de } from '../packs/de/grammar';

const present = (over = {}) => ({
  ich: null,
  du: null,
  er: null,
  wir: null,
  ihr: null,
  sie: null,
  ...over,
});

// The point of Phase 1.4: the same algorithm, a different language. If this
// fixture produces German-shaped output, the abstraction only relocated German.
const fr = {
  articles: ['le', 'la', 'les'],
  articleRequiredForNouns: true,
  auxiliaries: { avoir: 'a', être: 'est' },
  personKeys: ['je', 'tu', 'il', 'nous', 'vous', 'ils'],
  displayPerson: 'il',
  labels: { perfect: 'Passé composé', participle: 'Participe passé', preterite: 'Imparfait' },
};

describe('preteriteLine', () => {
  it('returns null without a verb block or without the form', () => {
    expect(preteriteLine(null, de)).toBe(null);
    expect(preteriteLine({ partizip2: 'gegangen', present: present() }, de)).toBe(null);
  });
  it('labels the form from the pack, never a German literal', () => {
    expect(preteriteLine({ preterite: 'ging', present: present() }, de)).toEqual({
      label: 'Präteritum',
      value: 'ging',
    });
    expect(preteriteLine({ preterite: 'allait', present: present() }, fr)).toEqual({
      label: 'Imparfait',
      value: 'allait',
    });
  });
});

describe('formatVerb', () => {
  it('returns [] for null / non-object', () => {
    expect(formatVerb(null, de)).toEqual([]);
    expect(formatVerb(undefined, de)).toEqual([]);
    expect(formatVerb('nope', de)).toEqual([]);
  });
  it('returns [] for an all-null block', () => {
    expect(formatVerb({ aux: null, partizip2: null, present: present() }, de)).toEqual([]);
  });
  it('orders the lines present → Präteritum → Perfekt', () => {
    expect(
      formatVerb(
        { aux: 'sein', partizip2: 'gegangen', preterite: 'ging', present: present({ er: 'geht' }) },
        de
      )
    ).toEqual([
      { label: 'er', value: 'geht' },
      { label: 'Präteritum', value: 'ging' },
      { label: 'Perfekt', value: 'ist gegangen' },
    ]);
  });
  it('renders er-form + Perfekt with sein → ist', () => {
    expect(
      formatVerb({ aux: 'sein', partizip2: 'gegangen', present: present({ er: 'geht' }) }, de)
    ).toEqual([
      { label: 'er', value: 'geht' },
      { label: 'Perfekt', value: 'ist gegangen' },
    ]);
  });
  it('renders Perfekt with haben → hat', () => {
    expect(
      formatVerb({ aux: 'haben', partizip2: 'gemacht', present: present({ er: 'macht' }) }, de)
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Perfekt', value: 'hat gemacht' },
    ]);
  });
  it('falls back to Part. II when aux is null', () => {
    expect(
      formatVerb({ aux: null, partizip2: 'gemacht', present: present({ er: 'macht' }) }, de)
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Part. II', value: 'gemacht' },
    ]);
  });
  it('renders only the er-form when there is no partizip2', () => {
    expect(
      formatVerb({ aux: null, partizip2: null, present: present({ er: 'geht' }) }, de)
    ).toEqual([{ label: 'er', value: 'geht' }]);
  });
  it('renders only Perfekt when there is no er-form', () => {
    expect(formatVerb({ aux: 'haben', partizip2: 'gesagt', present: present() }, de)).toEqual([
      { label: 'Perfekt', value: 'hat gesagt' },
    ]);
  });

  // Previously `aux === 'sein' ? 'ist' : 'hat'` — anything not 'sein' silently
  // got the haben form. Now an unknown aux falls through to the participle
  // line. validateLexiconEntry gates aux, so only malformed data reaches this.
  it('falls back to the participle line for an auxiliary the pack does not declare', () => {
    expect(
      formatVerb({ aux: 'essere', partizip2: 'gemacht', present: present({ er: 'macht' }) }, de)
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Part. II', value: 'gemacht' },
    ]);
  });

  it('speaks French when handed a French grammar', () => {
    expect(
      formatVerb({ aux: 'être', partizip2: 'allé', present: { je: 'vais', il: 'va' } }, fr)
    ).toEqual([
      { label: 'il', value: 'va' },
      { label: 'Passé composé', value: 'est allé' },
    ]);
  });

  it('uses the French participle label when the auxiliary is unknown', () => {
    expect(formatVerb({ aux: null, partizip2: 'allé', present: { il: 'va' } }, fr)).toEqual([
      { label: 'il', value: 'va' },
      { label: 'Participe passé', value: 'allé' },
    ]);
  });
});

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
