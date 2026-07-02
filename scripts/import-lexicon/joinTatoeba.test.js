import { describe, it, expect } from 'vitest';
import { buildExampleIndex, attachExamples, pickExamples } from './joinTatoeba.js';

const pairs = [
  { de: 'Ich esse Brot.', en: 'I eat bread.' },
  { de: 'Das Brot ist frisch und das Brot ist gut.', en: 'The bread is fresh and the bread is good.' },
  { de: 'Wir gehen nach Hause.', en: 'We go home.' },
];

describe('pickExamples', () => {
  const tat = (de, en) => ({ de, en, source: 'tatoeba' });
  const raw = (de, en) => ({ de, en });

  it('(a) tatoeba present → tatoeba kept and capped at max', () => {
    const tatoeba = [tat('Ich esse Brot.', 'I eat bread.'), tat('Das Brot ist gut.', 'The bread is good.')];
    const result = pickExamples(tatoeba, [raw('Brot backen ist schön.', 'Baking bread is nice.')], 2);
    expect(result).toEqual([tat('Ich esse Brot.', 'I eat bread.'), tat('Das Brot ist gut.', 'The bread is good.')]);
  });

  it('(b) tatoeba empty + valid rawExample → returns wiktionary-tagged example', () => {
    const result = pickExamples([], [raw('Das Haus ist groß.', 'The house is big.')], 2);
    expect(result).toEqual([{ de: 'Das Haus ist groß.', en: 'The house is big.', source: 'wiktionary' }]);
  });

  it('(c) rawExample with null/empty en is skipped', () => {
    expect(pickExamples([], [raw('Nur Deutsch.', null)], 2)).toEqual([]);
    expect(pickExamples([], [raw('Nur Deutsch.', '')], 2)).toEqual([]);
  });

  it('(d) combined list respects max with tatoeba first', () => {
    const tatoeba = [tat('Satz eins.', 'Sentence one.')];
    const raws = [raw('Satz zwei.', 'Sentence two.'), raw('Satz drei.', 'Sentence three.')];
    const result = pickExamples(tatoeba, raws, 2);
    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('tatoeba');
    expect(result[1].source).toBe('wiktionary');
  });
});

describe('buildExampleIndex + attachExamples', () => {
  it('finds sentences containing the lemma, shortest first', () => {
    const index = buildExampleIndex(pairs);
    const out = attachExamples({ lemma: 'Brot' }, index, 2);
    expect(out).toEqual([
      { de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' },
      { de: 'Das Brot ist frisch und das Brot ist gut.', en: 'The bread is fresh and the bread is good.', source: 'tatoeba' },
    ]);
  });
  it('respects the max cap', () => {
    const index = buildExampleIndex(pairs);
    expect(attachExamples({ lemma: 'Brot' }, index, 1)).toHaveLength(1);
  });
  it('returns [] when no sentence contains the lemma', () => {
    const index = buildExampleIndex(pairs);
    expect(attachExamples({ lemma: 'Quark' }, index, 2)).toEqual([]);
  });
});
