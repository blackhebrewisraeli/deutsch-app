// Wiktionary glosses are written for a dictionary reader, not a flashcard: they
// carry grammar labels, a trailing parenthetical definition, and long synonym
// runs. Rendered verbatim as a multiple-choice option they are unanswerable —
// "[with dative] in, inside, within, at (inside a building)". This trims a gloss
// to the part that works as an answer, and is deliberately conservative: it
// never reaches for a different sense, because Wiktionary orders senses by
// primacy and a shorter later gloss is usually a rarer meaning.

const MAX_SYNONYMS = 3;

// Index of the bracket closing the one at `open`, or -1. Depth-tracked on
// purpose: glosses nest, and taking the FIRST closing bracket instead cut
// "school (an institution … (especially before university); …)" at the inner
// ")", leaving the outer detail spliced back into the answer.
function matchingClose(s, open) {
  const closer = s[open] === '(' ? ')' : ']';
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === s[open]) depth += 1;
    else if (s[i] === closer) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function cleanGloss(raw) {
  if (typeof raw !== 'string') return '';

  let s = raw
    // leading grammar label: "[with dative] in, inside" → "in, inside"
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .trim();

  // Cut only at a TRAILING parenthetical — that is explanatory detail. One that
  // sits mid-phrase is part of the sense ("to (go) get, to fetch"), so unwrap it
  // and keep scanning; cutting there left answers like "to" and "indicating".
  let out = '';
  let i = 0;
  while (i < s.length) {
    const rel = s.slice(i).search(/[([]/);
    if (rel < 0) {
      out += s.slice(i);
      break;
    }
    const open = i + rel;
    const close = matchingClose(s, open);
    if (close < 0) {
      out += s.slice(i, open);
      break;
    }
    const after = s.slice(close + 1).trim();
    if (!after || /^[,;.]*$/.test(after)) {
      out += s.slice(i, open);
      break;
    }
    out += s.slice(i, open) + s.slice(open + 1, close);
    i = close + 1;
  }
  s = out.replace(/\s+/g, ' ').trim();

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
