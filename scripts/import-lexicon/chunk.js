import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pad2 = (n) => String(n).padStart(2, '0');

export function buildArtifacts(entries, { chunkSize = 500, sources = {} } = {}) {
  const chunkCount = Math.max(1, Math.ceil(entries.length / chunkSize));
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    name: `chunk-${pad2(i)}.json`,
    data: {},
  }));
  const index = entries.map((entry, i) => {
    const chunk = Math.floor(i / chunkSize);
    chunks[chunk].data[entry.id] = entry;
    return { id: entry.id, rank: entry.freqRank, cefr: entry.cefr, tags: entry.tags, chunk };
  });
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources,
    total: entries.length,
    chunkSize,
    chunkCount: entries.length === 0 ? 0 : chunkCount,
  };
  return { manifest, index, chunks };
}

export function writeArtifacts(outDir, { manifest, index, chunks }) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
  for (const c of chunks) writeFileSync(join(outDir, c.name), JSON.stringify(c.data));
}
