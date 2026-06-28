export const ALPHABET = [
  { l: 'A', w: 'Apfel', e: 'apple' },
  { l: 'B', w: 'Brot', e: 'bread' },
  { l: 'C', w: 'Computer', e: 'computer' },
  { l: 'D', w: 'Danke', e: 'thank you' },
  { l: 'E', w: 'Elefant', e: 'elephant' },
  { l: 'F', w: 'Freund', e: 'friend' },
  { l: 'G', w: 'Glück', e: 'luck' },
  { l: 'H', w: 'Haus', e: 'house' },
  { l: 'I', w: 'Insel', e: 'island' },
  { l: 'J', w: 'Jahr', e: 'year' },
  { l: 'K', w: 'Katze', e: 'cat' },
  { l: 'L', w: 'Liebe', e: 'love' },
  { l: 'M', w: 'Mond', e: 'moon' },
  { l: 'N', w: 'Nacht', e: 'night' },
  { l: 'O', w: 'Ofen', e: 'oven' },
  { l: 'P', w: 'Pferd', e: 'horse' },
  { l: 'Q', w: 'Quelle', e: 'source' },
  { l: 'R', w: 'Regen', e: 'rain' },
  { l: 'S', w: 'Sonne', e: 'sun' },
  { l: 'T', w: 'Tag', e: 'day' },
  { l: 'U', w: 'Uhr', e: 'clock' },
  { l: 'V', w: 'Vogel', e: 'bird' },
  { l: 'W', w: 'Wasser', e: 'water' },
  { l: 'X', w: 'Xylophon', e: 'xylophone' },
  { l: 'Y', w: 'Yoga', e: 'yoga' },
  { l: 'Z', w: 'Zeit', e: 'time' },
  { l: 'Ä', w: 'Äpfel', e: 'apples' },
  { l: 'Ö', w: 'Öl', e: 'oil' },
  { l: 'Ü', w: 'Über', e: 'over' },
  { l: 'ß', w: 'Straße', e: 'street' },
];

export const SCENARIOS = [
  { id: 'free', name: 'Free Chat', icon: '◆', desc: 'open conversation' },
  { id: 'coffee', name: 'Order Coffee', icon: '☕', desc: 'at a Berlin café' },
  { id: 'meet', name: 'Meet Someone', icon: '✶', desc: 'small talk & intros' },
  { id: 'airport', name: 'At the Airport', icon: '✈', desc: 'check-in & directions' },
];

// ─── Translate Exercise — Sentence Banks ─────────────────────────────────────

/**
 * A1 sentences — full word tile assembly.
 * words: the correct German tokens in order (used as tiles + correct answer check)
 * distractors: extra wrong tiles added to the bank to prevent guessing by elimination
 */
