// Wiktionary glosses are written for a dictionary reader, not a flashcard: they
// carry grammar labels, a trailing parenthetical definition, and long synonym
// runs. Rendered verbatim as a multiple-choice option they are unanswerable —
// "[with dative] in, inside, within, at (inside a building)". This trims a gloss
// to the part that works as an answer, and is deliberately conservative: it
// never reaches for a different sense, because Wiktionary orders senses by
// primacy and a shorter later gloss is usually a rarer meaning.

const MAX_SYNONYMS = 3;

export function cleanGloss(raw) {
  if (typeof raw !== 'string') return '';

  let s = raw
    // leading grammar label: "[with dative] in, inside" → "in, inside"
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    // everything from the first bracket on is explanatory detail
    .split(/\s*[([]/)[0]
    .trim();

  // Cap the synonym run, keeping the separator that introduced each item.
  const parts = s.split(/\s*([,;])\s*/);
  if (parts.length > 1) {
    let out = parts[0];
    const cap = MAX_SYNONYMS;
    for (let i = 1; i < parts.length - 1 && (i + 1) / 2 < cap; i += 2) {
      out += `${parts[i]} ${parts[i + 1]}`;
    }
    s = out;
  }

  s = s.replace(/[\s,;:.–—-]+$/, '').trim();

  // A gloss that opens with its parenthetical cleans to nothing — keep the raw
  // text rather than shipping an empty answer.
  return s || raw.trim();
}
