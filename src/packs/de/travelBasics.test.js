import { describe, it, expect } from 'vitest';
import PHRASES from '../../../scripts/seed-data/apify_raw_sentences.json' with { type: 'json' };
import {
  TRAVEL_BASICS_DECK_DEFS,
  TRAVEL_BASICS_ID,
  TRAVEL_BASICS_LEXICON,
  cefrFor,
  glossesFor,
} from './travelBasics';
import { validateLexiconEntry } from '../validate';
import { bestGlossMatch } from '../../lib/matching';
import { grammar } from './grammar';
import { dePack } from './index';

const cardIds = TRAVEL_BASICS_DECK_DEFS[TRAVEL_BASICS_ID].cardIds;

describe('Travel Basics', () => {
  it('ships every phrase exactly once', () => {
    expect(cardIds).toHaveLength(PHRASES.length);
    expect(new Set(cardIds).size).toBe(PHRASES.length);
  });

  it('every entry satisfies validateLexiconEntry', () => {
    const opts = { grammar, cefrLevels: dePack.meta.cefrLevels };
    for (const entry of Object.values(TRAVEL_BASICS_LEXICON)) {
      expect(validateLexiconEntry(entry, opts)).toBe(true);
    }
  });

  it('levels under four words A1, four and up A2', () => {
    expect(cefrFor('Offen')).toBe('A1');
    expect(cefrFor('Wie geht es?')).toBe('A1');
    expect(cefrFor('Wie geht es Ihnen?')).toBe('A2');
  });

  it('serves every A1 phrase before any A2 phrase', () => {
    const levels = cardIds.map((id) => TRAVEL_BASICS_LEXICON[id].cefr);
    // Both levels present, or the ordering check below proves nothing.
    expect(new Set(levels)).toEqual(new Set(['A1', 'A2']));
    expect(levels).toEqual([...levels].sort());
  });

  it('keeps the usage note on screen but accepts the answer without it', () => {
    const { en } = TRAVEL_BASICS_LEXICON['Guten Tag.'];
    expect(en[0]).toBe('Good day (formal)');
    expect(bestGlossMatch(en, 'Good day').distance).toBe(0);
  });

  it('strips a mid-string note without leaving a space before the punctuation', () => {
    expect(glossesFor('Where is an automatic teller machine (ATM)?')[1]).toBe(
      'Where is an automatic teller machine?'
    );
    expect(glossesFor('Emergency room (ER)/Accident and Emergency (A&E)')[1]).toBe(
      'Emergency room/Accident and Emergency'
    );
  });

  // One input per quantifier that could backtrack: the space before the note,
  // and the note body (unclosed parens restart the scan at every `(`).
  it.each([
    ['spaces', `${' '.repeat(50_000)}x`],
    ['unclosed parens', '('.repeat(50_000)],
  ])('strips notes in linear time — %s', (_, input) => {
    const t = performance.now();
    glossesFor(input);
    expect(performance.now() - t).toBeLessThan(500);
  });

  it('is a phrase deck, not a preset deck — unseen cards must not swell the due count', () => {
    expect(dePack.content.phraseDecks[TRAVEL_BASICS_ID]).toHaveLength(PHRASES.length);
    expect(dePack.content.decks[TRAVEL_BASICS_ID]).toBeUndefined();
  });
});