export const TRANSLATE_SENTENCES_A1 = [
  {
    en: 'I drink water.',
    de: 'Ich trinke Wasser.',
    words: ['Ich', 'trinke', 'Wasser.'],
    distractors: ['esse', 'laufe'],
    note: 'Subject–Verb–Object word order',
  },
  {
    en: 'The cat is big.',
    de: 'Die Katze ist groß.',
    words: ['Die', 'Katze', 'ist', 'groß.'],
    distractors: ['klein', 'der'],
    note: 'Nominative: die Katze (feminine)',
  },
  {
    en: 'He eats bread.',
    de: 'Er isst Brot.',
    words: ['Er', 'isst', 'Brot.'],
    distractors: ['trinkt', 'Wasser'],
    note: 'isst = 3rd person singular of essen',
  },
  {
    en: 'We go home.',
    de: 'Wir gehen nach Hause.',
    words: ['Wir', 'gehen', 'nach', 'Hause.'],
    distractors: ['fahren', 'in'],
    note: 'nach Hause = direction; zu Hause = location',
  },
  {
    en: 'She reads a book.',
    de: 'Sie liest ein Buch.',
    words: ['Sie', 'liest', 'ein', 'Buch.'],
    distractors: ['schreibt', 'das'],
    note: 'ein Buch — neuter accusative, no change from nominative',
  },
  {
    en: 'The dog is small.',
    de: 'Der Hund ist klein.',
    words: ['Der', 'Hund', 'ist', 'klein.'],
    distractors: ['groß', 'die'],
    note: 'Nominative: der Hund (masculine)',
  },
  {
    en: 'I am tired.',
    de: 'Ich bin müde.',
    words: ['Ich', 'bin', 'müde.'],
    distractors: ['hungrig', 'habe'],
    note: 'sein (to be): ich bin',
  },
  {
    en: 'The house is red.',
    de: 'Das Haus ist rot.',
    words: ['Das', 'Haus', 'ist', 'rot.'],
    distractors: ['blau', 'der'],
    note: 'das Haus — neuter noun',
  },
  {
    en: 'They drink coffee.',
    de: 'Sie trinken Kaffee.',
    words: ['Sie', 'trinken', 'Kaffee.'],
    distractors: ['essen', 'Tee'],
    note: 'trinken = 3rd person plural; same form as infinitive',
  },
  {
    en: 'I have a cat.',
    de: 'Ich habe eine Katze.',
    words: ['Ich', 'habe', 'eine', 'Katze.'],
    distractors: ['einen', 'Hund'],
    note: 'eine — feminine accusative (no change from nominative)',
  },
];

/**
 * A2 sentences — fill-in-the-blanks.
 * template: string with ___ markers for each blank (in order)
 * blanks: [{ word: correct answer, distractors: [wrong options] }]
 */
export const TRANSLATE_SENTENCES_A2 = [
  {
    en: 'I have a big dog.',
    de: 'Ich habe einen großen Hund.',
    template: 'Ich habe ___ ___ Hund.',
    blanks: [
      { word: 'einen', distractors: ['ein', 'eine'] },
      { word: 'großen', distractors: ['große', 'großes'] },
    ],
    note: 'Accusative masculine: einen + weak adjective ending -en',
  },
  {
    en: 'She goes to school.',
    de: 'Sie geht in die Schule.',
    template: 'Sie geht ___ ___ Schule.',
    blanks: [
      { word: 'in', distractors: ['zu', 'nach'] },
      { word: 'die', distractors: ['der', 'das'] },
    ],
    note: 'in + accusative (movement into); die Schule is feminine',
  },
  {
    en: 'I am drinking a coffee.',
    de: 'Ich trinke einen Kaffee.',
    template: 'Ich trinke ___ Kaffee.',
    blanks: [{ word: 'einen', distractors: ['ein', 'eine'] }],
    note: 'Accusative masculine indefinite article: einen',
  },
  {
    en: 'The child plays with the ball.',
    de: 'Das Kind spielt mit dem Ball.',
    template: 'Das Kind spielt mit ___ Ball.',
    blanks: [{ word: 'dem', distractors: ['der', 'den'] }],
    note: 'mit + dative; der Ball → dem Ball',
  },
  {
    en: 'He works in a hospital.',
    de: 'Er arbeitet in einem Krankenhaus.',
    template: 'Er arbeitet in ___ Krankenhaus.',
    blanks: [{ word: 'einem', distractors: ['einen', 'ein'] }],
    note: 'in + dative (location); das Krankenhaus → einem Krankenhaus',
  },
  {
    en: 'We are going to the cinema.',
    de: 'Wir gehen ins Kino.',
    template: 'Wir gehen ___ Kino.',
    blanks: [{ word: 'ins', distractors: ['im', 'zum'] }],
    note: 'ins = in + das (contraction for neuter accusative)',
  },
  {
    en: 'She gives the book to her friend.',
    de: 'Sie gibt ihrem Freund das Buch.',
    template: 'Sie gibt ___ Freund das Buch.',
    blanks: [{ word: 'ihrem', distractors: ['ihren', 'ihrer'] }],
    note: 'Dative masculine possessive: ihrem',
  },
  {
    en: 'The red car is fast.',
    de: 'Das rote Auto ist schnell.',
    template: 'Das ___ Auto ist schnell.',
    blanks: [{ word: 'rote', distractors: ['roten', 'roter'] }],
    note: 'After definite article das (neuter): adjective ending -e',
  },
  {
    en: 'I am going to my friend.',
    de: 'Ich gehe zu meinem Freund.',
    template: 'Ich gehe zu ___ Freund.',
    blanks: [{ word: 'meinem', distractors: ['meinen', 'mein'] }],
    note: 'zu + dative masculine: meinem',
  },
  {
    en: 'They are eating at the restaurant.',
    de: 'Sie essen im Restaurant.',
    template: 'Sie essen ___ Restaurant.',
    blanks: [{ word: 'im', distractors: ['in das', 'ins'] }],
    note: 'im = in + dem (dative, location not movement)',
  },
];

