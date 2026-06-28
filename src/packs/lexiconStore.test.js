import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndex, resolveAutoDeck, __resetCache } from './lexiconStore';
import index from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';

const fixtures = {
  '/lexicon/index.json': index,
  '/lexicon/chunk-00.json': chunk0,
  '/lexicon/chunk-01.json': chunk1,
};

beforeEach(() => {
  __resetCache();
  globalThis.fetch = vi.fn((url) => {
    const key = Object.keys(fixtures).find((k) => url.endsWith(k));
    if (!key) return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) });
  });
});

describe('loadIndex', () => {
  it('fetches the index once and memoizes', async () => {
    await loadIndex();
    await loadIndex();
    const calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('/lexicon/index.json')
    );
    expect(calls).toHaveLength(1);
  });
});

describe('resolveAutoDeck', () => {
  it('resolves a freq-band deck ordered by rank, loading only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'freq', range: [1, 200] } });
    // ranks in [1,200]: n:haus(60), n:wasser(88), n:brot(142) — all in chunk 0
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    expect(cards[0].de).toBe('das Haus'); // resolveCard display form
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('chunk-01.json')
    );
    expect(chunk1Calls).toHaveLength(0); // chunk 1 not needed
  });
  it('resolves a cefr deck across chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'cefr', level: 'A2' } });
    expect(cards.map((c) => c.id).sort()).toEqual(['n:arbeit', 'n:bahnhof']);
  });
  it('resolves a tag deck', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(cards.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']); // 88 then 142
  });
});
