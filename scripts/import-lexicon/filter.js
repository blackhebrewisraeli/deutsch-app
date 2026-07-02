// Minimal blocklist; expand as the import report surfaces issues.
const BLOCKLIST = ['ficken', 'scheiße', 'arsch', 'fotze', 'wichser'];

export function cleanExamples(examples, { maxLen = 120 } = {}) {
  return (examples || []).filter((e) => {
    if (!e || !e.de || !e.en) return false;
    if (e.de.length > maxLen) return false;
    const lower = e.de.toLowerCase();
    return !BLOCKLIST.some((w) => lower.includes(w));
  });
}

export function keepEntry(entry) {
  if (entry.pos === 'noun' && !entry.article) return { keep: false, reason: 'noun missing article' };
  if (entry.pos === 'verb' && entry.verb === null) return { keep: false, reason: 'verb missing verb block' };
  if (!entry.examples || entry.examples.length === 0) return { keep: false, reason: 'no example' };
  return { keep: true, reason: null };
}

export function applyFilter(entries) {
  const kept = [];
  const rejected = [];
  for (const entry of entries) {
    entry.examples = cleanExamples(entry.examples);
    const { keep, reason } = keepEntry(entry);
    if (keep) kept.push(entry);
    else rejected.push({ id: entry.id, reason });
  }
  return { kept, rejected };
}
