import { describe, it, expect } from 'vitest';
import { assignRanks, topByRank, assignCefrBands } from './rankLeipzig.js';

const rankMap = new Map([['brot', 142], ['gehen', 12]]);

describe('assignRanks', () => {
  it('assigns freqRank from the map, null when absent, and no cefr', () => {
    const out = assignRanks(
      [{ lemma: 'Brot' }, { lemma: 'gehen' }, { lemma: 'Quark' }],
      rankMap
    );
    expect(out).toEqual([
      { lemma: 'Brot', freqRank: 142 },
      { lemma: 'gehen', freqRank: 12 },
      { lemma: 'Quark', freqRank: null },
    ]);
  });
});

describe('topByRank', () => {
  it('keeps ranked entries, sorts ascending, slices to n', () => {
    const out = topByRank(
      [{ lemma: 'Brot', freqRank: 142 }, { lemma: 'gehen', freqRank: 12 }, { lemma: 'Quark', freqRank: null }],
      1
    );
    expect(out.map((e) => e.lemma)).toEqual(['gehen']);
  });
});

describe('assignCefrBands', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, freqRank: i + 1 }));

  it('splits 20/30/50 by position, most frequent first', () => {
    const out = assignCefrBands(mk(10));
    expect(out.map((e) => e.cefr)).toEqual([
      'A1', 'A1', 'A2', 'A2', 'A2', 'B1', 'B1', 'B1', 'B1', 'B1',
    ]);
  });

  it('orders by rank with nulls last', () => {
    const out = assignCefrBands([
      { id: 'c', freqRank: null },
      { id: 'a', freqRank: 5 },
      { id: 'b', freqRank: 1 },
    ]);
    expect(out.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('honours custom proportions', () => {
    const out = assignCefrBands(mk(10), { a1: 0.5, a2: 0.8 });
    expect(out.filter((e) => e.cefr === 'A1')).toHaveLength(5);
    expect(out.filter((e) => e.cefr === 'A2')).toHaveLength(3);
    expect(out.filter((e) => e.cefr === 'B1')).toHaveLength(2);
  });

  it('returns [] for an empty list and does not mutate the input order', () => {
    expect(assignCefrBands([])).toEqual([]);
    const input = [{ id: 'x', freqRank: 9 }, { id: 'y', freqRank: 1 }];
    assignCefrBands(input);
    expect(input.map((e) => e.id)).toEqual(['x', 'y']);
  });
});
