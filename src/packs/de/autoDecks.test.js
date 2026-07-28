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

  it('has a well-shaped auto payload for every deck', () => {
    for (const d of AUTO_DECKS) {
      const { auto } = d;
      if (auto.by === 'top') {
        expect(typeof auto.count).toBe('number');
        expect(auto.count).toBeGreaterThan(0);
      } else if (auto.by === 'tag') {
        if (Array.isArray(auto.tag)) {
          expect(auto.tag.length).toBeGreaterThan(0);
          expect(auto.tag.every((t) => typeof t === 'string')).toBe(true);
        } else {
          expect(typeof auto.tag).toBe('string');
          expect(auto.tag.length).toBeGreaterThan(0);
        }
      } else if (auto.by === 'cefr') {
        expect(typeof auto.level).toBe('string');
        expect(auto.level.length).toBeGreaterThan(0);
      } else if (auto.by === 'freq') {
        expect(Array.isArray(auto.range)).toBe(true);
        expect(auto.range.length).toBe(2);
      }
    }
  });
});
