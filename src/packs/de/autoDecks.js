// Auto decks: views over the imported lexicon, resolved lazily by lexiconStore.
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics'];

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
];
