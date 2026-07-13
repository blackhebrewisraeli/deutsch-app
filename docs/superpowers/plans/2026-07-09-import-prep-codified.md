# One-Command Lexicon Import (codified prep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run import:lexicon` a true one-command import — download all sources (incl. the missing `eng_sentences`), decompress, join Tatoeba pairs, frequency-sort Leipzig, and run the pipeline, all idempotently.

**Architecture:** A new `prep.js` orchestrates three idempotent steps (shell-out decompress; Node-native freq sort with a tested pure core; the Tatoeba de↔en join absorbed from `prep-tatoeba.mjs` into a proper `prepTatoeba.js` module). `index.js` calls `ensurePrepared(cacheDir)` after `ensureRaw` and reads the Wiktextract download by its real basename (no more rename step).

**Tech Stack:** Node 20+ ESM (native `node:` modules only; `execFileSync` shell-outs to system `bunzip2`/`tar`). Vitest with tmp-dir fs fixtures.

## Global Constraints

- **Never bypass `.husky/pre-commit`** — `lint-staged` + full `npm test`; no `--no-verify`; wait for it (allow 10 min).
- **`scripts/` ESM imports use explicit `.js` extensions** (native Node); Node built-ins use the `node:` prefix.
- **Idempotence rule (exact):** every prep step skips when its output file already exists (same semantics as `ensureRaw`). Prepared filenames are fixed: `deu_sentences.tsv`, `eng_sentences.tsv`, `links.csv`, `deu_news_2023_100K/deu_news_2023_100K-words.txt`, `freq.tsv`, `tatoeba-de-en.tsv`.
- **Decompression is shell-out only** (`bunzip2 -kf`, `tar xjf/xzf -C`) — no new npm dependencies. macOS/Linux only; documented in README.
- **No fabrication of data; no changes to `public/lexicon/` artifacts** — the E2E check restores them (`git checkout -- public/lexicon`) so this PR ships no artifact churn.
- Match existing 2-space indent / quote style.

## File Structure
- Create `scripts/import-lexicon/prepTatoeba.js` — exported `buildTatoebaPairs(cacheDir)` (absorbs `prep-tatoeba.mjs`).
- Create `scripts/import-lexicon/prepTatoeba.test.js` — tmp-dir fixture test.
- Delete `scripts/import-lexicon/prep-tatoeba.mjs` (superseded).
- Create `scripts/import-lexicon/prep.js` — `sortByFrequency`, `buildFreqTsv`, `decompress`, `ensurePrepared`.
- Create `scripts/import-lexicon/prep.test.js` — unit + tmp-dir tests (no shell-out coverage).
- Modify `scripts/import-lexicon/download.js` — add `tatoebaEngSentences` to `SOURCES`.
- Modify `scripts/import-lexicon/index.js` — call `ensurePrepared`; read `kaikki.org-dictionary-German.jsonl`.
- Modify `package.json` — bake `--max-old-space-size=4096` into `import:lexicon`.
- Modify `README.md` — collapse the manual-prep runbook.

---

## Task 1: `prepTatoeba.js` — the de↔en join as a tested module

**Files:**
- Create: `scripts/import-lexicon/prepTatoeba.js`
- Create: `scripts/import-lexicon/prepTatoeba.test.js`
- Delete: `scripts/import-lexicon/prep-tatoeba.mjs`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `buildTatoebaPairs(cacheDir) => Promise<string /* outPath */>`. Reads `deu_sentences.tsv` / `eng_sentences.tsv` (`id \t lang \t text`) and `links.csv` (`id \t id`) from `cacheDir`; writes `tatoeba-de-en.tsv` (`de \t en`, one English pairing per German sentence, bidirectional link matching). **Skips (returns path) when the output already exists.** Awaits stream end before resolving.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/prepTatoeba.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTatoebaPairs } from './prepTatoeba.js';

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatoeba-'));
  writeFileSync(
    join(dir, 'deu_sentences.tsv'),
    ['10\tdeu\tIch esse Brot.', '11\tdeu\tWir gehen.', '12\tdeu\tDas ist gut.'].join('\n') + '\n'
  );
  writeFileSync(
    join(dir, 'eng_sentences.tsv'),
    ['20\teng\tI eat bread.', '21\teng\tWe go.', '22\teng\tThat is good.'].join('\n') + '\n'
  );
  return dir;
};

