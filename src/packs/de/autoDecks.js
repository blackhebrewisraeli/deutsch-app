// Auto decks: views over the imported lexicon, resolved lazily by lexiconStore.
export const DECK_GROUPS = [
  'Curated',
  'Frequency',
  'CEFR',
  'Topics',
  'Artikel',
  'Plural',
  'Perfekt',
  'Präsens',
];

export const AUTO_DECKS = [
  // Frequency — `top` takes the first N of the lexicon sorted by rank, so the
  // names describe exactly what you get. (A raw rank range would nearly miss:
  // kept entries span Leipzig ranks 1..12695 because the most frequent words are
  // function words the import filters drop.)
  {
    id: 'core-100',
    name: 'Core 100',
    icon: '⭐',
    group: 'Frequency',
    auto: { by: 'top', count: 100 },
  },
  {
    id: 'top-500',
    name: 'Top 500',
    icon: '🔝',
    group: 'Frequency',
    auto: { by: 'top', count: 500 },
  },

  { id: 'cefr-a1', name: 'A1', icon: '🟢', group: 'CEFR', auto: { by: 'cefr', level: 'A1' } },
  { id: 'cefr-a2', name: 'A2', icon: '🔵', group: 'CEFR', auto: { by: 'cefr', level: 'A2' } },
  { id: 'cefr-b1', name: 'B1', icon: '🟣', group: 'CEFR', auto: { by: 'cefr', level: 'B1' } },

  // Topics — these are Wiktionary DOMAIN labels (the only topical signal the
  // source provides), merged any-of so each deck is well populated. Counts at
  // time of writing are in docs/superpowers/specs/2026-07-13-autodecks-real-data-design.md.
  {
    id: 'tag-lifestyle',
    name: 'Lifestyle',
    icon: '🏠',
    group: 'Topics',
    auto: { by: 'tag', tag: 'lifestyle' },
  },
  {
    id: 'tag-science',
    name: 'Science',
    icon: '🔬',
    group: 'Topics',
    auto: {
      by: 'tag',
      tag: ['sciences', 'natural-sciences', 'physical-sciences', 'human-sciences'],
    },
  },
  {
    id: 'tag-hobbies',
    name: 'Hobbies & Games',
    icon: '🎲',
    group: 'Topics',
    auto: { by: 'tag', tag: ['hobbies', 'games', 'entertainment'] },
  },
  {
    id: 'tag-sports',
    name: 'Sports',
    icon: '⚽',
    group: 'Topics',
    auto: { by: 'tag', tag: 'sports' },
  },
  {
    id: 'tag-politics',
    name: 'Politics',
    icon: '🏛',
    group: 'Topics',
    auto: { by: 'tag', tag: ['politics', 'government', 'military', 'war'] },
  },
  {
    id: 'tag-business',
    name: 'Business & Law',
    icon: '💼',
    group: 'Topics',
    auto: { by: 'tag', tag: ['business', 'law'] },
  },
  {
    id: 'tag-tech',
    name: 'Tech',
    icon: '💻',
    group: 'Topics',
    auto: { by: 'tag', tag: ['computing', 'engineering', 'mathematics'] },
  },
  {
    id: 'tag-medicine',
    name: 'Medicine',
    icon: '🩺',
    group: 'Topics',
    auto: { by: 'tag', tag: 'medicine' },
  },

  // Artikel — the same nouns as the CEFR decks, drilled for gender instead of
  // meaning. Scoped by level because an all-nouns deck would touch all 9 chunks
  // (~2.4 MB) on one tap; these touch 2, 4 and 5. Every noun falls inside
  // A1/A2/B1, so the three of them reach all 2,863 without a catch-all.
  {
    id: 'artikel-a1',
    name: 'A1 Nouns',
    icon: '🟢',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'A1', pos: 'noun' },
  },
  {
    id: 'artikel-a2',
    name: 'A2 Nouns',
    icon: '🔵',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'A2', pos: 'noun' },
  },
  {
    id: 'artikel-b1',
    name: 'B1 Nouns',
    icon: '🟣',
    group: 'Artikel',
    auto: { by: 'cefr', level: 'B1', pos: 'noun' },
  },

  // Plural — the same nouns again, typed rather than chosen. `has: 'plural'`
  // drops the 8% (mass nouns, proper nouns, import gaps) that carry none; a card
  // with no answer is unanswerable, not merely dull. 580 / 815 / 1,240 cards.
  //
  // Named "A1 Plurals", not "A1 Nouns": the Artikel group already uses that and
  // the CEFR group uses a bare "A1", so every deck label in the picker stays
  // distinct. Two identically-labelled buttons are ambiguous for a learner
  // before they are ambiguous for a test.
  {
    id: 'plural-a1',
    name: 'A1 Plurals',
    icon: '🟢',
    group: 'Plural',
    auto: { by: 'cefr', level: 'A1', pos: 'noun', has: 'plural' },
  },
  {
    id: 'plural-a2',
    name: 'A2 Plurals',
    icon: '🔵',
    group: 'Plural',
    auto: { by: 'cefr', level: 'A2', pos: 'noun', has: 'plural' },
  },
  {
    id: 'plural-b1',
    name: 'B1 Plurals',
    icon: '🟣',
    group: 'Plural',
    auto: { by: 'cefr', level: 'B1', pos: 'noun', has: 'plural' },
  },

  // Perfekt — type the full perfect for a verb. `has: 'verb'` is the answerable
  // set (lexiconSample.test.js pins that a verb block always carries a
  // participle). 47 / 128 / 297 cards.
  //
  // A1 clears autoDecks.population.test.js's MIN_CARDS = 40 by SEVEN. An import
  // that drops a handful of A1 verbs turns that test red; the failure is real,
  // not flaky — the deck would genuinely be too thin to drill.
  {
    id: 'perfekt-a1',
    name: 'A1 Verbs',
    icon: '🟢',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'A1', pos: 'verb', has: 'verb' },
  },
  {
    id: 'perfekt-a2',
    name: 'A2 Verbs',
    icon: '🔵',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'A2', pos: 'verb', has: 'verb' },
  },
  {
    id: 'perfekt-b1',
    name: 'B1 Verbs',
    icon: '🟣',
    group: 'Perfekt',
    auto: { by: 'cefr', level: 'B1', pos: 'verb', has: 'verb' },
  },

  // Präsens — type the du-form. `du` is the least derivable person (49% against
  // 73% for ich and 80% for wir/sie, which are the bare infinitive four times in
  // five), so it is the one worth asking for. 45 / 127 / 296 cards.
  //
  // Generated rather than written out three times: #107 was merged past a
  // failing duplication gate, and three near-identical objects are a large share
  // of a small PR. These are one deck at three levels and now say so.
  //
  // A1's 45 clears MIN_CARDS = 40 by FIVE, the thinnest deck in the app.
  ...['A1', 'A2', 'B1'].map((level, i) => ({
    id: `praesens-${level.toLowerCase()}`,
    name: `${level} du-Form`,
    icon: ['🟢', '🔵', '🟣'][i],
    group: 'Präsens',
    auto: { by: 'cefr', level, pos: 'verb', has: 'verb.present.du' },
  })),
];
