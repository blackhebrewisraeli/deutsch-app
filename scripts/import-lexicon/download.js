import { mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

// Pinned source URLs — update + record the resolved version in manifest.sources.
export const SOURCES = {
  wiktextract: 'https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl',
  tatoebaSentences: 'https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2',
  tatoebaEngSentences: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
  tatoebaLinks: 'https://downloads.tatoeba.org/exports/links.tar.bz2',
  leipzig: 'https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_100K.tar.gz',
};

async function fetchTo(url, dest) {
  if (existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    Readable.fromWeb(res.body).pipe(out).on('finish', resolve).on('error', reject);
  });
  return dest;
}

export async function ensureRaw(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const paths = {};
  for (const [key, url] of Object.entries(SOURCES)) {
    paths[key] = await fetchTo(url, join(cacheDir, url.split('/').pop()));
  }
  return paths;
}