describe('buildTatoebaPairs', () => {
  it('joins de↔en pairs via links, matching either link direction', async () => {
    const dir = setup();
    // 10→20 forward; 21→11 REVERSE (eng id first); 99→98 unknown ids (skipped)
    writeFileSync(join(dir, 'links.csv'), ['10\t20', '21\t11', '99\t98'].join('\n') + '\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe(
      'Ich esse Brot.\tI eat bread.\nWir gehen.\tWe go.\n'
    );
  });

  it('keeps only one English pairing per German sentence', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'links.csv'), ['10\t20', '10\t22'].join('\n') + '\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe(
      'Ich esse Brot.\tI eat bread.\n'
    );
  });

  it('is idempotent: skips when the output already exists', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'links.csv'), '10\t20\n');
    writeFileSync(join(dir, 'tatoeba-de-en.tsv'), 'SENTINEL\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe('SENTINEL\n');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/prepTatoeba.test.js`
Expected: FAIL — cannot resolve `./prepTatoeba.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/prepTatoeba.js` (absorbs `prep-tatoeba.mjs`; adds the exists-skip and awaits stream end):

```js
// Joins Tatoeba deu↔eng sentences via links.csv → tatoeba-de-en.tsv (de \t en).
// Idempotent: skips when the output already exists. Links are matched in either
// direction; one English pairing per German sentence keeps the file lean
// (buildExampleIndex caps its buckets anyway).
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const rl = (dir, f) => createInterface({ input: createReadStream(join(dir, f)), crlfDelay: Infinity });

// sentences files are "id \t lang \t text" → Map(id → text)
async function loadSentences(dir, file) {
  const map = new Map();
  for await (const line of rl(dir, file)) {
    const i = line.indexOf('\t');
    if (i < 0) continue;
    const rest = line.slice(i + 1);
    const j = rest.indexOf('\t');
    if (j < 0) continue;
    map.set(line.slice(0, i), rest.slice(j + 1));
  }
  return map;
}

export async function buildTatoebaPairs(cacheDir) {
  const outPath = join(cacheDir, 'tatoeba-de-en.tsv');
  if (existsSync(outPath)) return outPath;

  const deu = await loadSentences(cacheDir, 'deu_sentences.tsv');
  const eng = await loadSentences(cacheDir, 'eng_sentences.tsv');

  const out = createWriteStream(outPath);
  const seen = new Set();
  for await (const line of rl(cacheDir, 'links.csv')) {
    const t = line.indexOf('\t');
    if (t < 0) continue;
    const a = line.slice(0, t);
    const b = line.slice(t + 1);
    let de;
    let en;
    if (deu.has(a) && eng.has(b)) {
      de = deu.get(a);
      en = eng.get(b);
    } else if (deu.has(b) && eng.has(a)) {
      de = deu.get(b);
      en = eng.get(a);
    } else {
      continue;
    }
    if (seen.has(de)) continue;
    seen.add(de);
    out.write(`${de}\t${en}\n`);
  }
  await new Promise((resolve) => out.end(resolve));
  return outPath;
}
```

Then delete the superseded script:

```bash
git rm scripts/import-lexicon/prep-tatoeba.mjs
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/prepTatoeba.test.js`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/prepTatoeba.js scripts/import-lexicon/prepTatoeba.test.js
git commit -m "feat(import): Tatoeba de↔en join as a tested, idempotent module"
```

---

## Task 2: `prep.js` — freq sort, decompress, orchestrator

**Files:**
- Create: `scripts/import-lexicon/prep.js`
- Create: `scripts/import-lexicon/prep.test.js`

**Interfaces:**
- Consumes: `buildTatoebaPairs` from `./prepTatoeba.js` (Task 1).
- Produces:
  - `sortByFrequency(lines) => lines` — pure; drops blank lines; sorts by column 3 (`Number(parts[2]) || 0`) descending; does not mutate input.
  - `buildFreqTsv(cacheDir) => string` — reads `deu_news_2023_100K/deu_news_2023_100K-words.txt`, writes sorted lines to `freq.tsv` (+ trailing newline). Skips when `freq.tsv` exists.
  - `decompress(cacheDir)` — shell-outs, each skipped when its output exists: `bunzip2 -kf` for the two `.bz2` sentence files; `tar xjf links.tar.bz2 -C cacheDir`; `tar xzf deu_news_2023_100K.tar.gz -C cacheDir`. Not unit-tested (shell glue).
  - `ensurePrepared(cacheDir) => Promise<void>` — `decompress` → `buildFreqTsv` → `await buildTatoebaPairs`.

- [ ] **Step 1: Write the failing test**

Create `scripts/import-lexicon/prep.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sortByFrequency, buildFreqTsv } from './prep.js';

