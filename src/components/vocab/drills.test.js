import { describe, it, expect } from 'vitest';
import { DRILLS, drillFor } from './drills';
import { grammar as de } from '../../packs/de/grammar';

const AUTO = [
  { id: 'artikel-a1', group: 'Artikel' },
  { id: 'plural-a1', group: 'Plural' },
  { id: 'perfekt-a1', group: 'Perfekt' },
  { id: 'core-100', group: 'Frequency' },
];

describe('drillFor', () => {
  it('returns null for an ordinary vocabulary deck', () => {
    // Frequency/CEFR/Topics decks drill meaning, which is not a DRILLS row.
    expect(drillFor('core-100', AUTO)).toBeNull();
    expect(drillFor('greetings', AUTO)).toBeNull();
  });

  it('maps a deck id to its group row', () => {
    expect(drillFor('artikel-a1', AUTO)).toBe(DRILLS.Artikel);
    expect(drillFor('plural-a1', AUTO)).toBe(DRILLS.Plural);
    expect(drillFor('perfekt-a1', AUTO)).toBe(DRILLS.Perfekt);
  });
});

describe('Artikel row', () => {
  const card = { de: 'das Jahr', lemma: 'Jahr', article: 'das', en: 'year' };

  it('shows the bare lemma so the card does not print its own answer', () => {
    expect(DRILLS.Artikel.display(card)).toBe('Jahr');
  });

  it('grades the article but answers with the full form', () => {
    expect(DRILLS.Artikel.expected(card, de)).toBe('das');
    expect(DRILLS.Artikel.answer(card, de)).toBe('das Jahr');
  });

  it('offers the pack articles, not a hardcoded three', () => {
    expect(DRILLS.Artikel.options(de)).toBe(de.articles);
    expect(DRILLS.Artikel.options({ articles: ['el', 'la'] })).toEqual(['el', 'la']);
  });
});

describe('Plural row', () => {
  const card = { de: 'das Jahr', plural: 'Jahre', en: 'year' };

  it('grades the bare plural but answers with the article', () => {
    // Typing "die Jahre" is not required; seeing it is what makes it stick.
    expect(DRILLS.Plural.expected(card, de)).toBe('Jahre');
    expect(DRILLS.Plural.answer(card, de)).toBe('die Jahre');
  });

  it('falls back to the bare plural when the pack declares no plural article', () => {
    expect(DRILLS.Plural.answer(card, { ...de, pluralArticle: undefined })).toBe('Jahre');
  });

  it('derives its placeholder from grammar', () => {
    expect(DRILLS.Plural.placeholder(de)).toBe('die …');
    expect(DRILLS.Plural.placeholder({ ...de, pluralArticle: undefined })).toBe('…');
  });
});

describe('Perfekt row', () => {
  const card = { de: 'treffen', verb: { aux: 'haben', partizip2: 'getroffen' } };

  it('expects the full perfect, auxiliary included', () => {
    expect(DRILLS.Perfekt.expected(card, de)).toBe('hat getroffen');
    expect(DRILLS.Perfekt.answer(card, de)).toBe('hat getroffen');
  });

  it('falls back to the bare participle for an auxiliary the pack does not declare', () => {
    // Must match what the card would print, or the drill rejects a correct answer.
    const odd = { de: 'werden', verb: { aux: 'werden', partizip2: 'geworden' } };
    expect(DRILLS.Perfekt.expected(odd, de)).toBe('geworden');
  });

  it('expects nothing for a card with no participle', () => {
    expect(DRILLS.Perfekt.expected({ de: 'x', verb: null }, de)).toBe('');
  });

  it('derives its placeholder from the pack auxiliaries', () => {
    expect(DRILLS.Perfekt.placeholder(de)).toBe('hat / ist …');
  });
});

