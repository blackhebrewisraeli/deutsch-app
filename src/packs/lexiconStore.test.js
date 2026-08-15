import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndex, loadChunks, resolveAutoDeck, selectRows, __resetCache } from './lexiconStore';
import { grammar } from './de/grammar';
import index from './__fixtures__/lexicon/index.json';
import chunk0 from './__fixtures__/lexicon/chunk-00.json';
import chunk1 from './__fixtures__/lexicon/chunk-01.json';

// A deliberately different second pack. Its data must never be served for 'de'
// and vice versa — that is the whole point of Phase 3a.
const xxIndex = [{ id: 'xx-solo', rank: 1, chunk: 0, cefr: 'A1', tags: ['test'] }];
const xxChunk0 = {
  'xx-solo': {
    id: 'xx-solo',
    de: 'solo',
    en: ['only'],
    pos: 'phrase',
    article: null,
    ipa: '[ˈsolo]',
    plural: null,
    cefr: 'A1',
    freqRank: 1,
    tags: ['test'],
    examples: [],
    verb: null,
    source: { dict: 'authored', license: 'MIT' },
  },
};

const fixtures = {
  '/lexicon/de/index.json': index,
  '/lexicon/de/chunk-00.json': chunk0,
  '/lexicon/de/chunk-01.json': chunk1,
  '/lexicon/xx/index.json': xxIndex,
  '/lexicon/xx/chunk-00.json': xxChunk0,
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
    await loadIndex('de');
    await loadIndex('de');
    const calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('/lexicon/de/index.json')
    );
    expect(calls).toHaveLength(1);
  });
});

describe('resolveAutoDeck', () => {
  it('resolves a freq-band deck ordered by rank, loading only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'freq', range: [1, 200] } }, grammar, 'de');
    // ranks in [1,200]: n:haus(60), n:wasser(88), n:brot(142) — all in chunk 0
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    expect(cards[0].de).toBe('das Haus'); // resolveCard display form
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('chunk-01.json')
    );
    expect(chunk1Calls).toHaveLength(0); // chunk 1 not needed
  });
  it('resolves a cefr deck across chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'cefr', level: 'A2' } }, grammar, 'de');
    expect(cards.map((c) => c.id).sort()).toEqual(['n:arbeit', 'n:bahnhof']);
  });
  it('resolves a tag deck', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
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
    await expect(loadIndex('de')).rejects.toThrow(/index 500/);
    const rows = await loadIndex('de'); // retry
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
    await expect(loadChunks('de', [0])).rejects.toThrow(/chunk-00/);
    const data = await loadChunks('de', [0]); // retry
    expect(data['n:brot'].id).toBe('n:brot');
    expect(calls).toBe(2);
  });
});

