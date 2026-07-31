# Keep the cached lexicon fresh — design

Date: 2026-08-01 · Branch: `fix/lexicon-cache-freshness` · Base: `main` @ `c8d9819`

## Problem

The homograph merge (PR #75) shipped to production and reaches **new visitors only**.
Anyone who had opened the demo before that deploy keeps the pre-merge 4,480-entry
lexicon — duplicate homograph cards included — for up to 30 days.

`vite.config.js:19-28` caches lexicon JSON like this:

```js
runtimeCaching: [
  {
    urlPattern: /\/lexicon\/.*\.json$/,
    handler: 'CacheFirst',
    options: {
      cacheName: 'lexicon-json',
      expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
],
```

Three properties combine badly:

- **`CacheFirst`** returns the cached response without ever consulting the network.
- **The URLs are unhashed** — `/lexicon/index.json`, `/lexicon/chunk-00.json`. A new
  deploy writes new bytes to the same paths, so the cache key never changes.
- **`registerType: 'autoUpdate'` does not help.** It refreshes the *precache*
  (`globPatterns`: js/css/html/svg/png/woff2). Runtime-caching caches are not part of
  the precache manifest and are never purged on activation.

Nothing evicts `lexicon-json` until the 30-day expiry.

### Measured, not inferred

Against production on 2026-08-01, after the merge deployed:

- The origin is correct — `manifest.total` 4,201, all nine chunks byte-identical to
  `main`, zero rendered-German duplicates, 52 gender pairs intact.
- A first visit with caches cleared renders `in` once, answering `"in"`.
- **A returning visit does not.** Seeding a returning visitor's `lexicon-json` entry
  for `chunk-00.json` with the pre-merge answer and reloading against the live site
  rendered **"IN, INSIDE, WITHIN"** — the stale cached value — while the network was
  serving `"in"`. The service worker never revalidated.

A `lexicon-json` cache was already present on first contact with the site, so this is
the normal state of any returning visitor, not a constructed edge case.

## Constraint

Offline-after-first-load is a headline product promise, stated in the README at lines
98, 106 and 567 ("installable PWA, works offline after first load", "fully usable
offline"). Any fix must keep the lexicon readable with no network at all.

## Design

### 1 · `StaleWhileRevalidate` for lexicon JSON

Change the handler, keep everything else:

```js
handler: 'StaleWhileRevalidate',
```

The cache still answers instantly and still answers with no network, so the offline
promise is untouched. Every *online* load additionally revalidates in the background,
so the following load is current. A returning visitor sees stale content once, then
self-heals.

`cacheName`, `maxEntries: 64` and the 30-day expiry stay. Under `StaleWhileRevalidate`
the TTL only evicts entries nobody has touched for a month, which is the behaviour we
want. Eleven objects are cached in practice (index + nine chunks + manifest), well
inside `maxEntries`.

### 2 · Tolerate index/chunk skew in `resolveAutoDeck`

`src/packs/lexiconStore.js:79-83` today:

```js
export async function resolveAutoDeck(deckDef) {
  const rows = selectRows(await loadIndex(), deckDef.auto);
  const entries = await loadChunks(rows.map((r) => r.chunk));
  return rows.map((r) => resolveCard(entries[r.id]));
}
```

`resolveCard` dereferences `entry.id` on its first line, so a row with no matching
entry throws `TypeError: Cannot read properties of undefined` and the whole deck fails
to render.

That pairing is reachable. `index.json` is fetched on every load; `chunk-NN.json` is
fetched only when a deck touches that chunk. A visitor who loaded chunk 7 weeks ago
and reloads today gets a **revalidated index** alongside a **long-cached chunk 7**.

The mismatch is not hypothetical for this particular deploy. Chunk packing is
positional — `buildArtifacts` assigns `chunk = Math.floor(i / chunkSize)` — so
retiring 279 entries shifts every later entry into a different chunk. An old index row
can name a chunk that no longer contains its id, and an old index also still lists the
279 retired ids, which are gone from the new chunks entirely.

Fix: drop rows that cannot be resolved, and say so once.

```js
export async function resolveAutoDeck(deckDef) {
  const rows = selectRows(await loadIndex(), deckDef.auto);
  const entries = await loadChunks(rows.map((r) => r.chunk));
  const missing = rows.filter((r) => !entries[r.id]);
  if (missing.length > 0) {
    // Index and chunks are cached independently, so a revalidated index can pair
    // with a stale chunk. Chunk packing is positional, so any import that changes
    // the entry count reshuffles ids across chunks. Render what resolves rather
    // than throwing the whole deck away; the next load self-heals.
    console.warn(
      `lexicon: ${missing.length} row(s) missing from loaded chunks, skipping — ` +
        `${missing.slice(0, 3).map((r) => r.id).join(', ')}`
    );
  }
  return rows.filter((r) => entries[r.id]).map((r) => resolveCard(entries[r.id]));
}
```

One warning per call, not per row: a stale chunk means ~500 missing ids, and 500
console lines would bury the signal.

This is a permanent robustness improvement, not a migration shim. Every future import
that changes the entry count creates the same skew window.

## Cost

A returning visitor may see one stale render, and — only if they hold a stale chunk —
one slightly short deck, before it corrects. That is strictly better than the current
behaviour, where they see stale content for up to 30 days and would hit an
ErrorBoundary if the caches ever diverged.

`StaleWhileRevalidate` issues a background revalidation request per cached lexicon
object per load when online. That is at most eleven conditional GETs of static JSON
served from Vercel's CDN, and none of them blocks rendering.

## Non-goals

- **Versioned lexicon URLs**, or a per-build `cacheName`. Both give atomic swaps and
  remove the skew window entirely, but they discard the whole cached lexicon on every
  deploy, so returning users re-download all nine chunks for any change. SWR plus the
  skew guard reaches the same correctness for a far smaller diff.
- **A service-worker test harness.** The project has none, and adding one to assert a
  Workbox config value is disproportionate. The config change is verified on the
  Preview deployment instead.
- **Changing the offline story.** No change to what is cached, only to when it is
  refreshed.
- **Backfilling progress for the 279 retired ids.** Out of scope and already accepted
  in the merge design.

## Testing

`src/packs/lexiconStore.test.js` already drives `resolveAutoDeck` against
`src/packs/__fixtures__/lexicon`. Add:

- a deck whose index lists an id absent from the chunk resolves to the remaining cards
  instead of throwing;
- the surviving cards keep their order and content;
- `console.warn` fires once for that call and names the missing id;
- a fully-resolvable deck still resolves completely and warns not at all.

Full suite, lint and format before commit; `.husky/pre-commit` is never bypassed.

## Verification

Unit tests cover the skew guard. The caching change is verified against the Preview
deployment, because it cannot be observed in jsdom:

1. Load the Preview URL, confirm `caches.keys()` contains `lexicon-json` and it holds
   `/lexicon/index.json`.
2. Overwrite the cached `chunk-00.json` entry with a sentinel answer for `prep:in`.
3. Reload. The sentinel appears — the cache is being read, as before.
4. Reload again. The sentinel is **gone** and the answer is `"in"` — the background
   revalidation from step 3 has replaced it.

Step 4 is the whole point: under `CacheFirst` the sentinel survives every reload.
Confirm too that with the network offline the deck still renders from cache.
