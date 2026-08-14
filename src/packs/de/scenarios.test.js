// Data-shape invariants for src/packs/de/scenarios.js.
//
// These tests do NOT validate German grammar — they validate the contract the
// rest of the app depends on (e.g., "every vocab card has IPA", "A2 templates
// have one blank per word"). When someone adds content and forgets a field,
// these tests catch it before merge.

import { describe, it, expect } from 'vitest';
import { SCENARIOS } from './scenarios';

const SCENARIO_IDS = ['free', 'coffee', 'meet', 'airport'];

describe('SCENARIOS', () => {
  it('has exactly 4 scenarios', () => {
    expect(SCENARIOS).toHaveLength(4);
  });

  it('exposes the expected ids', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it('every scenario has { id, name, icon, desc } as non-empty strings', () => {
    for (const s of SCENARIOS) {
      for (const field of ['id', 'name', 'icon', 'desc']) {
        expect(typeof s[field]).toBe('string');
        expect(s[field].length).toBeGreaterThan(0);
      }
    }
  });
});
