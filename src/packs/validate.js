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

  // A missing greeting is otherwise a TypeError inside ChatTab's scenario
  // effect — far from the data omission that caused it.
  c.scenarios.forEach((s, i) => {
    const gr = s.greeting;
    if (!gr || typeof gr !== 'object') fail(`content.scenarios[${i}].greeting must be an object`);
    for (const k of ['de', 'ipa', 'en']) {
      if (typeof gr[k] !== 'string' || gr[k].trim().length === 0) {
        fail(`content.scenarios[${i}].greeting.${k} must be a non-empty string`);
      }
    }
  });

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
  const p = pack.prompts;
  const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!p || typeof p !== 'object') fail('prompts is required');
  if (!nonEmpty(p.persona)) fail('prompts.persona must be a non-empty string');
  if (!nonEmpty(p.targetLanguage)) fail('prompts.targetLanguage must be a non-empty string');

  // meta.cefrLevels is uppercase ('A1'); the prompt maps are keyed lowercase
  // because that is the value components hold. A mismatch would not throw at
  // runtime — it would interpolate the string "undefined" into a prompt.
  for (const key of ['levels', 'exercises']) {
    if (!p[key] || typeof p[key] !== 'object') fail(`prompts.${key} must be an object`);
    for (const lvl of m.cefrLevels) {
      const k = String(lvl).toLowerCase();
      if (!nonEmpty(p[key][k])) fail(`prompts.${key}.${k} must be a non-empty string`);
    }
  }

  if (!p.deck || typeof p.deck !== 'object') fail('prompts.deck must be an object');
  for (const k of ['cardExample', 'ipaExample']) {
    if (!nonEmpty(p.deck[k])) fail(`prompts.deck.${k} must be a non-empty string`);
  }

  const g = pack.grammar;
  if (!g || typeof g !== 'object') fail('grammar is required');

  if (!Array.isArray(g.articles) || !g.articles.every(nonEmpty)) {
    fail('grammar.articles must be an array of non-empty strings');
  }
  if (typeof g.articleRequiredForNouns !== 'boolean') {
    fail('grammar.articleRequiredForNouns must be a boolean');
  }
  // Unsatisfiable combination: every noun would fail validation.
  if (g.articles.length === 0 && g.articleRequiredForNouns) {
    fail('grammar.articleRequiredForNouns cannot be true when grammar.articles is empty');
  }

  if (!['before', 'after'].includes(g.articlePosition)) {
    fail("grammar.articlePosition must be 'before' or 'after'");
  }

  if (!g.auxiliaries || typeof g.auxiliaries !== 'object') {
    fail('grammar.auxiliaries must be an object');
  }
  for (const [aux, third] of Object.entries(g.auxiliaries)) {
    if (!nonEmpty(third)) fail(`grammar.auxiliaries.${aux} must be a non-empty string`);
  }

  if (!Array.isArray(g.personKeys) || g.personKeys.length === 0 || !g.personKeys.every(nonEmpty)) {
    fail('grammar.personKeys must be a non-empty array of non-empty strings');
  }
  // A displayPerson outside personKeys fails silently at render time — the
  // conjugation row simply never appears — so it is caught here instead.
  if (!nonEmpty(g.displayPerson) || !g.personKeys.includes(g.displayPerson)) {
    fail('grammar.displayPerson must be one of grammar.personKeys');
  }

  if (!g.labels || typeof g.labels !== 'object') fail('grammar.labels must be an object');
  for (const k of ['perfect', 'participle']) {
    if (!nonEmpty(g.labels[k])) fail(`grammar.labels.${k} must be a non-empty string`);
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

/**
 * Asserts a value satisfies the LexiconEntry shape.
 * Throws an Error describing the first violation; returns true on success.
 *
 * Grammar comes from the pack, not from this module: which articles exist,
 * whether nouns require one, which auxiliaries and persons a verb may use.
 * `cefrLevels` is the pack's own meta.cefrLevels.
 *
 * @param {object} entry
 * @param {{ grammar: object, cefrLevels: string[] }} options
 * @returns {true}
 */
export function validateLexiconEntry(entry, { grammar, cefrLevels }) {
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

  if (entry.article !== null && !grammar.articles.includes(entry.article)) {
    fail(`article must be null or one of ${grammar.articles.join('|')}`);
  }
  if (entry.pos === 'noun' && entry.article === null && grammar.articleRequiredForNouns) {
    fail('article is required for nouns');
  }

  if (entry.ipa !== null && typeof entry.ipa !== 'string') fail('ipa must be null or a string');
  if (entry.plural !== null && typeof entry.plural !== 'string')
    fail('plural must be null or a string');

  if (entry.cefr !== null && !cefrLevels.includes(entry.cefr)) {
    fail(`cefr must be null or one of ${cefrLevels.join('|')}`);
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
    if (v.aux !== null && !Object.keys(grammar.auxiliaries).includes(v.aux)) {
      fail(`verb.aux must be null or one of ${Object.keys(grammar.auxiliaries).join('|')}`);
    }
    if (v.partizip2 !== null && typeof v.partizip2 !== 'string') {
      fail('verb.partizip2 must be null or a string');
    }
    if (!v.present || typeof v.present !== 'object') fail('verb.present must be an object');
    for (const p of grammar.personKeys) {
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
