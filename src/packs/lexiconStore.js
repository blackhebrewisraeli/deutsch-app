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
    indexPromise = fetch(`${BASE}/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon index ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        indexPromise = null; // allow retry on next call
        throw err;
      });
  }
  return indexPromise;
}

function chunkName(chunk) {
  return `chunk-${String(chunk).padStart(2, '0')}.json`;
}

function loadChunk(chunk) {
  if (!chunkPromises.has(chunk)) {
    const p = fetch(`${BASE}/${chunkName(chunk)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon ${chunkName(chunk)} ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        chunkPromises.delete(chunk); // allow retry on next call
        throw err;
      });
    chunkPromises.set(chunk, p);
  }
  return chunkPromises.get(chunk);
}

export async function loadChunks(chunkIds) {
  const datas = await Promise.all([...new Set(chunkIds)].map(loadChunk));
  return Object.assign({}, ...datas);
}

// NOTE: this rule vocabulary (top/freq/cefr/tag) is duplicated in src/packs/resolve.js,
// which resolves decks synchronously over an in-memory lexicon. Keep the two in sync.
function matches(row, auto) {
  if (auto.by === 'freq')
    return row.rank != null && row.rank >= auto.range[0] && row.rank <= auto.range[1];
  if (auto.by === 'cefr') return row.cefr === auto.level;
  if (auto.by === 'tag') {
    const wanted = Array.isArray(auto.tag) ? auto.tag : [auto.tag];
    return Array.isArray(row.tags) && row.tags.some((t) => wanted.includes(t));
  }
  if (auto.by === 'top') return true; // ranked slice happens after sorting
  throw new Error(`resolveAutoDeck: unknown auto.by "${auto.by}"`);
}

/**
 * Pure row-selection: filters the index against a deck's auto rule, sorts by
 * rank, and (for 'top' decks) slices to count. No fetching. Exported so tests
 * can exercise the exact production selection logic against the real index.
 */
export function selectRows(index, auto) {
  let rows = index
    .filter((row) => matches(row, auto))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  if (auto.by === 'top') rows = rows.slice(0, auto.count);
  return rows;
}

export async function resolveAutoDeck(deckDef) {
  const rows = selectRows(await loadIndex(), deckDef.auto);
  const entries = await loadChunks(rows.map((r) => r.chunk));
  // The service worker caches the index and each chunk as separate entries, and a
  // chunk is only revalidated when a deck touches it — so a refreshed index can pair
  // with a long-cached chunk. Chunk packing is positional (buildArtifacts assigns
  // chunk = floor(i / chunkSize)), so ANY import that changes the entry count
  // reshuffles ids across chunks and opens that window. resolveCard dereferences its
  // argument immediately, so an unresolvable row would throw away the whole deck.
  // Render what resolves; the next load self-heals once the chunk revalidates.
  const missing = rows.filter((r) => !entries[r.id]);
  if (missing.length > 0) {
    // One warning per call, not per row: a stale chunk means ~500 missing ids.
    console.warn(
      `lexicon: ${missing.length} row(s) missing from loaded chunks, skipping — ` +
        missing
          .slice(0, 3)
          .map((r) => r.id)
          .join(', ')
    );
  }
  return rows.filter((r) => entries[r.id]).map((r) => resolveCard(entries[r.id]));
}
