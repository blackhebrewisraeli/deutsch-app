import { describe, it, expect, beforeEach } from 'vitest';
import { deckProgressFor, isDeckComplete, completedDeckCount } from './deckProgress.js';
import {
  PLACEMENT_OFFER_THRESHOLD,
  shouldStartPlacementOffer,
  readPlacementOffer,
  writePlacementOffer,
  recordPlacementOfferShown,
  recordPlacementOfferDismissed,
  normalizePlacementOffer,
} from './placementOffer.js';
import { loadState } from './storage.js';

const DECKS = {
  untouched: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
  started: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  finished: [{ id: 'f1' }, { id: 'f2' }],
  alsoFinished: [{ id: 'a1' }],
  third: [{ id: 't1' }, { id: 't2' }],
};
const LEARNED = { s1: true, f1: true, f2: true, a1: true, t1: true, t2: true };

beforeEach(() => {
  localStorage.clear();
});

describe('isDeckComplete / completedDeckCount', () => {
  it('treats done >= total with a real total as complete', () => {
    expect(isDeckComplete({ deckId: 'x', done: 2, total: 2 })).toBe(true);
    expect(isDeckComplete({ deckId: 'x', done: 3, total: 2 })).toBe(true);
    expect(isDeckComplete({ deckId: 'x', done: 1, total: 2 })).toBe(false);
    expect(isDeckComplete({ deckId: 'x', done: 0, total: 0 })).toBe(false);
    expect(isDeckComplete(null)).toBe(false);
  });

  it('counts distinct finished rows from deckProgressFor', () => {
    const rows = deckProgressFor({ decks: DECKS, learnedWords: LEARNED });
    expect(completedDeckCount(rows)).toBe(3);
    expect(completedDeckCount(rows.filter((r) => r.deckId !== 'third'))).toBe(2);
  });

  it('returns 0 for missing or malformed row lists', () => {
    expect(completedDeckCount(undefined)).toBe(0);
    expect(completedDeckCount(null)).toBe(0);
    expect(completedDeckCount('nope')).toBe(0);
    expect(completedDeckCount([])).toBe(0);
  });
});

describe('shouldStartPlacementOffer', () => {
  it('starts only at the 3-deck threshold', () => {
    expect(PLACEMENT_OFFER_THRESHOLD).toBe(3);
    expect(shouldStartPlacementOffer({ completedCount: 2 })).toBe(false);
    expect(shouldStartPlacementOffer({ completedCount: 3 })).toBe(true);
    expect(shouldStartPlacementOffer({ completedCount: 4 })).toBe(true);
  });

  it('does not start again after the banner was shown or dismissed', () => {
    expect(shouldStartPlacementOffer({ completedCount: 3, offer: { shownAt: 1 } })).toBe(false);
    expect(shouldStartPlacementOffer({ completedCount: 5, offer: { dismissedAt: 1 } })).toBe(false);
    expect(
      shouldStartPlacementOffer({ completedCount: 4, offer: { shownAt: 1, dismissedAt: 2 } })
    ).toBe(false);
  });

  it('ignores junk offer blobs rather than throwing', () => {
    expect(shouldStartPlacementOffer({ completedCount: 3, offer: 'nope' })).toBe(true);
    expect(shouldStartPlacementOffer({ completedCount: 3, offer: [] })).toBe(true);
    expect(shouldStartPlacementOffer({ completedCount: Number.NaN })).toBe(false);
  });
});

describe('placementOffer persistence', () => {
  it('writes shownAt once and does not clobber it on a second record', () => {
    recordPlacementOfferShown({ now: 100 });
    expect(readPlacementOffer()).toMatchObject({ milestone: 3, shownAt: 100 });
    recordPlacementOfferShown({ now: 200 });
    expect(readPlacementOffer().shownAt).toBe(100);
    expect(loadState().placementOffer.shownAt).toBe(100);
  });

  it('records dismiss separately so a later deck cannot re-open the invite', () => {
    recordPlacementOfferShown({ now: 100 });
    recordPlacementOfferDismissed({ now: 150 });
    const offer = readPlacementOffer();
    expect(offer.shownAt).toBe(100);
    expect(offer.dismissedAt).toBe(150);
    expect(shouldStartPlacementOffer({ completedCount: 4, offer })).toBe(false);
  });

  it('merges onto the existing blob instead of replacing it', () => {
    writePlacementOffer({ shownAt: 1 });
    const s = loadState();
    expect(s.placementOffer.shownAt).toBe(1);
    expect(s.settingsUpdatedAt).toEqual(expect.any(Number));
  });

  it('drops malformed stored records', () => {
    expect(normalizePlacementOffer(null)).toBeNull();
    expect(normalizePlacementOffer({ shownAt: 'nope' })).toBeNull();
    expect(normalizePlacementOffer({ shownAt: 1 }).shownAt).toBe(1);
  });
});
