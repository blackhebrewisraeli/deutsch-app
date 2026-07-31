export function buildReport({ parsedCount, rankedCount, kept, rejected, mergedAway = 0 }) {
  const byReason = {};
  for (const r of rejected) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  const ids = kept.map((e) => e.id);
  const sample = [];
  const pool = ids.slice();
  while (sample.length < Math.min(10, pool.length)) {
    const i = Math.floor(Math.random() * pool.length);
    sample.push(pool.splice(i, 1)[0]);
  }
  return {
    parsedCount,
    rankedCount,
    total: rankedCount,
    mergedAway,
    kept: kept.length,
    rejected: rejected.length,
    byReason,
    sample,
  };
}