describe('resolveAutoDeck top and array tags', () => {
  it('top returns the N lowest-rank cards and loads only needed chunks', async () => {
    const cards = await resolveAutoDeck({ auto: { by: 'top', count: 3 } }, grammar, 'de');
    expect(cards.map((c) => c.id)).toEqual(['n:haus', 'n:wasser', 'n:brot']);
    const chunk1Calls = globalThis.fetch.mock.calls.filter((c) =>
      String(c[0]).endsWith('chunk-01.json')
    );
    expect(chunk1Calls).toHaveLength(0);
  });
  it('tag accepts an array and matches any of them', async () => {
    const cards = await resolveAutoDeck(
      { auto: { by: 'tag', tag: ['travel', 'work'] } },
      grammar,
      'de'
    );
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
      if (u.endsWith('/lexicon/de/index.json'))
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
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(cards.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']); // n:neu dropped
    warn.mockRestore();
  });

  it('keeps the surviving cards fully resolved and in rank order', async () => {
    serve(indexWithExtra);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(cards[0].de).toBe('das Wasser');
    expect(cards.every((c) => c && c.id && c.en)).toBe(true);
    warn.mockRestore();
  });

  it('warns once for the call, naming the missing id', async () => {
    serve(indexWithExtra);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/n:neu/);
    expect(warn.mock.calls[0][0]).toMatch(/1 row/);
    warn.mockRestore();
  });

  it('does not warn when every row resolves', async () => {
    serve(index);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cards = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(cards).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('pack isolation', () => {
  it('fetches each pack from its own directory', async () => {
    await loadIndex('de');
    await loadIndex('xx');
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/lexicon/de/index.json'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/lexicon/xx/index.json'))).toBe(true);
  });

  // Fails on the pre-3a store: the index promise was a single module-level
  // value, so the second pack got the first pack's data with no error.
  it('does not serve one pack index for another', async () => {
    const de = await loadIndex('de');
    const xx = await loadIndex('xx');
    expect(xx).toEqual(xxIndex);
    expect(xx).not.toEqual(de);
  });

  // Fails on the pre-3a store: chunkPromises keyed on the chunk NUMBER, so
  // chunk 0 loaded for 'de' was returned verbatim for 'xx'. Shapes match, so
  // nothing throws — the app would render German words in a second pack.
  it('does not serve one pack chunk for another', async () => {
    await loadChunks('de', [0]);
    const xx = await loadChunks('xx', [0]);
    expect(xx).toHaveProperty('xx-solo');
    expect(Object.keys(xx)).toEqual(['xx-solo']);
  });

  it('requests the chunk number, not the array index', async () => {
    await loadChunks('de', [1]);
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/lexicon/de/chunk-01.json'))).toBe(true);
    expect(urls.some((u) => u.includes('/lexicon/0/'))).toBe(false);
  });

  it('a failed fetch clears only that pack, leaving the other memoized', async () => {
    await loadIndex('de');
    await expect(loadIndex('nope')).rejects.toThrow();
    const before = globalThis.fetch.mock.calls.length;
    await loadIndex('de'); // still memoized — no new request
    expect(globalThis.fetch.mock.calls).toHaveLength(before);
  });
});

describe('selectRows pos modifier', () => {
  const index = [
    { id: 'n:a', rank: 1, cefr: 'A1', pos: 'noun', tags: [], chunk: 0 },
    { id: 'v:b', rank: 2, cefr: 'A1', pos: 'verb', tags: [], chunk: 0 },
    { id: 'n:c', rank: 3, cefr: 'A2', pos: 'noun', tags: [], chunk: 0 },
  ];

  it('composes with cefr rather than replacing it', () => {
    const rows = selectRows(index, { by: 'cefr', level: 'A1', pos: 'noun' });
    expect(rows.map((r) => r.id)).toEqual(['n:a']);
  });

  it('composes with top', () => {
    const rows = selectRows(index, { by: 'top', count: 10, pos: 'noun' });
    expect(rows.map((r) => r.id)).toEqual(['n:a', 'n:c']);
  });

  it('is optional — omitting it changes nothing', () => {
    expect(selectRows(index, { by: 'cefr', level: 'A1' }).map((r) => r.id)).toEqual(['n:a', 'v:b']);
  });

  it('fails closed on a row with no pos', () => {
    // A returning user can hold a cached index from before pos existed. Better
    // an empty Artikel deck for one load, self-healing on revalidation, than
    // verbs served into a gender drill.
    const stale = [{ id: 'n:a', rank: 1, cefr: 'A1', tags: [], chunk: 0 }];
    expect(selectRows(stale, { by: 'cefr', level: 'A1', pos: 'noun' })).toEqual([]);
  });
});

describe('auto.has drops cards missing a field', () => {
  it('keeps only cards carrying the named field', async () => {
    // The fixture's food entries both have a plural, so the first assertion is
    // not vacuous; a field nothing carries must empty the deck rather than
    // serve unanswerable cards.
    const withPlural = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'plural' } },
      grammar,
      'de'
    );
    expect(withPlural.length).toBeGreaterThan(0);
    expect(withPlural.every((c) => c.plural)).toBe(true);

    const withNothing = await resolveAutoDeck(
      { auto: { by: 'tag', tag: 'food', has: 'nosuchfield' } },
      grammar,
      'de'
    );
    expect(withNothing).toEqual([]);
  });

  it('is optional — omitting it changes nothing', async () => {
    const all = await resolveAutoDeck({ auto: { by: 'tag', tag: 'food' } }, grammar, 'de');
    expect(all.map((c) => c.id)).toEqual(['n:wasser', 'n:brot']);
  });
});
