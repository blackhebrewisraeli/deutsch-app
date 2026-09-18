import { describe, it, expect } from 'vitest';
import {
  INTERESTS_GROUP,
  sanitizeEnabledInterests,
  toggleInterest,
  enabledTopics,
  interestPickerDecks,
  interestPromptHints,
  isEnabledInterestDeck,
} from './interests.js';

const catalog = [
  { id: 'sport', label: 'Sport', deckId: 'interest-sport', promptHint: 'sports' },
  { id: 'tech', label: 'Tech / IT', deckId: 'interest-tech', promptHint: 'computing' },
  { id: 'musik', label: 'Musik', deckId: 'interest-musik', promptHint: 'music' },
];

describe('sanitizeEnabledInterests', () => {
  it('keeps known ids in catalog order, not raw order', () => {
    expect(sanitizeEnabledInterests(['musik', 'sport', 'sport'], catalog)).toEqual([
      'sport',
      'musik',
    ]);
  });

  it('drops unknown, empty, and non-string values', () => {
    expect(sanitizeEnabledInterests(['sport', 'nope', '', 1, null], catalog)).toEqual(['sport']);
  });

  it('returns empty for junk inputs', () => {
    expect(sanitizeEnabledInterests(undefined, catalog)).toEqual([]);
    expect(sanitizeEnabledInterests({ sport: true }, catalog)).toEqual([]);
    expect(sanitizeEnabledInterests(['sport'], [])).toEqual([]);
    expect(sanitizeEnabledInterests(['sport'])).toEqual([]);
  });
});

describe('toggleInterest', () => {
  it('adds a catalog id and removes it on the second call', () => {
    const on = toggleInterest('tech', [], catalog);
    expect(on).toEqual(['tech']);
    expect(toggleInterest('tech', on, catalog)).toEqual([]);
  });

  it('ignores an unknown id', () => {
    expect(toggleInterest('nope', ['sport'], catalog)).toEqual(['sport']);
    expect(toggleInterest('', ['sport'], catalog)).toEqual(['sport']);
  });
});

describe('enabledTopics / picker / hints', () => {
  it('filters the catalog to enabled rows', () => {
    expect(enabledTopics(catalog, ['tech']).map((t) => t.id)).toEqual(['tech']);
  });

  it('builds picker rows with resolved counts', () => {
    const decks = {
      'interest-sport': [{ id: 'a' }, { id: 'b' }],
      'interest-tech': [{ id: 'c' }],
    };
    expect(interestPickerDecks(catalog, ['tech', 'sport'], decks)).toEqual([
      { id: 'interest-sport', name: 'Sport', count: 2 },
      { id: 'interest-tech', name: 'Tech / IT', count: 1 },
    ]);
  });

  it('counts zero when the resolved deck is missing', () => {
    expect(interestPickerDecks(catalog, ['musik'], {})).toEqual([
      { id: 'interest-musik', name: 'Musik', count: 0 },
    ]);
  });

  it('collects non-empty prompt hints', () => {
    expect(interestPromptHints(catalog, ['musik', 'sport'])).toEqual(['sports', 'music']);
    expect(interestPromptHints(catalog, [])).toEqual([]);
  });

  it('recognises an enabled interest deck id', () => {
    expect(isEnabledInterestDeck('interest-sport', catalog, ['sport'])).toBe(true);
    expect(isEnabledInterestDeck('interest-sport', catalog, ['tech'])).toBe(false);
    expect(isEnabledInterestDeck('greetings', catalog, ['sport'])).toBe(false);
  });
});

describe('INTERESTS_GROUP', () => {
  it('is the Vocab picker label', () => {
    expect(INTERESTS_GROUP).toBe('Interests');
  });
});
