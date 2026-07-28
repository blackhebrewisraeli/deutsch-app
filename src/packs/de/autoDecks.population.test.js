import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTO_DECKS } from './autoDecks';

// Guards the SHIPPED decks against the REAL lexicon index: every auto deck a user
// can click must resolve to real cards. Seven Topic decks once shipped resolving
// to zero because they filtered on tags that do not exist in the imported data —
// this test is what makes that impossible to repeat. Index-level only (no fetch):
// mirrors lexiconStore's matching, which is unit-tested separately.
const MIN_CARDS = 40;
const index = JSON.parse(readFileSync('public/lexicon/index.json', 'utf8'));

const rowsFor = (auto) => {
  if (auto.by === 'top') {
    return [...index]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .slice(0, auto.count);
  }
  if (auto.by === 'cefr') return index.filter((r) => r.cefr === auto.level);
  if (auto.by === 'tag') {
    const wanted = Array.isArray(auto.tag) ? auto.tag : [auto.tag];
    return index.filter((r) => Array.isArray(r.tags) && r.tags.some((t) => wanted.includes(t)));
  }
  if (auto.by === 'freq') {
    return index.filter(
      (r) => r.rank != null && r.rank >= auto.range[0] && r.rank <= auto.range[1]
    );
  }
  throw new Error(`unknown auto.by "${auto.by}"`);
};

describe('shipped auto decks resolve against the real lexicon', () => {
  it.each(AUTO_DECKS.map((d) => [d.name, d]))(
    '"%s" resolves to at least ' + MIN_CARDS + ' cards',
    (_name, deck) => {
      expect(rowsFor(deck.auto).length).toBeGreaterThanOrEqual(MIN_CARDS);
    }
  );

  it('every deck id is unique', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
