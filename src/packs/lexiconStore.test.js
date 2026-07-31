import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndex, loadChunks, resolveAutoDeck, __resetCache } from './lexiconStore';
import index from './__fixtures__/lexicon/index.json';
import chunk0 from './__fixtures__/lexicon/chunk-00.json';
import chunk1 from './__fixtures__/lexicon/chunk-01.json';

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

describe('transient failure recovery', () => {
  it('loadIndex re-fetches after a failed attempt (rejected promise not cached)', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: false, status: 500 });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(index) });
    });
    await expect(loadIndex()).rejects.toThrow(/index 500/);
    const rows = await loadIndex(); // retry
    expect(rows).toBe(index);
    expect(calls).toBe(2); // the failed promise was evicted, not memoized
  });

  it('loadChunks re-fetches a chunk after a failed attempt', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(chunk0) });
    });
    await expect(loadChunks([0])).rejects.toThrow(/chunk-00/);
    const data = await loadChunks([0]); // retry
    expect(data['n:brot'].id).toBe('n:brot');
    expect(calls).toBe(2);
  });
});

describe('resolveAutoDeck top and array tags', () => {
  it('top returns the N lowest-rank cards and loads only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'top', count: 3 } });
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('chunk-01.json')
    );
    expect(chunk1Calls).toHaveLength(0);
  });
  it('tag accepts an array and matches any of them', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: ['travel', 'work'] } });
    expect(cards.map((c) => c.id).sort()).toEqual(['n:arbeit', 'n:bahnhof']);
  });
});

// Index and chunks are cached independently by the service worker
// (StaleWhileRevalidate, one cache entry per URL), and a chunk is only revalidated
// when a deck touches it. So a refreshed index can pair with a long-cached chunk.
// Chunk packing is positional, so any import that changes the entry count reshuffles
// ids across chunks and opens this window. See
// docs/superpowers/specs/2026-08-01-lexicon-cache-freshness-design.md
describe('resolveAutoDeck with a stale chunk', () => {
  // A fresh index listing a card that the stale chunk-00 does not contain.
  const indexWithExtra = [
    ...index,
    { id: 'n:neu', rank: 90, cefr: 'A1', tags: ['food'], chunk: 0 },
  ];

  const serve = (idx) => {
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.endsWith('/lexicon/index.json'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(idx) });
      if (u.endsWith('chunk-00.json'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(chunk0) });
      if (u.endsWith('chunk-01.json'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(chunk1) });
      return Promise.resolve({ ok: false, status: 404 });
    });
  };

  it('skips rows missing from the chunk instead of throwing', async () => {
    serve(indexWithExtra);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(cards.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']); // n:neu dropped
    warn.mockRestore();
  });

  it('keeps the surviving cards fully resolved and in rank order', async () => {
    serve(indexWithExtra);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(cards[0].de).toBe('das Wasser');
    expect(cards.every((c) => c && c.id && c.en)).toBe(true);
    warn.mockRestore();
  });

  it('warns once for the call, naming the missing id', async () => {
    serve(indexWithExtra);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/n:neu/);
    expect(warn.mock.calls[0][0]).toMatch(/1 row/);
    warn.mockRestore();
  });

  it('does not warn when every row resolves', async () => {
    serve(index);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } });
    expect(cards).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
