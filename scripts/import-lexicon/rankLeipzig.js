export function assignRanks(parsedList, rankMap) {
  return parsedList.map((p) => {
    const freqRank = rankMap.get(p.lemma.toLowerCase()) ?? null;
    return { ...p, freqRank };
  });
}

export function topByRank(list, n) {
  return list
    .filter((e) => e.freqRank != null)
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, n);
}

// CEFR bands are assigned by POSITION within the kept lexicon, not by raw
// Leipzig rank. The import keeps the top N parsed entries, which reach far down
// the frequency list (rank ~12k for N=5000), so a raw-rank threshold dumps
// almost everything into B1. Position-based bands stay stable across re-imports.
// Must therefore run AFTER filtering, when the kept set is known.
export function assignCefrBands(entries, { a1 = 0.2, a2 = 0.5 } = {}) {
  const sorted = [...entries].sort(
    (x, y) => (x.freqRank ?? Infinity) - (y.freqRank ?? Infinity)
  );
  const n = sorted.length;
  const a1End = Math.round(n * a1);
  const a2End = Math.round(n * a2);
  return sorted.map((e, i) => ({
    ...e,
    cefr: i < a1End ? 'A1' : i < a2End ? 'A2' : 'B1',
  }));
}
