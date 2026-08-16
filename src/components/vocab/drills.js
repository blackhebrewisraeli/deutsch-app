import { perfectLine, preteriteLine } from '../../lib/verbDisplay';

/**
 * One row per drill, keyed by the deck group it belongs to.
 *
 * VocabTab had a flag, a conceal branch and an answer branch per drill; at three
 * that was a pattern and at four it would have been noise. Adding a fifth drill
 * is now a row here plus a deck group in autoDecks.js.
 *
 * - `kind`        'choice' renders buttons, 'typed' renders the text input.
 * - `display`     overrides the card headword (the gender drill shows the bare lemma).
 * - `conceal`     fields CardFace must not render, because the drill asks for them.
 * - `expected`    the correct answer, graded against it.
 * - `answer`      what the verdict panel echoes back — usually richer than `expected`.
 * - `speak`       audio drills only: the text to play. Its presence is what
 *                 makes VocabTab play on card arrival and show a replay button.
 * - `options`     choice drills only: the buttons to offer.
 * - `label`,
 *   `placeholder` typed drills only. Both take grammar so no row holds a
 *                 language literal the pack could have supplied.
 *
 * No drill calls markLearned. learnedWords is keyed by card.id with no notion of
 * which skill was shown, and knowing a noun's gender or a verb's participle is
 * not knowing the word — the SRS keeps them apart by deck id instead.
 */
export const DRILLS = {
  Artikel: {
    kind: 'choice',
    display: (card) => card.lemma,
    options: (grammar) => grammar.articles,
    expected: (card) => card.article,
    answer: (card) => card.de,
  },

  Plural: {
    kind: 'typed',
    conceal: ['plural'],
    label: () => 'Type the plural',
    placeholder: (grammar) => `${grammar.pluralArticle ?? ''} …`.trim(),
    expected: (card) => card.plural,
    answer: (card, grammar) => [grammar.pluralArticle, card.plural].filter(Boolean).join(' '),
  },

  Perfekt: {
    kind: 'typed',
    // Both formatVerb lines go: the "Perfekt:" line is the answer verbatim, and
    // "er: macht" hands over the stem of "gemacht".
    conceal: ['verb'],
    label: () => 'Type the perfect',
    placeholder: (grammar) => `${Object.values(grammar.auxiliaries).join(' / ')} …`,
    expected: (card, grammar) => perfectLine(card.verb, grammar)?.value ?? '',
    answer: (card, grammar) => perfectLine(card.verb, grammar)?.value ?? card.de,
  },

  Präsens: {
    kind: 'typed',
    // The `er:` line shares the stem change with `du` for every irregular verb
    // (er trifft → du triffst), so it hands over exactly the cards that are not
    // mechanical.
    conceal: ['verb'],
    label: () => 'Type the du-form',
    placeholder: () => 'du …',
    expected: (card) => card.verb?.present?.du ?? '',
    answer: (card) => (card.verb?.present?.du ? `du ${card.verb.present.du}` : card.de),
  },

  Präteritum: {
    kind: 'typed',
    // The whole block, not just the Präteritum line: the "er:" present line
    // hands over the stem for every weak verb (er arbeitet → arbeitete), and
    // the participle does the same for many strong ones (gegangen → ging).
    conceal: ['verb'],
    label: () => 'Type the preterite',
    placeholder: (grammar) => `${grammar.displayPerson} …`,
    expected: (card, grammar) => preteriteLine(card.verb, grammar)?.value ?? '',
    answer: (card, grammar) => {
      const line = preteriteLine(card.verb, grammar);
      return line ? `${grammar.displayPerson} ${line.value}` : card.de;
    },
  },

  Hören: {
    kind: 'typed',
    // The answer IS the headword, so everything the card knows gives it away:
    // IPA is a phonetic transcription, the plural and verb lines carry the stem,
    // and the example almost always contains the word. Only the audio remains.
    display: () => '🔊',
    conceal: ['ipa', 'plural', 'verb', 'examples'],
    speak: (card) => card.de,
    label: () => 'Type what you hear',
    placeholder: () => '…',
    expected: (card) => card.de,
    answer: (card) => card.de,
  },
};

/** The drill for a deck id, or null when the deck is ordinary vocabulary. */
export function drillFor(deckId, autoDecks) {
  const group = autoDecks.find((d) => d.id === deckId)?.group;
  return (group && DRILLS[group]) || null;
}