/**
 * B1 sentences — free typing, AI-graded.
 * de: the expected correct translation (shown in feedback)
 * note: grammar concept to highlight in feedback
 */
export const TRANSLATE_SENTENCES_B1 = [
  {
    en: 'Yesterday I went to the market and bought vegetables.',
    de: 'Gestern bin ich zum Markt gegangen und habe Gemüse gekauft.',
    note: 'Perfekt with sein (movement) and haben',
  },
  {
    en: 'If I had more time, I would learn more German.',
    de: 'Wenn ich mehr Zeit hätte, würde ich mehr Deutsch lernen.',
    note: 'Konjunktiv II: hätte / würde + infinitive',
  },
  {
    en: 'The woman whose bag was stolen is at the police station.',
    de: 'Die Frau, deren Tasche gestohlen wurde, ist auf der Polizeistation.',
    note: 'Relative clause with genitive: deren',
  },
  {
    en: 'She told me that she would come tomorrow.',
    de: 'Sie sagte mir, dass sie morgen kommen würde.',
    note: 'Indirect speech with Konjunktiv I/II; dass pushes verb to end',
  },
  {
    en: 'He has been living in Berlin for three years.',
    de: 'Er wohnt seit drei Jahren in Berlin.',
    note: 'German uses present tense + seit for ongoing actions',
  },
  {
    en: 'I need to finish this report before the meeting.',
    de: 'Ich muss diesen Bericht vor dem Meeting fertigstellen.',
    note: 'Modal verb müssen + infinitive at end; vor + dative',
  },
  {
    en: 'The children who are playing outside are very loud.',
    de: 'Die Kinder, die draußen spielen, sind sehr laut.',
    note: 'Relative clause: die (nominative plural)',
  },
  {
    en: 'Despite the rain, we enjoyed the walk.',
    de: 'Trotz des Regens haben wir den Spaziergang genossen.',
    note: 'trotz + genitive; Perfekt with haben',
  },
  {
    en: 'Could you please tell me where the nearest pharmacy is?',
    de: 'Könnten Sie mir bitte sagen, wo die nächste Apotheke ist?',
    note: 'Polite Konjunktiv II: könnten; indirect question with verb-final',
  },
  {
    en: 'I would have called you if I had known your number.',
    de: 'Ich hätte dich angerufen, wenn ich deine Nummer gewusst hätte.',
    note: 'Conditional perfect: hätte + past participle',
  },
];

// ─── Chat Tab — Guided Tasks ──────────────────────────────────────────────────

