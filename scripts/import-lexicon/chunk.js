import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pad2 = (n) => String(n).padStart(2, '0');

export function buildArtifacts(entries, { chunkSize = 500, sources = {} } = {}) {
  // No Math.max floor: an empty entry set yields zero chunks, so chunkCount and
  // the chunks array agree (no ghost chunk-00.json written for an empty import).
  const chunkCount = Math.ceil(entries.length / chunkSize);
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    name: `chunk-${pad2(i)}.json`,
    data: {},
  }));
  const index = entries.map((entry, i) => {
    const chunk = Math.floor(i / chunkSize);
    chunks[chunk].data[entry.id] = entry;
    // pos is in the index (not just the chunk) so selectRows can filter by part
    // of speech without fetching chunks — the whole point of the index. The `n:`
    // id prefix encodes the same thing, but POS_PREFIX belongs to ids.js and
    // duplicating that convention in the runtime store is two values that must
    // agree with nothing checking that they do.
    return {
      id: entry.id,
      rank: entry.freqRank,
      cefr: entry.cefr,
      pos: entry.pos,
      tags: entry.tags,
      chunk,
    };
  });
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources,
    total: entries.length,
    chunkSize,
    chunkCount,
  };
  return { manifest, index, chunks };
}

export function writeArtifacts(outDir, { manifest, index, chunks }) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
  for (const c of chunks) writeFileSync(join(outDir, c.name), JSON.stringify(c.data));
}
