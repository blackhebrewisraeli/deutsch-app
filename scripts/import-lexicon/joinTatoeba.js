// NOTE: The index keys are exact lowercased tokens extracted from Tatoeba
// sentences. A lemma such as "Haus" matches the token "haus" but NOT inflected
// forms like "hause" or "häuser". This is an intentional simplification — no
// stemmer is applied. The pickExamples helper below falls back to Wiktextract
// examples to mitigate drops caused by missing token matches.

const BUCKET_CAP = 20;

function tokens(sentence) {
  return [...new Set(sentence.toLowerCase().match(/[a-zäöüß]+/g) || [])];
}

export function buildExampleIndex(pairs) {
  const index = new Map();
  for (const pair of pairs) {
    if (!pair.de || !pair.en) continue;
    for (const tok of tokens(pair.de)) {
      let bucket = index.get(tok);
      if (!bucket) {
        bucket = [];
        index.set(tok, bucket);
      }
      if (bucket.length < BUCKET_CAP) bucket.push(pair);
    }
  }
  return index;
}

// Matches the lemma as an EXACT lowercased token against the index.
// Inflected forms (e.g. "Hause", "Häuser" for lemma "Haus") are NOT matched.
// Use pickExamples to fall back to Wiktextract examples when no Tatoeba match
// exists, so valid entries are not over-dropped by the ≥1-example filter.
export function attachExamples(parsed, index, max = 2) {
  const key = parsed.lemma.toLowerCase();
  const bucket = index.get(key) || [];
  return bucket
    .slice()
    .sort((a, b) => a.de.length - b.de.length)
    .slice(0, max)
    .map((p) => ({ de: p.de, en: p.en, source: 'tatoeba' }));
}

// Merges Tatoeba examples with Wiktextract rawExamples as a fallback.
// Tatoeba examples come first; rawExamples with a missing/empty `en` are
// skipped. The combined list is sliced to `max`.
export function pickExamples(tatoebaExamples, rawExamples, max = 2) {
  const wiktionary = (rawExamples || [])
    .filter((e) => e && e.de && e.en)
    .map((e) => ({ de: e.de, en: e.en, source: 'wiktionary' }));
  return [...tatoebaExamples, ...wiktionary].slice(0, max);
}
