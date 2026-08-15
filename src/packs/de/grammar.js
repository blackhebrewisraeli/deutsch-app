// German grammar, as data. The engine owns the algorithms that read this —
// which display lines a verb produces, how a lexicon entry is validated — and
// this file owns every German-specific value they use.
//
// Split out of index.js the way theme.js / decks.js / lexicon.js are, so a
// test can import the grammar without pulling the whole pack.
export const grammar = {
  // ── Nouns ──────────────────────────────────────────────────
  articles: ['der', 'die', 'das'],
  articleRequiredForNouns: true,
  // Where the article sits relative to the lemma: "der Hund", not "Hund der".
  articlePosition: 'before',
  // German's plural definite article, invariant across all three genders. The
  // plural drill echoes "die Jahre" rather than a bare "Jahre" because the full
  // form is what sticks. A language with no plural article leaves this
  // undefined and gets the bare form.
  pluralArticle: 'die',

  // ── Verbs ──────────────────────────────────────────────────
  // aux key → the third-person-singular form used to build the perfect:
  // 'haben' + 'gemacht' → "hat gemacht".
  auxiliaries: { haben: 'hat', sein: 'ist' },
  personKeys: ['ich', 'du', 'er', 'wir', 'ihr', 'sie'],
  // The person the vocab card shows. Doubles as that line's label, which is
  // what formatVerb has always done: { label: 'er', value: present.er }.
  displayPerson: 'er',

  labels: { perfect: 'Perfekt', participle: 'Part. II' },
};
