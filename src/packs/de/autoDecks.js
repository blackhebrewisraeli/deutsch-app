// Auto decks: views over the imported lexicon, resolved lazily by lexiconStore.
export const DECK_GROUPS = ['Curated', 'Frequency', 'CEFR', 'Topics'];

export const AUTO_DECKS = [
  {
    id: 'core-100',
    name: 'Core 100',
    icon: '⭐',
    group: 'Frequency',
    auto: { by: 'freq', range: [1, 100] },
  },
  {
    id: 'top-500',
    name: 'Top 500',
    icon: '🔝',
    group: 'Frequency',
    auto: { by: 'freq', range: [1, 500] },
  },
  { id: 'cefr-a1', name: 'A1', icon: '🟢', group: 'CEFR', auto: { by: 'cefr', level: 'A1' } },
  { id: 'cefr-a2', name: 'A2', icon: '🔵', group: 'CEFR', auto: { by: 'cefr', level: 'A2' } },
  { id: 'cefr-b1', name: 'B1', icon: '🟣', group: 'CEFR', auto: { by: 'cefr', level: 'B1' } },
  { id: 'tag-food', name: 'Food', icon: '🍞', group: 'Topics', auto: { by: 'tag', tag: 'food' } },
  {
    id: 'tag-travel',
    name: 'Travel',
    icon: '✈',
    group: 'Topics',
    auto: { by: 'tag', tag: 'travel' },
  },
  { id: 'tag-home', name: 'Home', icon: '🏠', group: 'Topics', auto: { by: 'tag', tag: 'home' } },
  {
    id: 'tag-people',
    name: 'People',
    icon: '🧑',
    group: 'Topics',
    auto: { by: 'tag', tag: 'people' },
  },
  { id: 'tag-work', name: 'Work', icon: '💼', group: 'Topics', auto: { by: 'tag', tag: 'work' } },
  { id: 'tag-body', name: 'Body', icon: '✋', group: 'Topics', auto: { by: 'tag', tag: 'body' } },
  {
    id: 'tag-nature',
    name: 'Nature',
    icon: '🌳',
    group: 'Topics',
    auto: { by: 'tag', tag: 'nature' },
  },
  { id: 'tag-time', name: 'Time', icon: '⏰', group: 'Topics', auto: { by: 'tag', tag: 'time' } },
];
