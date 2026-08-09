/**
 * Asserts a value satisfies the LanguagePack contract shape.
 * Throws an Error describing the first violation; returns true on success.
 * @param {object} pack
 * @returns {true}
 */
export function validateLanguagePack(pack) {
  const fail = (msg) => {
    throw new Error(`Invalid LanguagePack: ${msg}`);
  };
  if (!pack || typeof pack !== 'object') fail('pack must be an object');

  const m = pack.meta;
  if (!m || typeof m !== 'object') fail('meta is required');
  for (const k of ['id', 'name', 'nativeName', 'locale', 'direction', 'themeId']) {
    if (typeof m[k] !== 'string') fail(`meta.${k} must be a string`);
  }
  if (!Array.isArray(m.cefrLevels)) fail('meta.cefrLevels must be an array');

  const c = pack.content;
  if (!c || typeof c !== 'object') fail('content is required');
  for (const k of ['alphabet', 'alphabetQuiz', 'scenarios']) {
    if (!Array.isArray(c[k])) fail(`content.${k} must be an array`);
  }
  for (const k of ['decks', 'chatTasks', 'translateSentences']) {
    if (!c[k] || typeof c[k] !== 'object') fail(`content.${k} must be an object`);
  }
  for (const lvl of m.cefrLevels) {
    if (!Array.isArray(c.translateSentences[lvl])) {
      fail(`content.translateSentences.${lvl} must be an array`);
    }
  }

  const v = pack.validation;
  if (!v || typeof v !== 'object') fail('validation is required');
  const t = v.target;
  if (!t || typeof t !== 'object') fail('validation.target must be an object');
  for (const k of ['trim', 'caseFold', 'stripCombiningMarks']) {
    if (typeof t[k] !== 'boolean') fail(`validation.target.${k} must be a boolean`);
  }
  if (!Array.isArray(t.replacements)) fail('validation.target.replacements must be an array');
  for (const pair of t.replacements) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((x) => typeof x === 'string')) {
      fail('each validation.target replacement must be a pair of strings');
    }
    if (pair[0] === '') fail('a validation.target replacement `from` must not be empty');
  }
  if (typeof pack.cardId !== 'function') {
    fail('cardId must be a function');
  }

  validatePackTheme(pack.theme, fail);

  return true;
}

/**
 * Theme contract — thirteen fields the pack must supply.
 * Failures name the missing field so a bad pack fails loudly at startup.
 * @param {object} theme
 * @param {(msg: string) => never} fail
 */
function validatePackTheme(theme, fail) {
  if (!theme || typeof theme !== 'object') fail('theme is required');

  const accent = theme.accent;
  if (!accent || typeof accent !== 'object') fail('theme.accent is required');
  if (typeof accent.fill !== 'string') fail('theme.accent.fill is required');
  if (typeof accent.onFill !== 'string') fail('theme.accent.onFill is required');
  if (!accent.fg || typeof accent.fg !== 'object') fail('theme.accent.fg is required');
  if (typeof accent.fg.light !== 'string') fail('theme.accent.fg.light is required');
  if (typeof accent.fg.dark !== 'string') fail('theme.accent.fg.dark is required');

  const accentAlt = theme.accentAlt;
  if (!accentAlt || typeof accentAlt !== 'object') fail('theme.accentAlt is required');
  if (!accentAlt.fill || typeof accentAlt.fill !== 'object')
    fail('theme.accentAlt.fill is required');
  if (typeof accentAlt.fill.light !== 'string') fail('theme.accentAlt.fill.light is required');
  if (typeof accentAlt.fill.dark !== 'string') fail('theme.accentAlt.fill.dark is required');
  if (!accentAlt.onFill || typeof accentAlt.onFill !== 'object')
    fail('theme.accentAlt.onFill is required');
  if (typeof accentAlt.onFill.light !== 'string') fail('theme.accentAlt.onFill.light is required');
  if (typeof accentAlt.onFill.dark !== 'string') fail('theme.accentAlt.onFill.dark is required');

  if (!Array.isArray(theme.progress)) fail('theme.progress is required');

  const font = theme.font;
  if (!font || typeof font !== 'object') fail('theme.font is required');
  if (typeof font.display !== 'string') fail('theme.font.display is required');
  if (typeof font.body !== 'string') fail('theme.font.body is required');
  if (typeof font.mono !== 'string') fail('theme.font.mono is required');
  if (!Array.isArray(font.families)) fail('theme.font.families is required');
}

