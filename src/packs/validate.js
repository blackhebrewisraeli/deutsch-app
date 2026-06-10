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

  if (!pack.validation || typeof pack.validation.normalize !== 'function') {
    fail('validation.normalize must be a function');
  }
  if (typeof pack.cardId !== 'function') {
    fail('cardId must be a function');
  }
  return true;
}
