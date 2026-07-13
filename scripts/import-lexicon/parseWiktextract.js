const KEPT_POS = {
  noun: 'noun', verb: 'verb', adj: 'adj', adjective: 'adj', adv: 'adv', adverb: 'adv',
  prep: 'prep', preposition: 'prep', num: 'num', numeral: 'num',
  pron: 'pron', pronoun: 'pron', conj: 'conj', conjunction: 'conj',
};
const GENDER_ARTICLE = { masculine: 'der', feminine: 'die', neuter: 'das' };

function mapPos(pos) {
  return KEPT_POS[pos] || null;
}

// Noun gender lives on the sense tags in the kaikki/Wiktextract German export
// (e.g. senses[0].tags: ["neuter","strong"]) — NOT on the canonical form. Reading
// forms[].tags mis-fires: many nouns list no gender there (→ dropped), and the
// diminutive forms that DO carry a gender are always neuter (→ wrong article).
function articleFromSenses(senses) {
  for (const s of senses || []) {
    for (const t of s.tags || []) {
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

const PERSON_SLOT = {
  'first-person|singular': 'ich',
  'second-person|singular': 'du',
  'third-person|singular': 'er',
  'first-person|plural': 'wir',
  'second-person|plural': 'ihr',
  'third-person|plural': 'sie',
};

function verbFromForms(forms) {
  const present = { ich: null, du: null, er: null, wir: null, ihr: null, sie: null };
  let partizip2 = null;
  let aux = null;
  let found = false;

  for (const f of forms || []) {
    if (!f.form) continue;
    const tags = f.tags || [];
    const has = (t) => tags.includes(t);

    if (has('present') && has('indicative')) {
      const person = ['first-person', 'second-person', 'third-person'].find((p) => has(p));
      const number = ['singular', 'plural'].find((n) => has(n));
      const slot = person && number ? PERSON_SLOT[`${person}|${number}`] : null;
      if (slot && present[slot] === null) {
        present[slot] = f.form;
        found = true;
      }
    }
    if (partizip2 === null && has('participle') && (has('past') || has('perfect'))) {
      partizip2 = f.form;
      found = true;
    }
    if (aux === null && has('auxiliary') && ['haben', 'sein'].includes(f.form)) {
      aux = f.form;
      found = true;
    }
  }

  return found ? { aux, partizip2, present } : null;
}

export function parseRecord(raw) {
  if (!raw || raw.lang_code !== 'de' || !raw.word) return null;
  const pos = mapPos(raw.pos);
  if (!pos) return null;

  // Drop non-lemma inflected-form entries: kaikki lists e.g. "sagte" / "gemacht"
  // as their own records whose senses are ALL tagged "form-of" ("inflection of
  // sagen: …"). A true lemma keeps at least one non-form-of definition sense.
  // Filtering here also uses only lemma senses for glosses/gender/examples.
  const senses = (raw.senses || []).filter((s) => !(s.tags || []).includes('form-of'));
  if (senses.length === 0) return null;

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
    article: pos === 'noun' ? articleFromSenses(senses) : null,
    plural: pos === 'noun' ? pluralFromForms(raw.forms) : null,
    ipa: firstIpa(raw.sounds),
    glosses,
    topics,
    rawExamples,
    verb: pos === 'verb' ? verbFromForms(raw.forms) : null,
  };
}
