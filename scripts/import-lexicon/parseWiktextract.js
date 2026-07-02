const KEPT_POS = {
  noun: 'noun', verb: 'verb', adj: 'adj', adjective: 'adj', adv: 'adv', adverb: 'adv',
  prep: 'prep', preposition: 'prep', num: 'num', numeral: 'num',
  pron: 'pron', pronoun: 'pron', conj: 'conj', conjunction: 'conj',
};
const GENDER_ARTICLE = { masculine: 'der', feminine: 'die', neuter: 'das' };

function mapPos(pos) {
  return KEPT_POS[pos] || null;
}

function articleFromForms(forms) {
  for (const f of forms || []) {
    for (const t of f.tags || []) {
      if (GENDER_ARTICLE[t]) return GENDER_ARTICLE[t];
    }
  }
  return null;
}

function pluralFromForms(forms) {
  const f = (forms || []).find((x) => (x.tags || []).includes('plural') && x.form);
  return f ? f.form : null;
}

function firstIpa(sounds) {
  const s = (sounds || []).find((x) => x.ipa);
  return s ? s.ipa : null;
}

export function parseRecord(raw) {
  if (!raw || raw.lang_code !== 'de' || !raw.word) return null;
  const pos = mapPos(raw.pos);
  if (!pos) return null;

  const senses = raw.senses || [];
  const glosses = [
    ...new Set(senses.flatMap((s) => (s.glosses || []).filter((g) => typeof g === 'string' && g.trim()))),
  ].slice(0, 3);
  if (glosses.length === 0) return null;

  const topics = [...new Set(senses.flatMap((s) => s.topics || []).filter(Boolean))];
  const rawExamples = senses
    .flatMap((s) => s.examples || [])
    .filter((e) => e && typeof e.text === 'string' && e.text.trim())
    .map((e) => ({ de: e.text, en: typeof e.english === 'string' && e.english.trim() ? e.english : null }));

  return {
    lemma: raw.word,
    pos,
    article: pos === 'noun' ? articleFromForms(raw.forms) : null,
    plural: pos === 'noun' ? pluralFromForms(raw.forms) : null,
    ipa: firstIpa(raw.sounds),
    glosses,
    topics,
    rawExamples,
  };
}
