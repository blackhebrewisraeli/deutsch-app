import { resolveCard } from './resolve';

const BASE = '/lexicon';
let indexPromise = null;
const chunkPromises = new Map();

export function __resetCache() {
  indexPromise = null;
  chunkPromises.clear();
}

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`).then((r) => {
      if (!r.ok) throw new Error(`lexicon index ${r.status}`);
      return r.json();
    });
  }
  return indexPromise;
}

function chunkName(chunk) {
  return `chunk-${String(chunk).padStart(2, '0')}.json`;
}

function loadChunk(chunk) {
  if (!chunkPromises.has(chunk)) {
    chunkPromises.set(
      chunk,
      fetch(`${BASE}/${chunkName(chunk)}`).then((r) => {
        if (!r.ok) throw new Error(`lexicon ${chunkName(chunk)} ${r.status}`);
        return r.json();
      })
    );
  }
  return chunkPromises.get(chunk);
}

export async function loadChunks(chunkIds) {
  const datas = await Promise.all([...new Set(chunkIds)].map(loadChunk));
  return Object.assign({}, ...datas);
}

function matches(row, auto) {
  if (auto.by === 'freq')
    return row.rank != null && row.rank >= auto.range[0] && row.rank <= auto.range[1];
  if (auto.by === 'cefr') return row.cefr === auto.level;
  if (auto.by === 'tag') return Array.isArray(row.tags) && row.tags.includes(auto.tag);
  throw new Error(`resolveAutoDeck: unknown auto.by "${auto.by}"`);
}

export async function resolveAutoDeck(deckDef) {
  const index = await loadIndex();
  const rows = index
    .filter((row) => matches(row, deckDef.auto))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const entries = await loadChunks(rows.map((r) => r.chunk));
  return rows.map((r) => resolveCard(entries[r.id]));
}
