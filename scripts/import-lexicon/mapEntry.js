export function mapEntry(word) {
  return {
    id: word.id,
    de: word.lemma,
    en: word.glosses,
    pos: word.pos,
    article: word.article ?? null,
    ipa: word.ipa ?? null,
    plural: word.plural ?? null,
    cefr: word.cefr ?? null,
    freqRank: word.freqRank ?? null,
    tags: word.topics ?? [],
    examples: word.examples ?? [],
    verb: word.verb ?? null,
    source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
  };
}
