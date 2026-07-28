import { describe, it, expect } from 'vitest';
import { AUTO_DECKS, DECK_GROUPS } from './autoDecks';

describe('AUTO_DECKS', () => {
  it('has unique ids and a valid auto rule each', () => {
    const ids = AUTO_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of AUTO_DECKS) {
      expect(typeof d.name).toBe('string');
      expect(typeof d.icon).toBe('string');
      expect(DECK_GROUPS).toContain(d.group);
      expect(['top', 'freq', 'cefr', 'tag']).toContain(d.auto.by);
    }
  });
  it('covers all three deck types', () => {
    expect(AUTO_DECKS.some((d) => d.auto.by === 'top')).toBe(true);
    expect(AUTO_DECKS.some((d) => d.auto.by === 'cefr')).toBe(true);
    expect(AUTO_DECKS.some((d) => d.auto.by === 'tag')).toBe(true);
  });
});
