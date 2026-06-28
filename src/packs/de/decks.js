// Deck definitions: ordered views over the lexicon. Curated decks list the
// lexicon ids they include; the resolver joins them into card arrays.
export const DECKS = {
  greetings: {
    name: 'Greetings',
    icon: '👋',
    cardIds: [
      'Hallo',
      'Guten Morgen',
      'Guten Tag',
      'Guten Abend',
      'Auf Wiedersehen',
      'Tschüss',
      'Wie geht es dir?',
      'Mir geht es gut',
      'Bitte',
      'Danke',
    ],
  },
  food: {
    name: 'Food & Drink',
    icon: '🍞',
    cardIds: [
      'das Brot',
      'der Käse',
      'das Wasser',
      'der Apfel',
      'das Fleisch',
      'der Kaffee',
      'die Milch',
      'das Bier',
      'die Suppe',
      'der Zucker',
    ],
  },
  travel: {
    name: 'Travel',
    icon: '✈',
    cardIds: [
      'der Bahnhof',
      'der Flughafen',
      'das Hotel',
      'die Karte',
      'der Koffer',
      'der Pass',
      'links',
      'rechts',
      'geradeaus',
      'Wo ist...?',
    ],
  },
  numbers: {
    name: 'Numbers',
    icon: '🔢',
    cardIds: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'],
  },
};
