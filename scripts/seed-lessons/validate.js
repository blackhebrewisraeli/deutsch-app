// Shape + contract checks for lesson rows before they hit Postgres.
//
// The table CHECKs catch level/tab/course_code. They cannot cheaply enforce
// "every exercise has id + type" or "multiple-choice.answer is one of choices".
// Those live here so a dry-run can fail before a service-role write.

import { EXERCISE_TYPES, sanitizeLessons } from '../../src/lib/lessons.js';

const LEVELS = ['a1', 'a2', 'b1'];
const TABS = ['chat', 'alphabet', 'vocab', 'translate'];

export function rowKey({ pack_id, course_code, level, tab, unit_number }) {
  return `${pack_id}|${course_code}|${level}|${tab}|${unit_number}`;
}

export function findOrphans(existing, seed) {
  const keep = new Set(seed.map(rowKey));
  return existing.filter((row) => !keep.has(rowKey(row)));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function payloadErrors(ex, loc) {
  const payload = ex.payload && typeof ex.payload === 'object' ? ex.payload : {};
  const errors = [];

  if (ex.type === 'flashcard') {
    if (!isNonEmptyString(payload.term)) errors.push(`${loc}: flashcard needs term`);
    if (!Array.isArray(payload.glosses) || payload.glosses.filter(Boolean).length === 0) {
      errors.push(`${loc}: flashcard needs glosses`);
    }
  }

  if (ex.type === 'translate') {
    if (!isNonEmptyString(payload.prompt)) errors.push(`${loc}: translate needs prompt`);
    if (!Array.isArray(payload.accepted) || payload.accepted.filter(Boolean).length === 0) {
      errors.push(`${loc}: translate needs accepted`);
    }
    if (!isNonEmptyString(payload.direction)) errors.push(`${loc}: translate needs direction`);
  }

  if (ex.type === 'multiple-choice') {
    if (!isNonEmptyString(payload.question) && !isNonEmptyString(payload.prompt)) {
      errors.push(`${loc}: multiple-choice needs question`);
    }
    if (
      !Array.isArray(payload.choices) ||
      payload.choices.some((choice) => typeof choice !== 'string')
    ) {
      errors.push(`${loc}: choices must be strings`);
    }
    if (!isNonEmptyString(payload.answer)) {
      errors.push(`${loc}: multiple-choice needs answer`);
    } else if (Array.isArray(payload.choices) && !payload.choices.includes(payload.answer)) {
      errors.push(`${loc}: answer is not among choices`);
    }
  }

  if (ex.type === 'chat') {
    if (!isNonEmptyString(payload.initialMessage)) errors.push(`${loc}: chat needs initialMessage`);
    if (!isNonEmptyString(payload.persona)) errors.push(`${loc}: chat needs persona`);
  }

  return errors;
}

export function validateLessons(lessons) {
  const errors = [];
  if (!Array.isArray(lessons)) return { ok: false, errors: ['lessons must be an array'] };

  const ids = [];
  for (const lesson of lessons) {
    const loc = `${lesson?.level}/${lesson?.tab}/unit ${lesson?.unit_number}`;
    if (lesson?.pack_id !== 'de') errors.push(`${loc}: pack_id must be 'de'`);
    if (lesson?.course_code !== 'de') errors.push(`${loc}: course_code must be 'de'`);
    if (!LEVELS.includes(lesson?.level)) errors.push(`${loc}: invalid level`);
    if (!TABS.includes(lesson?.tab)) errors.push(`${loc}: invalid tab`);
    if (!Number.isInteger(lesson?.unit_number) || lesson.unit_number < 1) {
      errors.push(`${loc}: unit_number must be >= 1`);
    }
    if (!Array.isArray(lesson?.exercises)) {
      errors.push(`${loc}: exercises must be an array`);
      continue;
    }

    for (const ex of lesson.exercises) {
      const el = `${loc}/${ex?.id || '(missing id)'}`;
      if (!isNonEmptyString(ex?.id)) errors.push(`${el}: id is required`);
      else ids.push(ex.id);
      if (!EXERCISE_TYPES.includes(ex?.type)) errors.push(`${el}: unknown type ${ex?.type}`);
      errors.push(...payloadErrors(ex ?? {}, el));
    }
  }

  if (new Set(ids).size !== ids.length) errors.push('exercise ids must be unique');

  const asServed = sanitizeLessons(lessons.map((l) => ({ ...l, unitNumber: l.unit_number })));
  const before = lessons.reduce(
    (n, l) => n + (Array.isArray(l.exercises) ? l.exercises.length : 0),
    0
  );
  const after = asServed.reduce((n, l) => n + l.exercises.length, 0);
  if (after !== before) errors.push(`sanitizer dropped ${before - after} exercise(s)`);

  return { ok: errors.length === 0, errors };
}
