// Data-shape invariants for src/packs/de/chatTasks.js.
//
// These tests do NOT validate German grammar — they validate the contract the
// rest of the app depends on (e.g., "every vocab card has IPA", "A2 templates
// have one blank per word"). When someone adds content and forgets a field,
// these tests catch it before merge.

import { describe, it, expect } from 'vitest';
import { CHAT_TASKS } from './chatTasks';

const SCENARIO_IDS = ['free', 'coffee', 'meet', 'airport'];
const LEVELS = ['a1', 'a2', 'b1'];

describe('CHAT_TASKS', () => {
  it('top-level keys match SCENARIO ids', () => {
    expect(Object.keys(CHAT_TASKS).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it.each(SCENARIO_IDS)('scenario "%s" has tasks for every level (a1/a2/b1)', (sid) => {
    for (const level of LEVELS) {
      expect(Array.isArray(CHAT_TASKS[sid][level])).toBe(true);
      expect(CHAT_TASKS[sid][level].length).toBeGreaterThan(0);
    }
  });

  it('every task has a non-empty task string', () => {
    for (const sid of SCENARIO_IDS) {
      for (const level of LEVELS) {
        for (const t of CHAT_TASKS[sid][level]) {
          expect(typeof t.task).toBe('string');
          expect(t.task.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hint is a string at A1/A2 and null at B1 (matches checklist)', () => {
    for (const sid of SCENARIO_IDS) {
      for (const t of CHAT_TASKS[sid].a1) {
        expect(typeof t.hint).toBe('string');
      }
      for (const t of CHAT_TASKS[sid].a2) {
        expect(typeof t.hint).toBe('string');
      }
      for (const t of CHAT_TASKS[sid].b1) {
        expect(t.hint).toBeNull();
      }
    }
  });
});
