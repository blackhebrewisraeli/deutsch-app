// Opt-in interest topics and their curated decks. Pack-owned: labels, cards,
// and the English prompt hints Chat injects. The engine only sanitizes ids.

const SRC = { dict: 'authored', license: 'MIT' };

const noun = (article, lemma, en, ipa, plural, tags) => {
  const id = `${article} ${lemma}`;
  return {
    id,
    de: lemma,
    en: Array.isArray(en) ? en : [en],
    pos: 'noun',
    article,
    ipa,
    plural,
    cefr: 'A1',
    freqRank: null,
    tags,
    examples: [],
    verb: null,
    source: SRC,
  };
};

const word = (id, pos, en, ipa, tags) => ({
  id,
  de: id,
  en: Array.isArray(en) ? en : [en],
  pos,
  article: null,
  ipa,
  plural: null,
  cefr: 'A1',
  freqRank: null,
  tags,
  examples: [],
  verb: null,
  source: SRC,
});

const SPORT = 'sport';
const TECH = 'tech';
const MUSIK = 'musik';

/** @type {Record<string, object>} */
export const INTEREST_LEXICON = {
  'der Fußball': noun('der', 'Fußball', 'football', '[deːɐ̯ ˈfuːsbal]', 'Fußbälle', [SPORT]),
  'der Sport': noun('der', 'Sport', 'sport', '[deːɐ̯ ʃpɔʁt]', null, [SPORT]),
  'das Spiel': noun('das', 'Spiel', ['game', 'match'], '[das ʃpiːl]', 'Spiele', [SPORT]),
  'der Ball': noun('der', 'Ball', 'ball', '[deːɐ̯ bal]', 'Bälle', [SPORT]),
  'das Tor': noun('das', 'Tor', ['goal', 'gate'], '[das toːɐ̯]', 'Tore', [SPORT]),
  'der Spieler': noun('der', 'Spieler', 'player', '[deːɐ̯ ˈʃpiːlɐ]', 'Spieler', [SPORT]),
  'das Team': noun('das', 'Team', 'team', '[das tiːm]', 'Teams', [SPORT]),
  laufen: word('laufen', 'verb', 'to run', '[ˈlaʊ̯fn̩]', [SPORT]),
  schwimmen: word('schwimmen', 'verb', 'to swim', '[ˈʃvɪmən]', [SPORT]),
  gewinnen: word('gewinnen', 'verb', 'to win', '[ɡəˈvɪnən]', [SPORT]),

  'der Computer': noun('der', 'Computer', 'computer', '[deːɐ̯ kɔmˈpjuːtɐ]', 'Computer', [TECH]),
  'das Internet': noun('das', 'Internet', 'internet', '[das ˈɪntɐnɛt]', null, [TECH]),
  'die E-Mail': noun('die', 'E-Mail', 'email', '[diː ˈiːmeɪl]', 'E-Mails', [TECH]),
  'das Passwort': noun('das', 'Passwort', 'password', '[das ˈpasvɔʁt]', 'Passwörter', [TECH]),
  'die App': noun('die', 'App', 'app', '[diː ɛp]', 'Apps', [TECH]),
  'die Datei': noun('die', 'Datei', 'file', '[diː daˈtaɪ̯]', 'Dateien', [TECH]),
  'der Bildschirm': noun('der', 'Bildschirm', 'screen', '[deːɐ̯ ˈbɪltʃɪʁm]', 'Bildschirme', [TECH]),
  'die Tastatur': noun('die', 'Tastatur', 'keyboard', '[diː tastaˈtuːɐ̯]', 'Tastaturen', [TECH]),
  speichern: word('speichern', 'verb', 'to save', '[ˈʃpaɪ̯çɐn]', [TECH]),
  herunterladen: word('herunterladen', 'verb', 'to download', '[hɛˈʁʊntɐlaːdn̩]', [TECH]),

  'die Musik': noun('die', 'Musik', 'music', '[diː muˈziːk]', null, [MUSIK]),
  'das Lied': noun('das', 'Lied', 'song', '[das liːt]', 'Lieder', [MUSIK]),
  'die Gitarre': noun('die', 'Gitarre', 'guitar', '[diː ɡiˈtaʁə]', 'Gitarren', [MUSIK]),
  'das Konzert': noun('das', 'Konzert', 'concert', '[das kɔnˈt͡sɛʁt]', 'Konzerte', [MUSIK]),
  'der Sänger': noun('der', 'Sänger', 'singer', '[deːɐ̯ ˈzɛŋɐ]', 'Sänger', [MUSIK]),
  'die Band': noun('die', 'Band', 'band', '[diː bɛnt]', 'Bands', [MUSIK]),
  'das Klavier': noun('das', 'Klavier', 'piano', '[das klaˈviːɐ̯]', 'Klaviere', [MUSIK]),
  'das Radio': noun('das', 'Radio', 'radio', '[das ˈʁaːdio]', 'Radios', [MUSIK]),
  singen: word('singen', 'verb', 'to sing', '[ˈzɪŋən]', [MUSIK]),
  hören: word('hören', 'verb', ['to hear', 'to listen'], '[ˈhøːʁən]', [MUSIK]),
};

export const INTEREST_GROUP = 'Interests';

export const INTEREST_TOPICS = [
  {
    id: 'sport',
    label: 'Sport',
    icon: '⚽',
    deckId: 'interest-sport',
    promptHint: 'sports and athletic activities',
  },
  {
    id: 'tech',
    label: 'Tech / IT',
    icon: '💻',
    deckId: 'interest-tech',
    promptHint: 'computing and technical German',
  },
  {
    id: 'musik',
    label: 'Musik',
    icon: '🎵',
    deckId: 'interest-musik',
    promptHint: 'music and performance',
  },
];

const idsFor = (tag) =>
  Object.keys(INTEREST_LEXICON).filter((id) => INTEREST_LEXICON[id].tags.includes(tag));

export const INTEREST_DECK_DEFS = {
  'interest-sport': {
    name: 'Sport',
    icon: '⚽',
    group: INTEREST_GROUP,
    cardIds: idsFor(SPORT),
  },
  'interest-tech': {
    name: 'Tech / IT',
    icon: '💻',
    group: INTEREST_GROUP,
    cardIds: idsFor(TECH),
  },
  'interest-musik': {
    name: 'Musik',
    icon: '🎵',
    group: INTEREST_GROUP,
    cardIds: idsFor(MUSIK),
  },
};