describe('sortByFrequency', () => {
  it('sorts lines by the col-3 frequency, descending', () => {
    const lines = ['1\tselten\t5', '2\tder\t45508', '3\tund\t34104'];
    expect(sortByFrequency(lines)).toEqual([
      '2\tder\t45508',
      '3\tund\t34104',
      '1\tselten\t5',
    ]);
  });
  it('drops blank lines and treats malformed frequency as 0 (sorts last)', () => {
    const lines = ['1\tder\t100', '', '2\tkaputt', '3\tund\t50'];
    expect(sortByFrequency(lines)).toEqual(['1\tder\t100', '3\tund\t50', '2\tkaputt']);
  });
  it('does not mutate the input array', () => {
    const lines = ['1\ta\t1', '2\tb\t2'];
    sortByFrequency(lines);
    expect(lines).toEqual(['1\ta\t1', '2\tb\t2']);
  });
});

describe('buildFreqTsv', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'prep-'));
    mkdirSync(join(dir, 'deu_news_2023_100K'));
    writeFileSync(
      join(dir, 'deu_news_2023_100K', 'deu_news_2023_100K-words.txt'),
      '1\tselten\t5\n2\tder\t45508\n'
    );
    return dir;
  };
  it('writes freq.tsv sorted by frequency', () => {
    const dir = setup();
    buildFreqTsv(dir);
    expect(readFileSync(join(dir, 'freq.tsv'), 'utf8')).toBe('2\tder\t45508\n1\tselten\t5\n');
  });
  it('is idempotent: skips when freq.tsv exists', () => {
    const dir = setup();
    writeFileSync(join(dir, 'freq.tsv'), 'SENTINEL\n');
    buildFreqTsv(dir);
    expect(readFileSync(join(dir, 'freq.tsv'), 'utf8')).toBe('SENTINEL\n');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/import-lexicon/prep.test.js`
Expected: FAIL — cannot resolve `./prep.js`.

- [ ] **Step 3: Implement**

Create `scripts/import-lexicon/prep.js`:

```js
// Idempotent prep between ensureRaw's downloads and the pipeline's readers:
// decompress the archives (shell-out to system bunzip2/tar — macOS/Linux only),
// frequency-sort the Leipzig words file, and build the Tatoeba de↔en pairs.
// Every step skips when its output file already exists (same semantics as
// ensureRaw); delete .cache/lexicon-raw to rebuild from fresh dumps.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTatoebaPairs } from './prepTatoeba.js';

const LEIPZIG_WORDS = join('deu_news_2023_100K', 'deu_news_2023_100K-words.txt');

// Leipzig words lines are "id \t word \t frequency" and are NOT pre-sorted;
// readRankMap treats line order as rank, so sort by frequency descending.
export function sortByFrequency(lines) {
  const freq = (l) => Number(l.split('\t')[2]) || 0;
  return lines.filter((l) => l.trim()).sort((a, b) => freq(b) - freq(a));
}

export function buildFreqTsv(cacheDir) {
  const outPath = join(cacheDir, 'freq.tsv');
  if (existsSync(outPath)) return outPath;
  const lines = readFileSync(join(cacheDir, LEIPZIG_WORDS), 'utf8').split('\n');
  writeFileSync(outPath, sortByFrequency(lines).join('\n') + '\n');
  return outPath;
}

export function decompress(cacheDir) {
  const steps = [
    { out: 'deu_sentences.tsv', cmd: 'bunzip2', args: ['-kf', join(cacheDir, 'deu_sentences.tsv.bz2')] },
    { out: 'eng_sentences.tsv', cmd: 'bunzip2', args: ['-kf', join(cacheDir, 'eng_sentences.tsv.bz2')] },
    { out: 'links.csv', cmd: 'tar', args: ['xjf', join(cacheDir, 'links.tar.bz2'), '-C', cacheDir] },
    { out: LEIPZIG_WORDS, cmd: 'tar', args: ['xzf', join(cacheDir, 'deu_news_2023_100K.tar.gz'), '-C', cacheDir] },
  ];
  for (const step of steps) {
    if (existsSync(join(cacheDir, step.out))) continue;
    execFileSync(step.cmd, step.args, { stdio: 'inherit' });
  }
}

export async function ensurePrepared(cacheDir) {
  decompress(cacheDir);
  buildFreqTsv(cacheDir);
  await buildTatoebaPairs(cacheDir);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/import-lexicon/prep.test.js`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-lexicon/prep.js scripts/import-lexicon/prep.test.js
git commit -m "feat(import): idempotent prep — decompress, freq sort, pair join"
```

---

## Task 3: Wire into the pipeline; one-command runbook; E2E proof

**Files:**
- Modify: `scripts/import-lexicon/download.js` (SOURCES)
- Modify: `scripts/import-lexicon/index.js:18-20,55-62`
- Modify: `package.json` (`import:lexicon` script)
- Modify: `README.md` ("Importing vocabulary" section)

**Interfaces:**
- Consumes: `ensurePrepared` from `./prep.js` (Task 2).
- Produces: `npm run import:lexicon` performs download → prep → pipeline in one command.

- [ ] **Step 1: Add the eng_sentences source**

In `scripts/import-lexicon/download.js`, add to `SOURCES` (after `tatoebaSentences`):

```js
  tatoebaEngSentences: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
```

- [ ] **Step 2: Wire prep into `index.js` and drop the rename**

In `scripts/import-lexicon/index.js`:

1. Add the import (with the other `./` imports):
```js
import { ensurePrepared } from './prep.js';
```
2. Replace the stale NOTE comment above `readParsed` (lines 18-20) with:
```js
// The readers below consume the prepared inputs that ensurePrepared() derives
// from the raw downloads (decompressed sentences/links, freq.tsv, the joined
// tatoeba-de-en.tsv). The Wiktextract .jsonl download is read directly.
```
3. In `run()`, call prep after `ensureRaw` and read the Wiktextract download by its real basename:
```js
  await ensureRaw(cacheDir);
  await ensurePrepared(cacheDir);
  const parsed = await readParsed(join(cacheDir, 'kaikki.org-dictionary-German.jsonl'));
```
(The `wiktextract.jsonl` name is gone — no hardlink/rename step exists anymore.)

- [ ] **Step 3: Bake the heap flag into the npm script**

In `package.json`:

```json
    "import:lexicon": "node --max-old-space-size=4096 scripts/import-lexicon/index.js",
```

- [ ] **Step 4: Collapse the README runbook**

In `README.md`, replace the whole block from `**Manual prep step (required).**` through the closing triple-backtick of its bash block AND the following "Then run …" paragraph with:

```markdown
**One command.** `npm run import:lexicon` downloads all sources (first run:
~1.2 GB into the git-ignored `.cache/lexicon-raw/`), decompresses them, joins
the Tatoeba de↔en sentence pairs, frequency-sorts the Leipzig word list, and
runs the pipeline. Requires macOS/Linux (`tar` + `bunzip2` on PATH). Prep steps
are idempotent — outputs are reused if present; delete `.cache/lexicon-raw/` to
rebuild from fresh dumps. The run prints a JSON report (kept/rejected counts by
reason + a random sample) — spot-check it before committing `public/lexicon/`.
```

- [ ] **Step 5: E2E proof against the cached real data**

The raw downloads are already in `.cache/lexicon-raw/`. Delete only the *prepared* files, then prove the one-command flow regenerates everything and reproduces the shipped artifacts:

```bash
cd /Users/shimonesterkin/projects/deutsch-app
rm -f .cache/lexicon-raw/deu_sentences.tsv .cache/lexicon-raw/eng_sentences.tsv \
      .cache/lexicon-raw/links.csv .cache/lexicon-raw/freq.tsv .cache/lexicon-raw/tatoeba-de-en.tsv
rm -rf .cache/lexicon-raw/deu_news_2023_100K
npm run import:lexicon
git diff --stat public/lexicon
```
Expected: the run regenerates all prep files and prints a report with `"total": 5000, "kept": 4426`; `git diff --stat` shows **only `public/lexicon/manifest.json`** changed (the `generatedAt` timestamp).

Then prove idempotence (prep phase skips, run is much faster to reach parsing):

```bash
npm run import:lexicon
git checkout -- public/lexicon
git status --short public/lexicon   # expect: clean
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS (all files — the real-artifact guard `lexiconSample.test.js` still passes because artifacts were restored).

- [ ] **Step 7: Commit**

```bash
git add scripts/import-lexicon/download.js scripts/import-lexicon/index.js package.json README.md
git commit -m "feat(import): one-command import — wire prep into pipeline, add eng source"
```

---

## Self-Review

**Spec coverage:**
- §1 SOURCES + eng_sentences → Task 3 Step 1.
- §2 prep.js (decompress / buildFreqTsv+sortByFrequency / buildTatoebaPairs / ensurePrepared) → Tasks 1–2.
- §3 index.js wiring + basename read → Task 3 Step 2.
- §4 npm heap flag + README collapse → Task 3 Steps 3–4.
- §5 unit tests → Tasks 1–2; E2E + idempotence proof → Task 3 Step 5.
- §6 YAGNI honored (no Windows/progress/config/checksums).
- §7 risks: ENOENT surfaces naturally from `execFileSync`; staleness documented in the README text (Step 4) and prep.js header comment.

**Placeholder scan:** none — every step carries complete code/commands.

**Type consistency:** `buildTatoebaPairs(cacheDir) => Promise<string>` matches its call in `ensurePrepared` (awaited, return ignored); `sortByFrequency(lines) => lines` matches `buildFreqTsv`'s use; prepared filenames match `index.js` readers (`tatoeba-de-en.tsv`, `freq.tsv`) and the Global Constraints list; all `scripts/` imports carry `.js`.

## Notes / risks for the implementer
- Task 3's E2E step needs the cached raw downloads (present from the real import run). If `.cache/lexicon-raw/` were missing, the run would first download ~1.2 GB — still correct, just slow.
- A leftover `wiktextract.jsonl` hardlink may exist in the cache from the manual run; it is unused after Task 3 and harmless.
- `git checkout -- public/lexicon` after the E2E run is REQUIRED so this PR ships no artifact churn (only `manifest.generatedAt` would differ).
- `npm test` runs the full suite per commit via the pre-commit hook.
