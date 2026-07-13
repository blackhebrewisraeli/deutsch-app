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
