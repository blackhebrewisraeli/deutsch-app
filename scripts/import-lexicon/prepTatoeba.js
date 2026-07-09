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
