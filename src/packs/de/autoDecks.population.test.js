import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTO_DECKS } from './autoDecks';
import { selectRows } from '../lexiconStore';

// Guards the SHIPPED decks against the REAL lexicon index: every auto deck a user
// can click must resolve to real cards. Seven Topic decks once shipped resolving
// to zero because they filtered on tags that do not exist in the imported data —
// this test is what makes that impossible to repeat. Index-level only (no fetch):
// runs the real selectRows() from lexiconStore.js against the real index, so a
// regression in production row-selection (e.g. tag matching) fails this test.
const MIN_CARDS = 40;
const index = JSON.parse(readFileSync('public/lexicon/de/index.json', 'utf8'));

describe('shipped auto decks resolve against the real lexicon', () => {
  it.each(AUTO_DECKS.map((d) => [d.name, d]))(
    '"%s" resolves to at least ' + MIN_CARDS + ' cards',
    (_name, deck) => {
      expect(selectRows(index, deck.auto).length).toBeGreaterThanOrEqual(MIN_CARDS);
    }
  );

  it('every deck id is unique', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
