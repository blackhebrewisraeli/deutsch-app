import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { validateLexiconEntry } from './validate';
import { grammar } from './de/grammar';
import { dePack } from './de/index';

// Guards the REAL shipped lexicon artifacts under public/lexicon (produced by the
// import pipeline), rather than a fixed hand-authored sample — so a bad import
// can't ship silently. vitest runs from the repo root, so repo-relative paths
// resolve here without a file:// URL. Deterministic-fixture tests that need
// specific ids live in lexiconStore.test.js against src/packs/__fixtures__/lexicon.
const DIR = 'public/lexicon';
const read = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));

describe('shipped lexicon artifacts', () => {
  const manifest = read('manifest.json');
  const index = read('index.json');
  const chunkFiles = readdirSync(DIR)
    .filter((f) => /^chunk-\d+\.json$/.test(f))
    .sort();
  const chunks = chunkFiles.map(read);

  it('manifest is internally consistent', () => {
    expect(manifest.total).toBe(index.length);
    expect(manifest.chunkCount).toBe(chunkFiles.length);
    expect(manifest.chunkSize).toBeGreaterThan(0);
    expect(index.length).toBeGreaterThan(0);
  });

  it('every index row resolves to a present, valid entry with matching fields', () => {
    for (const row of index) {
      const entry = chunks[row.chunk]?.[row.id];
      expect(entry, `missing ${row.id} in chunk ${row.chunk}`).toBeDefined();
      expect(entry.id).toBe(row.id);
      expect(entry.freqRank).toBe(row.rank);
      expect(entry.cefr).toBe(row.cefr);
      expect(validateLexiconEntry(entry, { grammar, cefrLevels: dePack.meta.cefrLevels })).toBe(
        true
      );
    }
  });

  it('entries are packed into chunks in index order by chunkSize', () => {
    index.forEach((row, i) => {
      expect(row.chunk).toBe(Math.floor(i / manifest.chunkSize));
    });
  });
});
