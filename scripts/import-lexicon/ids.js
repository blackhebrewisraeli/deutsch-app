const POS_PREFIX = {
  noun: 'n', verb: 'v', adj: 'adj', adv: 'adv',
  prep: 'prep', num: 'num', pron: 'pron', conj: 'conj',
};

export function posPrefix(pos) {
  return POS_PREFIX[pos] || 'x';
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function entryId(pos, lemma) {
  return `${posPrefix(pos)}:${slug(lemma)}`;
}

export function disambiguateIds(entries) {
  const base = entries.map((e) => ({ ...e, id: entryId(e.pos, e.lemma) }));
  const counts = new Map();
  for (const e of base) counts.set(e.id, (counts.get(e.id) || 0) + 1);

  // First pass: gloss-slug suffix for every member of a collision set.
  const withGloss = base.map((e) =>
    counts.get(e.id) > 1
      ? { ...e, id: `${e.id}:${slug((e.glosses && e.glosses[0]) || 'x')}` }
      : e
  );

  // Second pass: if a gloss-suffixed id still collides, append -2, -3… by order.
  const seen = new Map();
  return withGloss.map((e) => {
    const n = (seen.get(e.id) || 0) + 1;
    seen.set(e.id, n);
    return n === 1 ? e : { ...e, id: `${e.id}-${n}` };
  });
}

export function cefrForRank(rank) {
  if (rank == null) return null;
  if (rank <= 1000) return 'A1';
  if (rank <= 2500) return 'A2';
  return 'B1';
}
