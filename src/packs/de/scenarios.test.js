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

describe('scenario roles', () => {
  it('gives every scenario a role with a name and a brief', () => {
    for (const s of SCENARIOS) {
      expect(s.role, `${s.id} has no role`).toBeTruthy();
      for (const field of ['name', 'brief']) {
        expect(typeof s.role[field], `${s.id}.role.${field}`).toBe('string');
        expect(s.role[field].trim().length, `${s.id}.role.${field} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('carries no canned opener — the AI writes it in character', () => {
    for (const s of SCENARIOS) expect(s).not.toHaveProperty('greeting');
  });

  it('casts Order Coffee as a barista, not the tutor', () => {
    const coffee = SCENARIOS.find((s) => s.id === 'coffee');
    expect(coffee.role.name).toBe('Barista');
    expect(coffee.role.brief).toMatch(/barista/i);
  });
});
