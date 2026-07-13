// Formats a resolved card's (best-effort, nullable-fielded) verb block into
// compact display lines for the vocab card. Pure — each line appears only when
// its data exists. Order: er-form, then Perfekt (or a Part. II fallback when the
// auxiliary is unknown).
export function formatVerb(verb) {
  if (!verb || typeof verb !== 'object') return [];
  const lines = [];
  if (verb.present?.er) {
    lines.push({ label: 'er', value: verb.present.er });
  }
  if (verb.partizip2) {
    if (verb.aux) {
      const aux3sg = verb.aux === 'sein' ? 'ist' : 'hat';
      lines.push({ label: 'Perfekt', value: `${aux3sg} ${verb.partizip2}` });
    } else {
      lines.push({ label: 'Part. II', value: verb.partizip2 });
    }
  }
  return lines;
}
