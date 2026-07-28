// Language-agnostic resolution of lexicon + deck definitions into the
// array-of-cards shape the UI and SRS consume.

/** @param {object} entry LexiconEntry @returns {object} resolved card */
export function resolveCard(entry) {
  return {
    id: entry.id,
    de: entry.article ? `${entry.article} ${entry.de}` : entry.de,
    en: entry.en[0],
    glosses: entry.en,
    ipa: entry.ipa,
    article: entry.article,
    plural: entry.plural,
    pos: entry.pos,
    cefr: entry.cefr,
    tags: entry.tags,
    freqRank: entry.freqRank,
    examples: entry.examples,
    verb: entry.verb,
  };
}

/**
 * @param {object} deckDef { cardIds } | { auto: { by, range?, level? } }
 * @param {Record<string, object>} lexicon
 * @returns {object[]}
 */
export function resolveDeck(deckDef, lexicon) {
  if (Array.isArray(deckDef.cardIds)) {
    return deckDef.cardIds.map((id) => {
      const entry = lexicon[id];
      if (!entry) throw new Error(`resolveDeck: unknown cardId "${id}"`);
      return resolveCard(entry);
    });
  }
  if (deckDef.auto) {
    const all = Object.values(lexicon);
    const byRank = (a, b) => (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity);
    if (deckDef.auto.by === 'freq') {
      const [min, max] = deckDef.auto.range;
      return all
        .filter((e) => e.freqRank !== null && e.freqRank >= min && e.freqRank <= max)
        .sort((a, b) => a.freqRank - b.freqRank)
        .map(resolveCard);
    }
    if (deckDef.auto.by === 'top') {
      return all.slice().sort(byRank).slice(0, deckDef.auto.count).map(resolveCard);
    }
    if (deckDef.auto.by === 'cefr') {
      return all.filter((e) => e.cefr === deckDef.auto.level).map(resolveCard);
    }
    if (deckDef.auto.by === 'tag') {
      const wanted = Array.isArray(deckDef.auto.tag) ? deckDef.auto.tag : [deckDef.auto.tag];
      return all
        .filter((e) => Array.isArray(e.tags) && e.tags.some((t) => wanted.includes(t)))
        .sort(byRank)
        .map(resolveCard);
    }
    throw new Error(`resolveDeck: unknown auto.by "${deckDef.auto.by}"`);
  }
  throw new Error('resolveDeck: deckDef needs cardIds or auto');
}

/**
 * @param {Record<string, object>} deckDefs
 * @param {Record<string, object>} lexicon
 * @returns {Record<string, object[]>}
 */
export function resolveDecks(deckDefs, lexicon) {
  return Object.fromEntries(
    Object.entries(deckDefs).map(([id, def]) => [id, resolveDeck(def, lexicon)])
  );
}
