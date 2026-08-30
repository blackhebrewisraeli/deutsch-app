import { describe, it, expect } from 'vitest';
import {
  isLearned,
  markLearnedIn,
  forgetDeck,
  learnedCountOf,
  learnedInDeck,
  backfillFromSrs,
  readLearnedByDeck,
} from './learnedWords.js';

// `zwei` is a REAL collision, not an invented one: it ships in curated
// `numbers` and in the core-100, top-500 and cefr-a1 auto decks. 1,064 of the
// 4,243 card ids that can be marked learned appear in more than one such deck.
const COLLIDING = 'zwei';

describe('isLearned', () => {
  const learnedByDeck = { numbers: { [COLLIDING]: true } };

  it('reads a scoped entry in its own deck', () => {
    expect(isLearned({ learnedByDeck, deckId: 'numbers', cardId: COLLIDING })).toBe(true);
  });

  it('does NOT leak a scoped entry into a sibling deck that shares the id', () => {
    // The whole point of the epic.
    expect(isLearned({ learnedByDeck, deckId: 'cefr-a1', cardId: COLLIDING })).toBe(false);
  });

  it('falls back to the legacy flat map, in every deck', () => {
    const legacy = { learnedWords: { [COLLIDING]: true } };
    expect(isLearned({ ...legacy, deckId: 'numbers', cardId: COLLIDING })).toBe(true);
    expect(isLearned({ ...legacy, deckId: 'cefr-a1', cardId: COLLIDING })).toBe(true);
  });

  it('prefers a scoped hit but never contradicts the legacy map downward', () => {
    // A pre-migration word stays learned everywhere until it is re-answered;
    // nobody watches a word un-learn itself.
    const both = { learnedByDeck, learnedWords: { [COLLIDING]: true } };
    expect(isLearned({ ...both, deckId: 'top-500', cardId: COLLIDING })).toBe(true);
  });

  it.each([
    ['nothing at all', {}],
    ['an unknown card', { learnedByDeck, deckId: 'numbers', cardId: 'nope' }],
    ['a falsy legacy value', { learnedWords: { x: false }, deckId: 'd', cardId: 'x' }],
    ['no cardId', { learnedByDeck, deckId: 'numbers' }],
  ])('returns false for %s', (_l, args) => {
    expect(isLearned(args)).toBe(false);
  });
});

