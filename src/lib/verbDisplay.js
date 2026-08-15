// Formats a resolved card's (best-effort, nullable-fielded) verb block into
// compact display lines for the vocab card. Pure — each line appears only when
// its data exists. Order: the pack's display person, then the perfect (or a
// participle-only fallback when the auxiliary is unknown).
//
// The algorithm is the engine's; every value it reads comes from the pack.

/**
 * The perfect-tense line for a verb, or null when the data cannot form one.
 *
 * Exported because the Perfekt drill grades against exactly what the card would
 * show. Two implementations of "what is this verb's perfect" would drift, and
 * the drill would start rejecting correct answers.
 *
 * @param {object|null} verb
 * @param {{ auxiliaries: Record<string,string>, labels: { perfect: string, participle: string } }} grammar
 * @returns {{ label: string, value: string }|null}
 */
export function perfectLine(verb, grammar) {
  if (!verb || typeof verb !== 'object' || !verb.partizip2) return null;
  // An auxiliary the pack does not declare yields undefined and falls to the
  // participle line. The old rule guessed the haben form for anything that
  // was not 'sein'.
  const aux3sg = grammar.auxiliaries[verb.aux];
  return aux3sg
    ? { label: grammar.labels.perfect, value: `${aux3sg} ${verb.partizip2}` }
    : { label: grammar.labels.participle, value: verb.partizip2 };
}

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

  const perfect = perfectLine(verb, grammar);
  if (perfect) lines.push(perfect);

  return lines;
}