describe('Hören row', () => {
  const card = { de: 'das Wasser', ipa: '/ˈvasɐ/', plural: 'Wässer', en: 'water' };

  it('plays the headword and expects it back', () => {
    expect(DRILLS['Hören'].speak(card)).toBe('das Wasser');
    expect(DRILLS['Hören'].expected(card)).toBe('das Wasser');
  });

  it('conceals every field that could give the word away', () => {
    // The answer is the headword itself, so this is the one drill that hides
    // everything the card knows.
    expect(DRILLS['Hören'].conceal).toEqual(['ipa', 'plural', 'verb', 'examples']);
    expect(DRILLS['Hören'].display(card)).not.toContain('Wasser');
  });
});

describe('Präteritum row', () => {
  // A STRONG verb: a stem+'te' implementation would pass on a weak one.
  const card = {
    de: 'gehen',
    en: 'to go',
    verb: {
      aux: 'sein',
      partizip2: 'gegangen',
      preterite: 'ging',
      present: { ich: 'gehe', du: 'gehst', er: 'geht', wir: null, ihr: null, sie: null },
    },
  };

  it('grades against the preterite, and echoes it with the display person', () => {
    expect(DRILLS['Präteritum'].expected(card, de)).toBe('ging');
    expect(DRILLS['Präteritum'].answer(card, de)).toBe('er ging');
  });

  it('conceals the whole verb block, not just the preterite line', () => {
    // The present "er:" line hands over the stem for every weak verb, and the
    // participle does the same for many strong ones (gegangen → ging). #105 and
    // #106 both shipped a drill that printed its own answer.
    expect(DRILLS['Präteritum'].conceal).toEqual(['verb']);
  });

  it('falls back to the headword when the verb block cannot form a line', () => {
    const noPret = { de: 'dürfen', verb: { aux: 'haben', partizip2: 'gedurft', present: {} } };
    expect(DRILLS['Präteritum'].expected(noPret, de)).toBe('');
    expect(DRILLS['Präteritum'].answer(noPret, de)).toBe('dürfen');
  });
});

describe('Gegenteil row', () => {
  // 123 of 359 antonym cards carry more than one opposite. Grading only the
  // first is #109 again, where "die Uhr" accepted "clock" but not "watch".
  const card = { de: 'gut', en: 'good', antonyms: ['schlecht', 'böse'] };

  it('accepts every listed antonym, not only the first', () => {
    expect(DRILLS.Gegenteil.accepts(card, de)).toEqual(['schlecht', 'böse']);
  });

  it('grades and echoes the first as the canonical answer', () => {
    expect(DRILLS.Gegenteil.expected(card, de)).toBe('schlecht');
    expect(DRILLS.Gegenteil.answer(card, de)).toBe('schlecht, böse');
  });

  it('conceals the examples as well as the antonyms', () => {
    // Antonym pairs co-occur in contrastive sentences by their nature — 6 of
    // 359 examples contain the answer ("Ich bin lieber arm als reich"), so this
    // is semantic and will recur with any example source.
    expect(DRILLS.Gegenteil.conceal).toEqual(['antonyms', 'examples']);
  });

  it('falls back to the headword when a card carries none', () => {
    expect(DRILLS.Gegenteil.expected({ de: 'Brot', antonyms: [] }, de)).toBe('');
    expect(DRILLS.Gegenteil.answer({ de: 'Brot', antonyms: [] }, de)).toBe('Brot');
  });
});

describe('every row', () => {
  it('has a homogeneous shape — columns are functions, not sometimes strings', () => {
    // A table with ragged columns is the thing this file replaced.
    for (const [name, d] of Object.entries(DRILLS)) {
      expect(['choice', 'typed'], name).toContain(d.kind);
      expect(typeof d.expected, name).toBe('function');
      expect(typeof d.answer, name).toBe('function');
      if (d.kind === 'typed') {
        expect(typeof d.label, name).toBe('function');
        expect(typeof d.placeholder, name).toBe('function');
      } else {
        expect(typeof d.options, name).toBe('function');
      }
      if (d.conceal) expect(Array.isArray(d.conceal), name).toBe(true);
      if (d.speak) expect(typeof d.speak, name).toBe('function');
    }
  });
});