export const CHAT_TASKS = {
  free: {
    a1: [
      { task: 'Say hello and tell Anna your name.', hint: 'Hallo! Ich heiße [dein Name].' },
      { task: 'Ask Anna how she is.', hint: 'Wie geht es dir?' },
      { task: 'Tell Anna what you like to eat.', hint: 'Ich esse gerne [food].' },
    ],
    a2: [
      {
        task: 'Ask Anna what she does for work and where she lives.',
        hint: 'Was machst du beruflich? Wo wohnst du?',
      },
      {
        task: 'Tell Anna about your daily routine.',
        hint: 'Ich stehe um ... Uhr auf und dann ...',
      },
      {
        task: 'Describe your family to Anna.',
        hint: 'Ich habe [einen Bruder / zwei Schwestern / ...].',
      },
    ],
    b1: [
      {
        task: 'Tell Anna about an interesting place you visited recently and why you liked it.',
        hint: null,
      },
      {
        task: 'Discuss with Anna whether big cities are better to live in than small towns.',
        hint: null,
      },
      { task: 'Explain to Anna a problem you had recently and how you solved it.', hint: null },
    ],
  },
  coffee: {
    a1: [
      { task: 'Order a coffee.', hint: 'Einen Kaffee, bitte.' },
      { task: 'Ask for the bill.', hint: 'Die Rechnung, bitte.' },
    ],
    a2: [
      {
        task: 'Order a large coffee and ask how much it costs.',
        hint: 'Einen großen Kaffee, bitte. Was kostet das?',
      },
      {
        task: 'Ask if they have decaf and order a piece of cake too.',
        hint: 'Haben Sie entkoffeinierten Kaffee? Ich nehme auch ein Stück Kuchen.',
      },
    ],
    b1: [
      {
        task: 'Make a reservation for four people this evening and ask about the menu.',
        hint: null,
      },
      {
        task: 'Complain politely that your order is wrong and ask for the correct item.',
        hint: null,
      },
    ],
  },
  meet: {
    a1: [
      {
        task: 'Introduce yourself — give your name and say where you are from.',
        hint: 'Ich heiße ... und komme aus ...',
      },
      { task: 'Ask Anna her name and where she is from.', hint: 'Wie heißt du? Woher kommst du?' },
    ],
    a2: [
      {
        task: 'Ask Anna about her hobbies and tell her yours.',
        hint: 'Was machst du in deiner Freizeit? Ich ... gerne.',
      },
      {
        task: 'Invite Anna to do something together this weekend.',
        hint: 'Hast du am Wochenende Zeit? Wir könnten ...',
      },
    ],
    b1: [
      {
        task: 'Have a natural small-talk conversation — ask Anna about her week and share something interesting about yours.',
        hint: null,
      },
    ],
  },
  airport: {
    a1: [
      { task: 'Ask where the check-in desk is.', hint: 'Entschuldigung, wo ist der Check-in?' },
      { task: 'Ask how much the ticket costs.', hint: 'Was kostet das Ticket?' },
    ],
    a2: [
      {
        task: 'Ask a staff member where gate B12 is and how long the walk takes.',
        hint: 'Entschuldigung, wo ist Gate B12? Wie lange dauert der Weg?',
      },
      {
        task: 'Tell the check-in agent you have one suitcase to check and ask about hand luggage rules.',
        hint: 'Ich habe einen Koffer aufzugeben. Was sind die Handgepäckregeln?',
      },
    ],
    b1: [
      {
        task: 'Explain to staff that your flight was cancelled and ask what your options are.',
        hint: null,
      },
    ],
  },
};

// ─── Alphabet Quiz — Confusable Letter Groups ─────────────────────────────────

/**
 * Each group is four letters that sound similar or are visually confusable.
 * AlphabetTab plays one letter and asks the learner to identify it from these four.
 */
export const ALPHABET_QUIZ_GROUPS = [
  { letters: ['U', 'Ü', 'O', 'Ö'] },
  { letters: ['A', 'Ä', 'E', 'I'] },
  { letters: ['S', 'ß', 'Z', 'W'] },
  { letters: ['B', 'P', 'D', 'T'] },
  { letters: ['V', 'W', 'F', 'B'] },
  { letters: ['G', 'K', 'J', 'Y'] },
  { letters: ['R', 'L', 'N', 'M'] },
  { letters: ['H', 'X', 'Q', 'C'] },
];
