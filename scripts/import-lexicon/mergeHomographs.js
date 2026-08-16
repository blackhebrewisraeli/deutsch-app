// The same German word can reach the learner as several cards with different
// correct answers — `in` as preposition and as adjective, `der Tag` as day and
// as label. In multiple choice two options are then both defensible and the
// learner cannot tell which card they are looking at. This collapses such
// groups into one card per RENDERED German form.
//
// Runs AFTER disambiguateIds, deliberately. Merging earlier would collapse the
// id collision that produced `n:tag:day-a-24-hour-period` and rename the
// survivor to `n:tag`. Ids key saved learner progress (learnedWords, and
// srsKey in src/lib/srs.js), so that would orphan progress on a card that is
// not going away. Running after ids are assigned lets every surviving entry
// keep exactly the id it has today.
//
// Grouping by the RENDERED German is what keeps the 52 gender-distinguished
// lemmas apart: in German the article IS the distinction, so `der Tor` (fool)
// and `das Tor` (gate) are different keys and never meet. Merging them would
// teach a learner something false. There is no exclusion list to maintain.

// Senses that describe grammar rather than meaning. "Separated form of nach"
// is an answer no learner can give. `nominalization of` was added after reading
// the real merged output: it turned `die Gleiche`'s clean "equality" into
// "equality · nominalization of gleich: female equivalent of Gleicher".
//
// Deliberately NOT listed: the definitional prose Wiktionary writes for
// function words ("indicating …", "Used to frame a statement …"). Those are the
// only gloss such a word has — `ein` → "one · indicating concrete or abstract
// /metaphorical motion into something" is accepted as-is by the gloss-cleanup
// design, and skipping them would leave the card with no second sense at all.
const META_SENSE =
  /\b(form of|inflection of|preterite|abbreviation of|clipping of|nominalization of)\b/i;

// At most two senses on one card: past that, the answer stops being readable
// and the multiple-choice option overflows.
const MAX_SENSES = 2;

/** The string resolveCard builds for the card face (src/packs/resolve.js:8). */
export function renderedGerman(entry) {
  return entry.article ? `${entry.article} ${entry.de}` : entry.de;
}

// Cleaned glosses already carry internal `,` and `;` from cleanGloss's synonym
// cap, so the first synonym is the text before the first of either. Taking the
// whole gloss instead put answer p90 at 68 with 98 answers over 40 characters,
// partly undoing the gloss cleanup in PR #69.
function firstSynonym(gloss) {
  return String(gloss ?? '')
    .split(/[,;]/)[0]
    .trim();
}

const byRank = (a, b) => (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity);

/**
 * @param {object[]} senses entries sharing a rendered German form, primary first
 * @returns {string} the merged answer for en[0]
 */
export function mergedAnswer(senses) {
  const picked = [];
  const seen = new Set();

  for (const sense of senses) {
    const gloss = sense.en?.[0];
    if (!gloss || META_SENSE.test(gloss)) continue;
    const synonym = firstSynonym(gloss);
    if (!synonym) continue;
    const key = synonym.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(synonym);
    if (picked.length === MAX_SENSES) break;
  }

  // Every sense meta-linguistic or empty: keep the primary rather than ship an
  // empty answer, which validateLexiconEntry rejects outright.
  if (picked.length === 0) {
    const fallback = senses[0]?.en?.[0] ?? '';
    return firstSynonym(fallback) || fallback;
  }
  // U+00B7 MIDDLE DOT, not "; ": the glosses already contain semicolons, so
  // joining with "; " read `doch` as six senses instead of two.
  return picked.join(' · ');
}

function mergeGroup(senses) {
  const [primary] = senses;

  // One full gloss per sense behind the merged answer, so card.glosses keeps
  // the detail the merge folded away.
  const answer = mergedAnswer(senses);
  const details = [];
  const seenGloss = new Set([answer]);
  for (const sense of senses) {
    for (const gloss of sense.en ?? []) {
      if (seenGloss.has(gloss)) continue;
      seenGloss.add(gloss);
      details.push(gloss);
    }
  }

  const tags = [...new Set(senses.flatMap((s) => s.tags ?? []))];

  // Unioned for the same reason the verb table is rescued below: the merged
  // card is the only one that ships, so an opposite carried by a losing sense
  // would be gone for good.
  const antonyms = [...new Set(senses.flatMap((s) => s.antonyms ?? []))];

  const examples = [];
  const seenExample = new Set();
  for (const sense of senses) {
    for (const example of sense.examples ?? []) {
      if (seenExample.has(example.de)) continue;
      seenExample.add(example.de);
      examples.push(example);
    }
  }

  return {
    ...primary,
    en: [answer, ...details],
    // 11 groups mix a verb sense with a non-verb one, and conjugation is
    // rendered on the card (formatVerb in VocabTab) — so a num/verb merge like
    // `sieben` should not silently drop the table.
    verb: primary.verb ?? senses.find((s) => s.verb)?.verb ?? null,
    tags,
    antonyms,
    examples,
  };
}

/**
 * @param {object[]} entries mapped, filtered lexicon entries
 * @returns {{ entries: object[], retiredIds: string[] }}
 */
export function mergeHomographs(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = renderedGerman(entry);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const out = [];
  const retiredIds = [];
  const emitted = new Set();

  // Walk the original array so surviving entries keep their relative order.
  for (const entry of entries) {
    const key = renderedGerman(entry);
    if (emitted.has(key)) continue;
    emitted.add(key);
    const group = groups.get(key);
    if (group.length === 1) {
      out.push(entry);
      continue;
    }
    // Stable sort: a freqRank tie — the norm here, since rank is keyed on the
    // lemma, so every sense of a word shares one — falls back to input order.
    const senses = [...group].sort(byRank);
    out.push(mergeGroup(senses));
    for (const retired of senses.slice(1)) retiredIds.push(retired.id);
  }

  return { entries: out, retiredIds };
}
