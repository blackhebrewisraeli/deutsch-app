// Minimal but realistic Wiktextract records (kaikki.org German extraction shape).
export const NOUN_BROT = {
  word: 'Brot',
  pos: 'noun',
  lang_code: 'de',
  forms: [
    { form: 'Brot', tags: ['canonical', 'neuter'] },
    { form: 'Brote', tags: ['plural'] },
  ],
  sounds: [{ ipa: '[bʁoːt]' }],
  senses: [
    { glosses: ['bread'], topics: ['food'], examples: [{ text: 'Ich esse Brot.', english: 'I eat bread.' }] },
  ],
};

export const VERB_GEHEN = {
  word: 'gehen',
  pos: 'verb',
  lang_code: 'de',
  forms: [],
  sounds: [{ ipa: '[ˈɡeːən]' }],
  senses: [{ glosses: ['to go', 'to walk'], examples: [{ text: 'Wir gehen.', english: 'We go.' }] }],
};

export const NON_GERMAN = { word: 'bread', pos: 'noun', lang_code: 'en', senses: [{ glosses: ['bread'] }] };

export const NO_GLOSS = { word: 'Xyz', pos: 'noun', lang_code: 'de', senses: [{ glosses: [] }] };

export const NOUN_WITH_DUPLICATE_GLOSSES = {
  word: 'Haus',
  pos: 'noun',
  lang_code: 'de',
  forms: [
    { form: 'Haus', tags: ['canonical', 'neuter'] },
    { form: 'Häuser', tags: ['plural'] },
  ],
  sounds: [{ ipa: '[haʊs]' }],
  senses: [
    { glosses: ['house', 'home'], examples: [{ text: 'Das ist mein Haus.', english: 'This is my house.' }] },
    { glosses: ['house', 'building', 'structure', 'dwelling'], examples: [] },
  ],
};

export const VERB_FULL = {
  word: 'gehen',
  pos: 'verb',
  lang_code: 'de',
  forms: [
    { form: 'gehe', tags: ['present', 'indicative', 'first-person', 'singular'] },
    { form: 'gehst', tags: ['present', 'indicative', 'second-person', 'singular'] },
    { form: 'geht', tags: ['present', 'indicative', 'third-person', 'singular'] },
    { form: 'gehen', tags: ['present', 'indicative', 'first-person', 'plural'] },
    { form: 'geht', tags: ['present', 'indicative', 'second-person', 'plural'] },
    { form: 'gehen', tags: ['present', 'indicative', 'third-person', 'plural'] },
    { form: 'gegangen', tags: ['participle', 'past'] },
    { form: 'sein', tags: ['auxiliary'] },
  ],
  sounds: [{ ipa: '[ˈɡeːən]' }],
  senses: [{ glosses: ['to go'], examples: [{ text: 'Wir gehen.', english: 'We go.' }] }],
};

export const VERB_PARTIAL = {
  word: 'machen',
  pos: 'verb',
  lang_code: 'de',
  forms: [
    { form: 'mache', tags: ['present', 'indicative', 'first-person', 'singular'] },
    { form: 'gemacht', tags: ['participle', 'past'] },
  ],
  sounds: [],
  senses: [{ glosses: ['to make'] }],
};

export const VERB_NO_FORMS = {
  word: 'testen',
  pos: 'verb',
  lang_code: 'de',
  forms: [],
  sounds: [],
  senses: [{ glosses: ['to test'] }],
};
