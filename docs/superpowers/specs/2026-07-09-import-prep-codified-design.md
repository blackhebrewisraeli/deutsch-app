# One-Command Lexicon Import (codified prep) — Design

Date: 2026-07-09
Status: Approved (brainstorming) — pending spec review
Depends on: PR #60 (real lexicon import + parser fixes) — `prep-tatoeba.mjs`,
the README runbook, and the `read*` helper filenames this codifies.

## Goal

Make `npm run import:lexicon` a true one-command import. Today the pipeline
downloads raw archives but a documented **manual prep** stands between download
and run: fetch `eng_sentences` (missing from `SOURCES`), decompress `.bz2`/tars,
join Tatoeba de↔en pairs, frequency-sort the Leipzig words file, and hardlink the
Wiktextract `.jsonl` under a different name. Codify all of it, idempotently.

## Decisions (brainstorming)

- **Decompression: shell out** to system `bunzip2`/`tar` via `node:child_process`
  — zero new npm deps (repo keeps 7 runtime deps). Constraint accepted: the
  import runs on macOS/Linux only (Windows → WSL); it is a local-only offline
  script, documented in the README.
- Everything else is Node-native.

## 1. `download.js` — add the missing source

Add to `SOURCES`:

```js
tatoebaEngSentences: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
```

`ensureRaw` already iterates `SOURCES` and skips present files — no other change.

## 2. New `scripts/import-lexicon/prep.js` — idempotent prep orchestrator

Native Node ESM (explicit `.js` imports). Every step **skips when its output
file already exists** (same pattern as `ensureRaw`):

- **`decompress(cacheDir)`** — `execFileSync` shell-outs, each guarded by an
  output-exists check:
  - `bunzip2 -kf deu_sentences.tsv.bz2` → `deu_sentences.tsv`
  - `bunzip2 -kf eng_sentences.tsv.bz2` → `eng_sentences.tsv`
  - `tar xjf links.tar.bz2` → `links.csv`
  - `tar xzf deu_news_2023_100K.tar.gz` → `deu_news_2023_100K/…-words.txt`
  Thin shell glue; not unit-tested.
- **`buildFreqTsv(cacheDir)`** — reads the Leipzig words file
  (`id \t word \t frequency`), sorts by frequency **descending**, writes
  `freq.tsv` (line order = rank; `readRankMap` reads the word from column 2).
  The pure core **`sortByFrequency(lines) → lines`** is exported and
  unit-tested. This removes the "Leipzig is not pre-sorted" trap for good.
- **`buildTatoebaPairs(cacheDir)`** — the de↔en join, absorbed from
  `prep-tatoeba.mjs` into a proper pipeline module **`prepTatoeba.js`**
  (exported async function; same logic: load deu+eng sentence maps, stream
  `links.csv`, match links bidirectionally, dedupe by German text, write
  `tatoeba-de-en.tsv`). Tested against tiny fixture TSVs in a tmp dir.
  **`prep-tatoeba.mjs` is deleted** (superseded).
- **`ensurePrepared(cacheDir)`** — runs decompress → buildFreqTsv →
  buildTatoebaPairs, each idempotent.

## 3. `index.js` — wire in prep; drop the rename

- Call `ensurePrepared(cacheDir)` immediately after `ensureRaw(cacheDir)`.
- `readParsed` reads the downloaded basename
  `kaikki.org-dictionary-German.jsonl` directly — the `wiktextract.jsonl`
  hardlink/rename step disappears.

## 4. `package.json` + README

- `"import:lexicon": "node --max-old-space-size=4096 scripts/import-lexicon/index.js"`
  (heap flag baked in — the Tatoeba example index needs it).
- README "Importing vocabulary": the multi-command manual-prep block collapses
  to — run `npm run import:lexicon` (macOS/Linux; needs system `tar`/`bunzip2`;
  first run downloads ~1.2 GB into `.cache/lexicon-raw/`), then spot-check the
  printed JSON report before committing `public/lexicon/`.

## 5. Testing & verification

- **Unit:** `sortByFrequency` (descending by col-3, tab parsing, stable
  handling of malformed lines); `buildTatoebaPairs`/`prepTatoeba` against
  fixture TSVs written to a tmp dir (fs-based, like `chunk.test.js`):
  bidirectional link matching, dedupe-by-German-text, `de \t en` output shape.
- **End-to-end proof (one-off, using the still-cached raw downloads):** delete
  the *prepared* files (`freq.tsv`, `tatoeba-de-en.tsv`, decompressed outputs)
  and run `npm run import:lexicon`. It must regenerate the prep files and
  produce `public/lexicon/` artifacts identical to the shipped ones except
  `manifest.generatedAt`. A second run must skip all prep steps (idempotence).

## 6. Out of scope (YAGNI)

Windows support; progress reporting; configurable source URLs/paths; checksum
verification of downloads; re-download/refresh logic beyond the exists-check;
parallelizing prep.

## 7. Risks

- **System-tool dependence** (`bunzip2`, `tar`): both ship with macOS and
  mainstream Linux. If missing, `execFileSync` throws with a clear ENOENT —
  acceptable for a local dev script; README states the requirement.
- **Exists-check staleness:** if a raw download is replaced (new dump), stale
  prepared files won't rebuild until deleted. Accepted — same semantics as
  `ensureRaw`; the README notes "delete `.cache/lexicon-raw` to re-import from
  fresh dumps".
