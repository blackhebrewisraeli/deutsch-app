import { describe, it, expect } from 'vitest';
import { buildExampleIndex, attachExamples } from './joinTatoeba.js';

const pairs = [
  { de: 'Ich esse Brot.', en: 'I eat bread.' },
  { de: 'Das Brot ist frisch und das Brot ist gut.', en: 'The bread is fresh and the bread is good.' },
  { de: 'Wir gehen nach Hause.', en: 'We go home.' },
];

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
