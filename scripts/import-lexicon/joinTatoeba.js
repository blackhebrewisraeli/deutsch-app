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

export function attachExamples(parsed, index, max = 2) {
  const key = parsed.lemma.toLowerCase();
  const bucket = index.get(key) || [];
  return bucket
    .slice()
    .sort((a, b) => a.de.length - b.de.length)
    .slice(0, max)
    .map((p) => ({ de: p.de, en: p.en, source: 'tatoeba' }));
}
