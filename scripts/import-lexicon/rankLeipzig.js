import { cefrForRank } from './ids.js';

export function assignRanks(parsedList, rankMap) {
  return parsedList.map((p) => {
    const freqRank = rankMap.get(p.lemma.toLowerCase()) ?? null;
    return { ...p, freqRank, cefr: cefrForRank(freqRank) };
  });
}

export function topByRank(list, n) {
  return list
    .filter((e) => e.freqRank != null)
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, n);
}
