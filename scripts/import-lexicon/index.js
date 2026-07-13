import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureRaw, SOURCES } from './download.js';
import { ensurePrepared } from './prep.js';
import { parseRecord } from './parseWiktextract.js';
import { buildExampleIndex, attachExamples, pickExamples } from './joinTatoeba.js';
import { assignRanks, topByRank } from './rankLeipzig.js';
import { disambiguateIds } from './ids.js';
import { mapEntry } from './mapEntry.js';
import { applyFilter } from './filter.js';
import { buildArtifacts, writeArtifacts } from './chunk.js';
import { buildReport } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// The readers below consume the prepared inputs that ensurePrepared() derives
// from the raw downloads (decompressed sentences/links, freq.tsv, the joined
// tatoeba-de-en.tsv). The Wiktextract .jsonl download is read directly.
async function readParsed(jsonlPath) {
  const rl = createInterface({ input: createReadStream(jsonlPath), crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = parseRecord(JSON.parse(line));
    if (parsed) out.push(parsed);
  }
  return out;
}

async function readTatoebaPairs(sentencesTsv, _linksCsv) {
  // Reads the pre-joined "de\ten" TSV that ensurePrepared()'s buildTatoebaPairs
  // step writes to cacheDir as tatoeba-de-en.tsv.
  const pairs = [];
  const rl = createInterface({ input: createReadStream(sentencesTsv), crlfDelay: Infinity });
  for await (const line of rl) {
    const [de, en] = line.split('\t');
    if (de && en) pairs.push({ de, en });
  }
  return pairs;
}

async function readRankMap(freqTsv) {
  const map = new Map();
  const rl = createInterface({ input: createReadStream(freqTsv), crlfDelay: Infinity });
  let rank = 0;
  for await (const line of rl) {
    const word = line.split('\t')[1] || line.split('\t')[0];
    if (word) map.set(word.toLowerCase(), ++rank);
  }
  return map;
}

export async function run({ n = 5000, cacheDir, outDir } = {}) {
  cacheDir = cacheDir || join(ROOT, '.cache', 'lexicon-raw');
  outDir = outDir || join(ROOT, 'public', 'lexicon');

  await ensureRaw(cacheDir);
  await ensurePrepared(cacheDir);
  const parsed = await readParsed(join(cacheDir, 'kaikki.org-dictionary-German.jsonl'));
  const pairs = await readTatoebaPairs(join(cacheDir, 'tatoeba-de-en.tsv'));
  const rankMap = await readRankMap(join(cacheDir, 'freq.tsv'));

  const exIndex = buildExampleIndex(pairs);
  const ranked = topByRank(assignRanks(parsed, rankMap), n);
  const withIds = disambiguateIds(ranked); // adds .id
  const mapped = withIds.map((w) => mapEntry({ ...w, examples: pickExamples(attachExamples(w, exIndex, 2), w.rawExamples ?? [], 2) }));
  const { kept, rejected } = applyFilter(mapped);

  const artifacts = buildArtifacts(kept, { chunkSize: 500, sources: SOURCES });
  writeArtifacts(outDir, artifacts);

  const report = buildReport({ parsedCount: parsed.length, rankedCount: ranked.length, kept, rejected });
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