describe('markLearnedIn', () => {
  it('records a card under its deck', () => {
    expect(markLearnedIn({}, 'numbers', COLLIDING)).toEqual({ numbers: { [COLLIDING]: true } });
  });

  it('marks only the named deck, leaving a sibling untouched', () => {
    const next = markLearnedIn({ 'cefr-a1': { drei: true } }, 'numbers', COLLIDING);
    expect(next['cefr-a1']).toEqual({ drei: true });
    expect(next.numbers).toEqual({ [COLLIDING]: true });
  });

  it('sets rather than toggles — marking twice keeps it learned', () => {
    // #203: the flat writer toggled, so a rebuilt queue un-learned the word.
    const once = markLearnedIn({}, 'numbers', COLLIDING);
    expect(markLearnedIn(once, 'numbers', COLLIDING).numbers[COLLIDING]).toBe(true);
  });

  it('returns the SAME object when nothing changes, so React can skip a render', () => {
    const once = markLearnedIn({}, 'numbers', COLLIDING);
    expect(markLearnedIn(once, 'numbers', COLLIDING)).toBe(once);
  });

  it('does not mutate its input', () => {
    const before = { numbers: { drei: true } };
    const snapshot = JSON.stringify(before);
    markLearnedIn(before, 'numbers', COLLIDING);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it.each([
    ['no deck', [null, COLLIDING]],
    ['no card', ['numbers', null]],
  ])('ignores a call with %s', (_l, [deckId, cardId]) => {
    expect(markLearnedIn({ a: { b: true } }, deckId, cardId)).toEqual({ a: { b: true } });
  });

  it('tolerates a non-object map', () => {
    expect(markLearnedIn(null, 'd', 'c')).toEqual({ d: { c: true } });
  });
});

describe('forgetDeck', () => {
  it('drops one deck and keeps the rest', () => {
    const next = forgetDeck({ custom: { a: true }, numbers: { b: true } }, 'custom');
    expect(next).toEqual({ numbers: { b: true } });
  });

  it('is a no-op for a deck that is not there', () => {
    const m = { numbers: { b: true } };
    expect(forgetDeck(m, 'custom')).toBe(m);
  });
});

describe('learnedCountOf', () => {
  it('counts a word ONCE even when it is in both maps and several decks', () => {
    // The double-count the transition would otherwise produce on Home.
    const count = learnedCountOf(
      { numbers: { [COLLIDING]: true }, 'cefr-a1': { [COLLIDING]: true } },
      { [COLLIDING]: true }
    );
    expect(count).toBe(1);
  });

  it('counts distinct words across decks', () => {
    expect(learnedCountOf({ a: { x: true }, b: { y: true } }, {})).toBe(2);
  });

  it('counts legacy-only words', () => {
    expect(learnedCountOf({}, { x: true, y: true })).toBe(2);
  });

  it('ignores falsy legacy values', () => {
    expect(learnedCountOf({}, { x: true, y: false })).toBe(1);
  });

  it.each([
    ['both empty', {}, {}],
    ['both null', null, null],
  ])('returns 0 for %s', (_l, a, b) => {
    expect(learnedCountOf(a, b)).toBe(0);
  });
});

describe('learnedInDeck', () => {
  const cards = [{ id: 'eins' }, { id: COLLIDING }, { id: 'drei' }];

  it('counts only what is learned in THIS deck', () => {
    const learnedByDeck = { numbers: { [COLLIDING]: true }, 'cefr-a1': { eins: true } };
    expect(learnedInDeck({ learnedByDeck, deckId: 'numbers', cards })).toBe(1);
  });

  it('includes legacy hits, which apply everywhere', () => {
    expect(learnedInDeck({ learnedWords: { eins: true }, deckId: 'numbers', cards })).toBe(1);
  });

  it.each([
    ['no cards', undefined],
    ['a non-array', 'nope'],
  ])('returns 0 for %s', (_l, c) => {
    expect(learnedInDeck({ deckId: 'numbers', cards: c })).toBe(0);
  });
});

describe('backfillFromSrs', () => {
  const srs = {
    'numbers:zwei': { box: 2 },
    'cefr-a1:zwei': { box: 1 },
    'greetings:Hallo': { box: 3 },
  };

  it('attributes a flat key to the deck its SRS row names', () => {
    const { learnedByDeck } = backfillFromSrs({ learnedWords: { Hallo: true }, srs });
    expect(learnedByDeck).toEqual({ greetings: { Hallo: true } });
  });

  it('attributes to EVERY deck the card was practised in', () => {
    // Honest, not a guess: those SRS rows are evidence the learner drilled it
    // in both places.
    const { learnedByDeck } = backfillFromSrs({ learnedWords: { [COLLIDING]: true }, srs });
    expect(learnedByDeck).toEqual({
      numbers: { [COLLIDING]: true },
      'cefr-a1': { [COLLIDING]: true },
    });
  });

  it('leaves an unattributable word alone rather than fanning it out', () => {
    const { learnedByDeck, attributed, unattributed } = backfillFromSrs({
      learnedWords: { Unbekannt: true },
      srs,
    });
    expect(learnedByDeck).toEqual({});
    expect(attributed).toBe(0);
    expect(unattributed).toBe(1);
  });

  it('reports how much it could attribute, so a bug report can say', () => {
    const { attributed, unattributed } = backfillFromSrs({
      learnedWords: { Hallo: true, Unbekannt: true },
      srs,
    });
    expect({ attributed, unattributed }).toEqual({ attributed: 1, unattributed: 1 });
  });

  it('ignores flat keys that are not learned', () => {
    expect(backfillFromSrs({ learnedWords: { Hallo: false }, srs }).learnedByDeck).toEqual({});
  });

  it('is idempotent', () => {
    const first = backfillFromSrs({ learnedWords: { Hallo: true }, srs }).learnedByDeck;
    const second = backfillFromSrs({
      learnedWords: { Hallo: true },
      srs,
      learnedByDeck: first,
    }).learnedByDeck;
    expect(second).toEqual(first);
  });

  it('RE-RUNS over keys that arrived later, which is how an old device converges', () => {
    const first = backfillFromSrs({ learnedWords: { Hallo: true }, srs }).learnedByDeck;
    // The old device has since learned `zwei` and pushed it into the flat map.
    const second = backfillFromSrs({
      learnedWords: { Hallo: true, [COLLIDING]: true },
      srs,
      learnedByDeck: first,
    }).learnedByDeck;
    expect(second.greetings).toEqual({ Hallo: true });
    expect(second.numbers).toEqual({ [COLLIDING]: true });
  });

  it('keeps scoped entries that no flat key mentions', () => {
    const existing = { custom: { 'die Sonne': true } };
    const { learnedByDeck } = backfillFromSrs({ learnedWords: {}, srs, learnedByDeck: existing });
    expect(learnedByDeck.custom).toEqual({ 'die Sonne': true });
  });

  it('ignores malformed SRS keys instead of inventing a deck', () => {
    const { learnedByDeck, unattributed } = backfillFromSrs({
      learnedWords: { Hallo: true },
      srs: { Hallo: { box: 1 }, ':Hallo': { box: 1 } },
    });
    expect(learnedByDeck).toEqual({});
    expect(unattributed).toBe(1);
  });

  it('handles a card id containing a colon', () => {
    // srsKey joins on the FIRST colon, so the rest is the card id.
    const { learnedByDeck } = backfillFromSrs({
      learnedWords: { 'a:b': true },
      srs: { 'deck1:a:b': { box: 1 } },
    });
    expect(learnedByDeck).toEqual({ deck1: { 'a:b': true } });
  });

  it.each([
    ['no arguments', undefined],
    ['null everything', { learnedWords: null, srs: null }],
  ])('returns an empty map for %s', (_l, args) => {
    expect(backfillFromSrs(args).learnedByDeck).toEqual({});
  });
});

describe('readLearnedByDeck', () => {
  it('reads a stored map back', () => {
    const m = { numbers: { [COLLIDING]: true } };
    expect(readLearnedByDeck({ learnedByDeck: m })).toEqual(m);
  });

  it.each([
    ['no state', undefined],
    ['a blob from before the column existed', { learnedWords: { a: true } }],
    ['an array', { learnedByDeck: [] }],
    ['a string', { learnedByDeck: 'nope' }],
  ])('returns {} for %s', (_l, state) => {
    expect(readLearnedByDeck(state)).toEqual({});
  });

  it('drops non-true values and empty decks rather than carrying junk', () => {
    const read = readLearnedByDeck({
      learnedByDeck: { a: { x: false, y: true }, b: { z: 'yes' }, c: {}, d: 'nope' },
    });
    expect(read).toEqual({ a: { y: true } });
  });
});
