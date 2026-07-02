import { describe, it, expect } from 'vitest';
import { assignRanks, topByRank } from './rankLeipzig.js';

const rankMap = new Map([['brot', 142], ['gehen', 12]]);

describe('assignRanks', () => {
  it('assigns freqRank + cefr from the map, null when absent', () => {
    const out = assignRanks(
      [{ lemma: 'Brot' }, { lemma: 'gehen' }, { lemma: 'Quark' }],
      rankMap
    );
    expect(out).toEqual([
      { lemma: 'Brot', freqRank: 142, cefr: 'A1' },
      { lemma: 'gehen', freqRank: 12, cefr: 'A1' },
      { lemma: 'Quark', freqRank: null, cefr: null },
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
