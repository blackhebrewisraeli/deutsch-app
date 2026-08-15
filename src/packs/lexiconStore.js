import { resolveCard } from './resolve';

// Artifacts live under a per-pack directory so two packs can ship a lexicon
// without colliding: /lexicon/de/index.json, /lexicon/es/index.json, …
const base = (packId) => `/lexicon/${packId}`;

// Both caches are keyed by pack. Keying chunks on the chunk NUMBER alone —
// as this module did before Phase 3a — returns one pack's chunk for another's
// request. The shapes match, so nothing throws; the app just renders the wrong
// language.
const indexPromises = new Map(); // packId → Promise
const chunkPromises = new Map(); // `${packId}:${chunk}` → Promise

export function __resetCache() {
  indexPromises.clear();
  chunkPromises.clear();
}

export function loadIndex(packId) {
  if (!indexPromises.has(packId)) {
    const p = fetch(`${base(packId)}/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon index ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        indexPromises.delete(packId); // allow retry on next call
        throw err;
      });
    indexPromises.set(packId, p);
  }
  return indexPromises.get(packId);
}

function chunkName(chunk) {
  return `chunk-${String(chunk).padStart(2, '0')}.json`;
}

function loadChunk(packId, chunk) {
  const key = `${packId}:${chunk}`;
  if (!chunkPromises.has(key)) {
    const p = fetch(`${base(packId)}/${chunkName(chunk)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`lexicon ${chunkName(chunk)} ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        chunkPromises.delete(key); // allow retry on next call
        throw err;
      });
    chunkPromises.set(key, p);
  }
  return chunkPromises.get(key);
}

export async function loadChunks(packId, chunkIds) {
  // An explicit arrow, NOT .map(loadChunk): map passes (element, index, array),
  // so the bare reference would hand the array index to `chunk`.
  const datas = await Promise.all([...new Set(chunkIds)].map((c) => loadChunk(packId, c)));
  return Object.assign({}, ...datas);
}

// NOTE: this rule vocabulary (top/freq/cefr/tag) is duplicated in src/packs/resolve.js,
// which resolves decks synchronously over an in-memory lexicon. Keep the two in sync.
function matches(row, auto) {
  // A modifier, not a `by` kind: it composes with every selector, so
  // "A1 nouns" and "the 100 most frequent verbs" both fall out for free.
  // Fails closed on a row with no pos — a cached pre-pos index yields an
  // empty deck that self-heals, rather than the wrong part of speech.
  if (auto.pos && row.pos !== auto.pos) return false;
  // NOTE: `auto.has` is NOT handled here — see resolveAutoDeck. It names a field
  // on the resolved card, which the index does not carry.
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

export async function resolveAutoDeck(deckDef, grammar, packId) {
  const auto = deckDef.auto;
  const rows = selectRows(await loadIndex(packId), auto);
  const entries = await loadChunks(
    packId,
    rows.map((r) => r.chunk)
  );
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
  const cards = rows.filter((r) => entries[r.id]).map((r) => resolveCard(entries[r.id], grammar));
  // `auto.has` is applied HERE and not in selectRows, deliberately. selectRows
  // filters the index, and the index carries only id/rank/cefr/pos/tags/chunk —
  // it cannot know whether an entry has a plural. `pos` earned an index field in
  // #105 because selection cannot proceed without it; this cannot be known until
  // the chunks are already loaded, so an index field would buy nothing and cost
  // ~60 KB. The split is inherent. Do not "tidy" this into matches().
  return auto.has ? cards.filter((c) => c[auto.has]) : cards;
}
