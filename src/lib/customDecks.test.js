import { describe, it, expect } from 'vitest';
import {
  readDecks,
  upsertDeck,
  cardsFor,
  CUSTOM_DECK_ID,
  MAX_CARDS_PER_DECK,
  deleteDeck,
  liveDecks,
  isTombstone,
  newDeckId,
  MAX_CUSTOM_DECKS,
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
      deletedAt: null,
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
      deletedAt: null,
    });
  });

  it('replaces the deck at the same id — phase 1 keeps one custom slot', () => {
    const next = upsertDeck(DECKS, { deckId: 'custom', name: 'Food', cards: [card('Brot')] }, 99);
    expect(next.custom).toEqual({
      deckId: 'custom',
      name: 'Food',
      cards: [card('Brot')],
      updatedAt: 99,
      deletedAt: null,
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

describe('tombstones', () => {
  const live = { custom: { deckId: 'custom', name: 'Weather', cards: [card('A')], updatedAt: 5 } };

  it('marks a deleted deck with deletedAt and drops its cards', () => {
    const next = deleteDeck(live, 'custom', 100);
    expect(next.custom).toEqual({
      deckId: 'custom',
      name: 'Weather',
      cards: [],
      updatedAt: 100,
      deletedAt: 100,
    });
  });

  it('advances updatedAt to the delete time, which is what makes the merge need no special case', () => {
    expect(deleteDeck(live, 'custom', 100).custom.updatedAt).toBe(100);
  });

  it('recognises a tombstone and does not mistake a live deck for one', () => {
    expect(isTombstone(deleteDeck(live, 'custom', 100).custom)).toBe(true);
    expect(isTombstone(live.custom)).toBe(false);
    expect(isTombstone(undefined)).toBe(false);
  });

  it('does not mutate the map it was given', () => {
    const before = JSON.stringify(live);
    deleteDeck(live, 'custom', 100);
    expect(JSON.stringify(live)).toBe(before);
  });

  it.each([
    ['a deck that is not there', 'nope'],
    ['no deck id', undefined],
  ])('is a no-op for %s, so a stray click invents nothing to sync', (_l, id) => {
    expect(deleteDeck(live, id, 100)).toEqual(live);
  });

  it('does not re-tombstone an already deleted deck, which would move its clock', () => {
    const once = deleteDeck(live, 'custom', 100);
    expect(deleteDeck(once, 'custom', 999)).toEqual(once);
  });

  it('KEEPS tombstones through readDecks — a dropped one is a deck that comes back', () => {
    const stored = deleteDeck(live, 'custom', 100);
    const reread = readDecks(JSON.parse(JSON.stringify({ decks: stored })));
    expect(reread.custom).toEqual(stored.custom);
  });

  it('reads a tombstone even though it carries no cards', () => {
    // The usable-card filter would otherwise drop exactly the records whose
    // whole job is to outlive the deck.
    const reread = readDecks({ decks: { custom: { cards: [], deletedAt: 100, updatedAt: 100 } } });
    expect(isTombstone(reread.custom)).toBe(true);
  });

  it('falls back to the delete time when a tombstone has no updatedAt', () => {
    expect(readDecks({ decks: { custom: { deletedAt: 100 } } }).custom.updatedAt).toBe(100);
  });

  it('hides tombstones from liveDecks, which is what the UI reads', () => {
    const stored = deleteDeck(
      { ...live, other: { deckId: 'other', cards: [card('B')], updatedAt: 1 } },
      'custom',
      100
    );
    expect(Object.keys(liveDecks(stored))).toEqual(['other']);
  });

  it('returns no cards for a tombstoned deck', () => {
    expect(cardsFor(deleteDeck(live, 'custom', 100), 'custom')).toBeNull();
  });

  it('clears the tombstone when a deck is regenerated into the slot', () => {
    const deleted = deleteDeck(live, 'custom', 100);
    const revived = upsertDeck(deleted, { deckId: 'custom', name: 'New', cards: [card('Z')] }, 200);
    expect(revived.custom.deletedAt).toBeNull();
    expect(isTombstone(revived.custom)).toBe(false);
  });

  it('stamps deletedAt: null on a fresh deck so the pushed row clears the column', () => {
    expect(upsertDeck({}, { deckId: 'custom', cards: [card('A')] }, 1).custom.deletedAt).toBeNull();
  });
});

describe('newDeckId', () => {
  it('is unique across a population, not merely across two calls', () => {
    // A weak generator passes a two-call test trivially. A shared id between
    // devices means mergeDecks silently discards one deck, so this is a data
    // safety property.
    const ids = new Set(Array.from({ length: 2000 }, () => newDeckId()));
    expect(ids.size).toBe(2000);
  });

  it('is namespaced so a custom deck can never shadow a curated one', () => {
    expect(newDeckId().startsWith('custom-')).toBe(true);
    expect(newDeckId()).not.toBe('greetings');
  });

  it('does NOT derive from content — two decks on one topic get different ids', () => {
    expect(newDeckId()).not.toBe(newDeckId());
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    // randomUUID needs a secure context; getRandomValues has been universally
    // available far longer. Both are cryptographic — the platform's plain RNG
    // is deliberately not used at all.
    const real = globalThis.crypto?.randomUUID;
    try {
      if (globalThis.crypto) globalThis.crypto.randomUUID = undefined;
      const ids = new Set(Array.from({ length: 500 }, () => newDeckId()));
      expect(ids.size).toBe(500);
      expect([...ids][0]).toMatch(/^custom-[0-9a-f]{20}$/);
    } finally {
      if (globalThis.crypto) globalThis.crypto.randomUUID = real;
    }
  });

  it('still yields distinct ids with no Web Crypto at all', () => {
    const real = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      const ids = new Set(Array.from({ length: 100 }, () => newDeckId()));
      expect(ids.size).toBe(100); // the counter, not a timestamp collision
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
    }
  });
});

describe('the creation cap', () => {
  const cards = [card('A')];
  const fill = (n) => {
    let decks = {};
    for (let i = 0; i < n; i += 1) decks = upsertDeck(decks, { deckId: `d${i}`, cards }, i + 1);
    return decks;
  };

  it('allows creation up to the cap', () => {
    expect(Object.keys(fill(MAX_CUSTOM_DECKS))).toHaveLength(MAX_CUSTOM_DECKS);
  });

  it('refuses a NEW deck once the cap is reached', () => {
    const full = fill(MAX_CUSTOM_DECKS);
    expect(upsertDeck(full, { deckId: 'one-too-many', cards }, 99)).toBe(full);
  });

  it('still allows REPLACING a deck that is already live', () => {
    // Regenerating a deck adds nothing, so the cap must not block it.
    const full = fill(MAX_CUSTOM_DECKS);
    const next = upsertDeck(full, { deckId: 'd0', name: 'replaced', cards }, 99);
    expect(next.d0.name).toBe('replaced');
    expect(Object.keys(next)).toHaveLength(MAX_CUSTOM_DECKS);
  });

  it('counts LIVE decks, so a tombstone does not fill the quota', () => {
    // Otherwise a learner who deletes and regenerates enough times locks
    // themselves out with their own history.
    let decks = fill(MAX_CUSTOM_DECKS);
    decks = deleteDeck(decks, 'd0', 500);
    const next = upsertDeck(decks, { deckId: 'fresh', cards }, 600);
    expect(next.fresh).toBeTruthy();
    expect(isTombstone(next.d0)).toBe(true); // the tombstone survives
  });

  it('treats reviving a tombstoned deck as adding one', () => {
    let decks = fill(MAX_CUSTOM_DECKS);
    decks = deleteDeck(decks, 'd0', 500);
    decks = upsertDeck(decks, { deckId: 'fresh', cards }, 600); // back at the cap
    expect(upsertDeck(decks, { deckId: 'd0', cards }, 700)).toBe(decks);
  });

  it('honours an injected cap, so the limit is testable without the constant', () => {
    const one = upsertDeck({}, { deckId: 'a', cards }, 1, 1);
    expect(upsertDeck(one, { deckId: 'b', cards }, 2, 1)).toBe(one);
  });
});
