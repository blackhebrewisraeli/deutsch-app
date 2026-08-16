import { describe, it, expect } from 'vitest';
import { assignRanks, topByRank, assignCefrBands, buildRankMap } from './rankLeipzig.js';

const rankMap = new Map([['brot', 142], ['gehen', 12]]);

describe('buildRankMap', () => {
  // Leipzig's list is case-sensitive and carries OCR/typo noise: the real
  // "Zeit" (count 1109) sits at line 152, a junk "zeit" (count 1) at line
  // 174097. Both lowercase to the same key. A later duplicate must never
  // overwrite the earlier, better rank — that clobbering dropped 327 common
  // nouns (Zeit, Mann, Frau, Arbeit, Kind, Sonntag) out of the shipped lexicon.
  it('keeps the first occurrence when a later line repeats it in another case', async () => {
    const map = await buildRankMap([
      '238\tZeit\t1109',
      '702\tMann\t702',
      '9\tzeit\t1',
    ]);
    expect(map.get('zeit')).toBe(1);
  });

  it('ranks by position in the file, counting every line with a word', async () => {
    const map = await buildRankMap(['1\tder\t9', '2\tund\t8', '3\tHund\t7']);
    expect([map.get('der'), map.get('und'), map.get('hund')]).toEqual([1, 2, 3]);
  });

  it('does not let a skipped duplicate shift the ranks that follow it', async () => {
    const map = await buildRankMap(['1\tZeit\t9', '2\tzeit\t1', '3\tHund\t7']);
    expect(map.get('hund')).toBe(3);
  });
});

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
