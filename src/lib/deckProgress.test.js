import { describe, it, expect } from 'vitest';
import { deckProgressFor } from './deckProgress.js';
import { deriveMissions } from './missions.js';
import { activePack } from '../packs/index.js';

// One fixture rich enough to tell the three states apart. A single deck with a
// single learned word cannot express "started but not finished", so every deck
// state that matters is present here and each assertion picks its own out.
const DECKS = {
  untouched: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
  started: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  finished: [{ id: 'f1' }, { id: 'f2' }],
};
const LEARNED = { s1: true, f1: true, f2: true };

const byId = (rows, deckId) => rows.find((r) => r.deckId === deckId);

describe('deckProgressFor', () => {
  it('counts learned cards per deck and reports each deck total', () => {
    const rows = deckProgressFor({ decks: DECKS, learnedWords: LEARNED });

    expect(byId(rows, 'untouched')).toEqual({ deckId: 'untouched', done: 0, total: 3 });
    expect(byId(rows, 'started')).toEqual({ deckId: 'started', done: 1, total: 3 });
    expect(byId(rows, 'finished')).toEqual({ deckId: 'finished', done: 2, total: 2 });
  });

  it('returns a row for every deck, so the caller decides what counts as open', () => {
    const rows = deckProgressFor({ decks: DECKS, learnedWords: LEARNED });
    expect(rows.map((r) => r.deckId).sort()).toEqual(['finished', 'started', 'untouched']);
  });

  it('reports every deck as untouched when nothing is learned', () => {
    const rows = deckProgressFor({ decks: DECKS, learnedWords: {} });
    expect(rows.every((r) => r.done === 0)).toBe(true);
    expect(rows.map((r) => r.total)).toEqual([3, 3, 2]);
  });

  it('ignores falsy learnedWords values rather than counting the key', () => {
    const rows = deckProgressFor({ decks: DECKS, learnedWords: { s1: false, s2: true } });
    expect(byId(rows, 'started').done).toBe(1);
  });

  it('skips empty and malformed deck entries instead of emitting total 0', () => {
    const rows = deckProgressFor({
      decks: { good: [{ id: 'g1' }], empty: [], notAnArray: null, alsoNot: 'nope' },
      learnedWords: { g1: true },
    });
    expect(rows).toEqual([{ deckId: 'good', done: 1, total: 1 }]);
  });

  it('tolerates a null card inside a deck', () => {
    const rows = deckProgressFor({ decks: { d: [{ id: 'a' }, null] }, learnedWords: { a: true } });
    expect(rows).toEqual([{ deckId: 'd', done: 1, total: 2 }]);
  });

  it.each([
    ['no arguments', undefined],
    ['null decks', { decks: null, learnedWords: LEARNED }],
    ['decks that are not an object', { decks: 'nope', learnedWords: LEARNED }],
    ['missing learnedWords', { decks: DECKS }],
    ['null learnedWords', { decks: DECKS, learnedWords: null }],
  ])('returns a usable result for %s', (_label, args) => {
    expect(() => deckProgressFor(args)).not.toThrow();
    expect(Array.isArray(deckProgressFor(args))).toBe(true);
  });

  it('feeds deriveMissions the shape its deck-unfinished branch already expects', () => {
    // The contract between these two modules is the whole point of the epic:
    // if this fails, one side has drifted from the other.
    const missions = deriveMissions({
      decks: deckProgressFor({ decks: DECKS, learnedWords: LEARNED }),
    });
    const deckMission = missions.find((m) => m.id === 'deck-unfinished');
    expect(deckMission).toMatchObject({ deckId: 'started', count: 2, tab: 'vocab' });
  });

  it('opens no deck mission when every deck is untouched or finished', () => {
    const decks = { untouched: DECKS.untouched, finished: DECKS.finished };
    const missions = deriveMissions({ decks: deckProgressFor({ decks, learnedWords: LEARNED }) });
    expect(missions.find((m) => m.id === 'deck-unfinished')).toBeUndefined();
  });
});

describe('curated decks (D2 guard)', () => {
  const curated = activePack.content.decks;

  it('ships decks shaped as deckId → card array, which is what the derivation reads', () => {
    const entries = Object.entries(curated);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, cards] of entries) {
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true);
    }
  });

  it('shares no card id between curated decks, so mastery in one cannot mark another', () => {
    // learnedWords is keyed by card id alone. If two curated decks ever share an
    // id, learning it in one silently advances the other and the mission count
    // goes quietly wrong — so this is enforced, not assumed.
    const owner = new Map();
    const collisions = [];
    for (const [deckId, cards] of Object.entries(curated)) {
      for (const card of cards) {
        if (owner.has(card.id)) collisions.push(`${card.id}: ${owner.get(card.id)} + ${deckId}`);
        else owner.set(card.id, deckId);
      }
    }
    // Print the denominator: zero collisions across zero cards would pass too.
    const totalCards = Object.values(curated).reduce((n, cards) => n + cards.length, 0);
    expect(totalCards).toBeGreaterThan(0);
    expect(owner.size).toBe(totalCards);
    expect(collisions).toEqual([]);
  });

  it('derives real progress from the shipped decks', () => {
    const firstDeck = Object.keys(curated)[0];
    const oneCard = curated[firstDeck][0].id;
    const rows = deckProgressFor({ decks: curated, learnedWords: { [oneCard]: true } });

    expect(rows).toHaveLength(Object.keys(curated).length);
    expect(byId(rows, firstDeck).done).toBe(1);
    expect(rows.filter((r) => r.deckId !== firstDeck).every((r) => r.done === 0)).toBe(true);
  });
});
