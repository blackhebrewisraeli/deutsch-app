import { describe, it, expect } from 'vitest';
import { cleanExamples, keepEntry, applyFilter } from './filter.js';

const ex = (de, en) => ({ de, en, source: 'tatoeba' });

describe('cleanExamples', () => {
  it('drops over-long and empty examples', () => {
    const long = 'a'.repeat(200);
    expect(cleanExamples([ex('Ich esse Brot.', 'I eat bread.'), ex(long, 'x'), ex('', 'y')], {})).toEqual([
      ex('Ich esse Brot.', 'I eat bread.'),
    ]);
  });
});

describe('keepEntry', () => {
  const base = { id: 'n:brot', pos: 'noun', article: 'das', verb: null, examples: [ex('Ich esse Brot.', 'I eat bread.')] };
  it('keeps a valid noun', () => {
    expect(keepEntry(base)).toEqual({ keep: true, reason: null });
  });
  it('drops a noun without an article', () => {
    expect(keepEntry({ ...base, article: null }).keep).toBe(false);
  });
  it('drops a verb without a verb block', () => {
    expect(keepEntry({ ...base, pos: 'verb', article: null }).reason).toMatch(/verb/);
  });
  it('drops an entry with no examples', () => {
    expect(keepEntry({ ...base, examples: [] }).reason).toMatch(/example/);
  });
});

describe('applyFilter', () => {
  it('partitions kept vs rejected and cleans examples', () => {
    const long = 'a'.repeat(200);
    const entries = [
      { id: 'n:brot', pos: 'noun', article: 'das', verb: null, examples: [ex('Ich esse Brot.', 'I eat bread.')] },
      { id: 'n:bad', pos: 'noun', article: null, verb: null, examples: [ex('x', 'y')] },
      { id: 'n:nolex', pos: 'noun', article: 'die', verb: null, examples: [ex(long, 'y')] },
    ];
    const { kept, rejected } = applyFilter(entries);
    expect(kept.map((e) => e.id)).toEqual(['n:brot']);
    expect(rejected.map((r) => r.id).sort()).toEqual(['n:bad', 'n:nolex']);
  });
});