export const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'num', 'phrase', 'pron', 'conj'];
export const ARTICLES = ['der', 'die', 'das'];
export const CEFR = ['A1', 'A2', 'B1'];

/**
 * Asserts a value satisfies the LexiconEntry shape.
 * Throws an Error describing the first violation; returns true on success.
 * @param {object} entry
 * @returns {true}
 */
export function validateLexiconEntry(entry) {
  const fail = (msg) => {
    throw new Error(`Invalid LexiconEntry: ${msg}`);
  };
  const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

  if (!entry || typeof entry !== 'object') fail('entry must be an object');
  if (!nonEmptyStr(entry.id)) fail('id must be a non-empty string');
  if (!nonEmptyStr(entry.de)) fail('de must be a non-empty string');

  if (!Array.isArray(entry.en) || entry.en.length === 0 || !entry.en.every(nonEmptyStr)) {
    fail('en must be a non-empty array of non-empty strings');
  }

  if (!POS.includes(entry.pos)) fail(`pos must be one of ${POS.join('|')}`);

  if (entry.article !== null && !ARTICLES.includes(entry.article)) {
    fail(`article must be null or one of ${ARTICLES.join('|')}`);
  }
  if (entry.pos === 'noun' && entry.article === null) {
    fail('article is required for nouns');
  }

  if (entry.ipa !== null && typeof entry.ipa !== 'string') fail('ipa must be null or a string');
  if (entry.plural !== null && typeof entry.plural !== 'string')
    fail('plural must be null or a string');

  if (entry.cefr !== null && !CEFR.includes(entry.cefr)) {
    fail(`cefr must be null or one of ${CEFR.join('|')}`);
  }
  if (entry.freqRank !== null && !(typeof entry.freqRank === 'number' && entry.freqRank > 0)) {
    fail('freqRank must be null or a positive number');
  }

  if (!Array.isArray(entry.tags) || !entry.tags.every((t) => typeof t === 'string')) {
    fail('tags must be an array of strings');
  }

  if (!Array.isArray(entry.examples)) fail('examples must be an array');
  for (const ex of entry.examples) {
    if (!ex || typeof ex !== 'object') fail('each example must be an object');
    if (!nonEmptyStr(ex.de) || !nonEmptyStr(ex.source)) {
      fail('each example must have non-empty de and source');
    }
    // en is optional: Wiktionary examples often carry no translation, and the
    // card renders only the German sentence.
    if (ex.en !== null && !nonEmptyStr(ex.en)) {
      fail('each example must have en null or a non-empty string');
    }
  }

  if (entry.verb !== null) {
    const v = entry.verb;
    if (!v || typeof v !== 'object') fail('verb must be null or an object');
    if (v.aux !== null && !['haben', 'sein'].includes(v.aux)) {
      fail('verb.aux must be null, haben, or sein');
    }
    if (v.partizip2 !== null && typeof v.partizip2 !== 'string') {
      fail('verb.partizip2 must be null or a string');
    }
    if (!v.present || typeof v.present !== 'object') fail('verb.present must be an object');
    for (const p of ['ich', 'du', 'er', 'wir', 'ihr', 'sie']) {
      if (v.present[p] !== null && !nonEmptyStr(v.present[p])) {
        fail(`verb.present.${p} must be null or a non-empty string`);
      }
    }
  }

  if (!entry.source || typeof entry.source !== 'object') fail('source must be an object');
  if (!nonEmptyStr(entry.source.dict) || !nonEmptyStr(entry.source.license)) {
    fail('source.dict and source.license must be non-empty strings');
  }

  return true;
}
