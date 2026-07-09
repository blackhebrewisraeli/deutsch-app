// Join Tatoeba deu↔eng sentences via links.csv → tatoeba-de-en.tsv (de \t en).
// Run: node --max-old-space-size=4096 join-tatoeba.mjs <cacheDir>
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const dir = process.argv[2];
const rl = (f) => createInterface({ input: createReadStream(join(dir, f)), crlfDelay: Infinity });

// text maps keyed by sentence id
const deu = new Map();
const eng = new Map();

async function loadSentences(file, map) {
  for await (const line of rl(file)) {
    const i = line.indexOf('\t');
    if (i < 0) continue;
    const id = line.slice(0, i);
    const rest = line.slice(i + 1);
    const j = rest.indexOf('\t'); // rest = "lang\ttext"
    if (j < 0) continue;
    map.set(id, rest.slice(j + 1));
  }
}

console.error('loading deu sentences…');
await loadSentences('deu_sentences.tsv', deu);
console.error(`  deu=${deu.size}`);
console.error('loading eng sentences…');
await loadSentences('eng_sentences.tsv', eng);
console.error(`  eng=${eng.size}`);

console.error('streaming links → pairs…');
const out = createWriteStream(join(dir, 'tatoeba-de-en.tsv'));
let pairs = 0;
const seen = new Set(); // dedupe by "deId:enId" not needed; dedupe by de text to keep file lean
for await (const line of rl('links.csv')) {
  const t = line.indexOf('\t');
  if (t < 0) continue;
  const a = line.slice(0, t);
  const b = line.slice(t + 1);
  let de, en;
  if (deu.has(a) && eng.has(b)) { de = deu.get(a); en = eng.get(b); }
  else if (deu.has(b) && eng.has(a)) { de = deu.get(b); en = eng.get(a); }
  else continue;
  // one English pairing per German sentence keeps the file lean and is plenty
  // for example lookup (buildExampleIndex caps buckets anyway).
  if (seen.has(de)) continue;
  seen.add(de);
  out.write(`${de}\t${en}\n`);
  pairs++;
}
out.end();
console.error(`done: ${pairs} pairs → tatoeba-de-en.tsv`);
