import { describe, it, expect } from 'vitest';
import { validateLexiconEntry } from './validate';
import manifest from '../../public/lexicon/manifest.json';
import index from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';

describe('sample lexicon artifacts', () => {
  it('manifest matches chunk count and total', () => {
    expect(manifest.chunkCount).toBe(2);
    expect(manifest.total).toBe(index.length);
  });
  it('every index row points at a present, valid entry', () => {
    const chunks = [chunk0, chunk1];
    for (const row of index) {
      const entry = chunks[row.chunk][row.id];
      expect(entry).toBeDefined();
      expect(validateLexiconEntry(entry)).toBe(true);
    }
  });
});
