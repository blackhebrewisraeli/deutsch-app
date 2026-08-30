import { describe, it, expect } from 'vitest';
import {
  readDecks,
  upsertDeck,
  cardsFor,
  CUSTOM_DECK_ID,
  MAX_CARDS_PER_DECK,
} from './customDecks.js';

const card = (id) => ({ id, de: id, en: `${id}-en` });

// Two decks, so "the other deck was left alone" is expressible. A fixture with
// one deck cannot fail an upsert that replaces the whole map.
const DECKS = {
  custom: {
    deckId: 'custom',
    name: 'Weather',
    cards: [card('Regen'), card('Sonne')],
    updatedAt: 5,
  },
  other: { deckId: 'other', name: 'Kitchen', cards: [card('Löffel')], updatedAt: 9 },
};

describe('readDecks', () => {
  it('reads a stored deck back whole', () => {
    expect(readDecks({ decks: DECKS }).custom).toEqual({
      deckId: 'custom',
      name: 'Weather',
      cards: [card('Regen'), card('Sonne')],
      updatedAt: 5,
    });
  });

  it('reads every stored deck, not just the custom slot', () => {
    expect(Object.keys(readDecks({ decks: DECKS })).sort()).toEqual(['custom', 'other']);
  });

  it.each([
    ['no state at all', undefined],
    ['null state', null],
    ['a blob from before decks existed', { learnedWords: { Hallo: true } }],
    ['a null decks key', { decks: null }],
    ['decks stored as an array', { decks: [{ deckId: 'custom' }] }],
    ['decks stored as a string', { decks: 'nope' }],
  ])('returns {} for %s', (_label, state) => {
    expect(readDecks(state)).toEqual({});
  });

  it('drops a deck whose cards are missing or not an array', () => {
    expect(readDecks({ decks: { a: { name: 'x' }, b: { cards: 'nope' } } })).toEqual({});
  });

  it('drops a deck with an empty card list rather than listing an undrillable deck', () => {
    expect(readDecks({ decks: { a: { cards: [] } } })).toEqual({});
  });

  it('drops cards with no usable id but keeps the rest of the deck', () => {
    const decks = readDecks({
      decks: { a: { cards: [card('Ja'), null, { de: 'no id' }, { id: '' }, card('Nein')] } },
    });
    expect(decks.a.cards).toEqual([card('Ja'), card('Nein')]);
  });

  it('drops the deck when every card is unusable', () => {
    expect(readDecks({ decks: { a: { cards: [null, { de: 'x' }] } } })).toEqual({});
  });

  it('takes deckId from the key, so a disagreeing stored field cannot redirect it', () => {
    const decks = readDecks({ decks: { custom: { deckId: 'somethingElse', cards: [card('A')] } } });
    expect(decks.custom.deckId).toBe('custom');
    expect(decks.somethingElse).toBeUndefined();
  });

  it('falls back to the deck id when the name is missing or not a string', () => {
    expect(readDecks({ decks: { custom: { cards: [card('A')] } } }).custom.name).toBe('custom');
    expect(readDecks({ decks: { custom: { name: 42, cards: [card('A')] } } }).custom.name).toBe(
      'custom'
    );
  });

  it('normalises a missing or non-numeric updatedAt to null', () => {
    expect(readDecks({ decks: { custom: { cards: [card('A')] } } }).custom.updatedAt).toBeNull();
    expect(
      readDecks({ decks: { custom: { cards: [card('A')], updatedAt: 'yesterday' } } }).custom
        .updatedAt
    ).toBeNull();
  });

  it('caps an oversized stored deck instead of handing back the whole thing', () => {
    const cards = Array.from({ length: MAX_CARDS_PER_DECK + 25 }, (_, i) => card(`c${i}`));
    expect(readDecks({ decks: { custom: { cards } } }).custom.cards).toHaveLength(
      MAX_CARDS_PER_DECK
    );
  });
});

describe('upsertDeck', () => {
  it('adds a deck and stamps updatedAt from the injected clock', () => {
    const next = upsertDeck(
      {},
      { deckId: CUSTOM_DECK_ID, name: 'Weather', cards: [card('A')] },
      42
    );
    expect(next.custom).toEqual({
      deckId: 'custom',
      name: 'Weather',
      cards: [card('A')],
      updatedAt: 42,
    });
  });

  it('replaces the deck at the same id — phase 1 keeps one custom slot', () => {
    const next = upsertDeck(DECKS, { deckId: 'custom', name: 'Food', cards: [card('Brot')] }, 99);
    expect(next.custom).toEqual({
      deckId: 'custom',
      name: 'Food',
      cards: [card('Brot')],
      updatedAt: 99,
    });
  });

  it('leaves every other deck untouched when replacing one', () => {
    const next = upsertDeck(DECKS, { deckId: 'custom', name: 'Food', cards: [card('Brot')] }, 99);
    expect(next.other).toEqual(DECKS.other);
  });

  it('does not mutate the map it was given', () => {
    const before = JSON.stringify(DECKS);
    upsertDeck(DECKS, { deckId: 'custom', name: 'Food', cards: [card('Brot')] }, 99);
    expect(JSON.stringify(DECKS)).toBe(before);
  });

  it.each([
    ['no deck id', { name: 'x', cards: [card('A')] }],
    ['cards that are not an array', { deckId: 'custom', cards: 'nope' }],
    ['an empty card list', { deckId: 'custom', cards: [] }],
    ['cards that are all unusable', { deckId: 'custom', cards: [null, { de: 'x' }] }],
    ['no argument object', undefined],
  ])('rejects %s and returns the map unchanged', (_label, deck) => {
    expect(upsertDeck(DECKS, deck, 1)).toEqual(DECKS);
  });

  it('caps an oversized generated deck so one response cannot blow the blob', () => {
    const cards = Array.from({ length: MAX_CARDS_PER_DECK + 50 }, (_, i) => card(`c${i}`));
    const next = upsertDeck({}, { deckId: 'custom', cards }, 1);
    expect(next.custom.cards).toHaveLength(MAX_CARDS_PER_DECK);
  });

  it('tolerates being handed a non-object map', () => {
    expect(upsertDeck(null, { deckId: 'custom', cards: [card('A')] }, 7).custom.cards).toEqual([
      card('A'),
    ]);
  });
});

describe('cardsFor', () => {
  it('returns the cards for a stored deck', () => {
    expect(cardsFor(DECKS, 'custom')).toEqual(DECKS.custom.cards);
  });

  it.each([
    ['an absent deck', DECKS, 'nope'],
    ['an empty map', {}, 'custom'],
    ['a null map', null, 'custom'],
    ['a deck with no cards array', { custom: { deckId: 'custom' } }, 'custom'],
    ['a deck with an empty card list', { custom: { cards: [] } }, 'custom'],
  ])('returns null for %s — VocabTab treats null as "no custom deck"', (_l, decks, id) => {
    expect(cardsFor(decks, id)).toBeNull();
  });
});

describe('round trip', () => {
  it('survives a save/load cycle through JSON, which is how it reaches localStorage', () => {
    const written = upsertDeck({}, { deckId: 'custom', name: 'Weather', cards: [card('A')] }, 11);
    const reread = readDecks(JSON.parse(JSON.stringify({ decks: written })));
    expect(reread).toEqual(written);
  });
});
