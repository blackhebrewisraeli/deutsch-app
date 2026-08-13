// Formats a resolved card's (best-effort, nullable-fielded) verb block into
// compact display lines for the vocab card. Pure — each line appears only when
// its data exists. Order: the pack's display person, then the perfect (or a
// participle-only fallback when the auxiliary is unknown).
//
// The algorithm is the engine's; every value it reads comes from the pack.

/**
 * @param {object|null} verb
 * @param {{ auxiliaries: Record<string,string>, displayPerson: string, labels: { perfect: string, participle: string } }} grammar
 * @returns {{ label: string, value: string }[]}
 */
export function formatVerb(verb, grammar) {
  if (!verb || typeof verb !== 'object') return [];
  const lines = [];

  const person = grammar.displayPerson;
  if (verb.present?.[person]) {
    lines.push({ label: person, value: verb.present[person] });
  }

  if (verb.partizip2) {
    // An auxiliary the pack does not declare yields undefined and falls to the
    // participle line. The old rule guessed the haben form for anything that
    // was not 'sein'.
    const aux3sg = grammar.auxiliaries[verb.aux];
    if (aux3sg) {
      lines.push({ label: grammar.labels.perfect, value: `${aux3sg} ${verb.partizip2}` });
    } else {
      lines.push({ label: grammar.labels.participle, value: verb.partizip2 });
    }
  }

  return lines;
}
