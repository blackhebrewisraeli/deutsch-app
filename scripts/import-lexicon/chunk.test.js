import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifacts, writeArtifacts } from './chunk.js';

const mk = (id, rank, cefr, tags = []) => ({
  id, de: id, en: ['x'], pos: 'noun', article: 'das', ipa: null, plural: null,
  cefr, freqRank: rank, tags, examples: [{ de: 'a', en: 'b', source: 'tatoeba' }],
  verb: null, source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0' },
});

describe('buildArtifacts', () => {
  it('splits entries into chunks and builds the index + manifest', () => {
    const entries = [mk('n:a', 1, 'A1', ['food']), mk('n:b', 2, 'A1'), mk('n:c', 3, 'A1')];
    const { manifest, index, chunks } = buildArtifacts(entries, { chunkSize: 2, sources: { tatoeba: 'x' } });
    expect(manifest.total).toBe(3);
    expect(manifest.chunkSize).toBe(2);
    expect(manifest.chunkCount).toBe(2);
    expect(index).toEqual([
      { id: 'n:a', rank: 1, cefr: 'A1', tags: ['food'], chunk: 0 },
      { id: 'n:b', rank: 2, cefr: 'A1', tags: [], chunk: 0 },
      { id: 'n:c', rank: 3, cefr: 'A1', tags: [], chunk: 1 },
    ]);
    expect(chunks.map((c) => c.name)).toEqual(['chunk-00.json', 'chunk-01.json']);
    expect(Object.keys(chunks[0].data)).toEqual(['n:a', 'n:b']);
    expect(chunks[1].data['n:c'].id).toBe('n:c');
  });

  it('emits zero chunks for an empty entry set (manifest and chunks agree)', () => {
    const { manifest, index, chunks } = buildArtifacts([], { chunkSize: 500 });
    expect(manifest.total).toBe(0);
    expect(manifest.chunkCount).toBe(0);
    expect(index).toEqual([]);
    expect(chunks).toEqual([]); // no ghost chunk-00.json
  });
});

describe('writeArtifacts', () => {
  it('writes manifest, index, and chunk files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lex-'));
    const entries = [mk('n:a', 1, 'A1')];
    writeArtifacts(dir, buildArtifacts(entries, { chunkSize: 500 }));
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(dir, 'index.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'chunk-00.json'), 'utf8'))['n:a'].id).toBe('n:a');
  });
});
