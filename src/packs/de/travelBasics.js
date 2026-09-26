// "Travel Basics": the Wikivoyage German phrasebook (327 de/en pairs,
// CC BY-SA 4.0 — see CONTENT_LICENSE.md) as one preset deck.
//
// Kept OUT of DECKS/LEXICON on purpose. Every unstudied preset card counts as
// due (lib/srs getDueCount), so folding 327 phrases into content.decks would
// put all of them on the Stats nav badge and Home's SRS mission at once. DECKS
// also feeds seed-lessons' vocab units, which this deck is not.
import PHRASES from '../../../scripts/seed-data/apify_raw_sentences.json' with { type: 'json' };

export const TRAVEL_BASICS_ID = 'travel-basics';

const SRC = { dict: 'wikivoyage', license: 'CC BY-SA 4.0' };

// ponytail: a word-count heuristic, not a CEFR classifier. Under four words is
// A1, anything longer A2. Replace with authored levels if the phrases get them.
export const cefrFor = (de) => (de.trim().split(/\s+/).length < 4 ? 'A1' : 'A2');

// "Good day (formal)" stays the shown gloss — the note is what tells the
// formal and informal cards apart. The bare "Good day" is what a learner types,
// so it is accepted too.
const glossesFor = (en) => {
  const bare = en.replace(/\s*\([^)]*\)/g, '').trim();
  return bare && bare !== en ? [en, bare] : [en];
};

const entries = PHRASES.map(({ de, en }) => ({
  id: de,
  de,
  en: glossesFor(en),
  pos: 'phrase',
  article: null,
  ipa: null,
  plural: null,
  cefr: cefrFor(de),
  freqRank: null,
  tags: [TRAVEL_BASICS_ID],
  examples: [],
  verb: null,
  source: SRC,
}));

/** @type {Record<string, object>} */
export const TRAVEL_BASICS_LEXICON = Object.fromEntries(entries.map((e) => [e.id, e]));

export const TRAVEL_BASICS_DECK_DEFS = {
  [TRAVEL_BASICS_ID]: {
    name: 'Travel Basics',
    icon: '🧳',
    // A1 first: unseen cards are served in deck order (srs getDueCards).
    cardIds: [...entries].sort((a, b) => a.cefr.localeCompare(b.cefr)).map((e) => e.id),
  },
};
