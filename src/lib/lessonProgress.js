// Visual state for one tab's lesson units. Session-only: the caller passes
// this-session grades. Daily counters cannot reconstruct which exercise was
// done, so a reload returns every unit to its start state.

import { XP_PER_VERDICT } from './gameConfig.js';

/** Types that fire onGraded. Chat is a free conversation and never does. */
export const GRADEABLE_TYPES = ['flashcard', 'translate', 'multiple-choice'];

function gradeableExercises(unit) {
  return (unit?.exercises ?? []).filter((ex) => GRADEABLE_TYPES.includes(ex?.type));
}

function gradedIdsOf(grades) {
  if (!grades) return new Set();
  if (grades instanceof Set) return grades;
  return new Set(Object.keys(grades));
}

/**
 * One row per unit, already sorted by unitNumber.
 * Sequential: unit 1 starts in-progress; N+1 stays locked until N is completed.
 * A unit with zero gradeable exercises is completed immediately so a chat-only
 * unit cannot deadlock the path.
 *
 * @param {Array<{id: string, unitNumber: number, exercises?: Array}> | null | undefined} units
 * @param {Set<string> | Record<string, string> | null | undefined} grades
 * @returns {Array<{id: string, unitNumber: number, state: 'locked'|'in-progress'|'completed', done: number, total: number}>}
 */
export function unitVisualStates(units, grades) {
  if (!Array.isArray(units)) return [];
  const graded = gradedIdsOf(grades);
  const rows = units
    .slice()
    .sort((a, b) => a.unitNumber - b.unitNumber)
    .map((unit) => {
      const gradeable = gradeableExercises(unit);
      const done = gradeable.filter((ex) => graded.has(ex.id)).length;
      const total = gradeable.length;
      return {
        id: unit.id,
        unitNumber: unit.unitNumber,
        done,
        total,
        complete: total === 0 || done === total,
      };
    });

  let open = true;
  return rows.map((row) => {
    let state;
    if (!open) state = 'locked';
    else if (row.complete) state = 'completed';
    else {
      state = 'in-progress';
      open = false;
    }
    return {
      id: row.id,
      unitNumber: row.unitNumber,
      done: row.done,
      total: row.total,
      state,
    };
  });
}

/**
 * Session XP for one unit: sum of XP_PER_VERDICT for grades that belong to it.
 * Read-only — does not write bonusXp or call applyEvent.
 */
export function unitXp(unit, grades = {}) {
  if (!unit || !grades) return 0;
  return gradeableExercises(unit).reduce((sum, ex) => {
    const verdict = grades[ex.id];
    return sum + (XP_PER_VERDICT[verdict] ?? 0);
  }, 0);
}
