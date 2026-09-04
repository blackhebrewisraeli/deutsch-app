import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import fixture from './fixture.json';
import ExerciseViewer from '../../src/components/exercises/ExerciseViewer';
import { EXERCISE_TYPES, sanitizeLessons } from '../../src/lib/lessons';

// A seed fixture that the shipped renderers cannot display is worse than no
// seed: the row inserts cleanly, the API serves it, and the tab shows an empty
// card. Spec 5.3's sketched payloads are NOT all the keys the stubs read —
// multiple-choice takes `choices` as plain STRINGS and has no correctId — so
// these tests assert against the components, not against the spec prose.

const allExercises = fixture.lessons.flatMap((l) =>
  l.exercises.map((ex) => [`${l.tab}/${ex.id}`, ex])
);

describe('seed fixture — contract', () => {
  it('covers all four tabs at a1, so every tab has something to render', () => {
    expect(fixture.lessons.map((l) => l.tab).sort()).toEqual([
      'alphabet',
      'chat',
      'translate',
      'vocab',
    ]);
    expect(fixture.lessons.every((l) => l.level === 'a1')).toBe(true);
  });

  it('survives the client sanitizer with every exercise intact', () => {
    // The API drops elements missing id/type, and so does lessons.js. A fixture
    // that loses rows on the way out would seed content nobody ever sees.
    const asServed = sanitizeLessons(
      fixture.lessons.map((l) => ({ ...l, unitNumber: l.unit_number }))
    );
    const before = fixture.lessons.reduce((n, l) => n + l.exercises.length, 0);
    const after = asServed.reduce((n, l) => n + l.exercises.length, 0);
    expect(after).toBe(before);
  });

  it('uses only types the registry can route', () => {
    for (const [, ex] of allExercises) expect(EXERCISE_TYPES).toContain(ex.type);
  });

  it('has globally unique ids, so React keys never collide across units', () => {
    const ids = allExercises.map(([, ex]) => ex.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('satisfies the table CHECK constraints the migration declares', () => {
    for (const l of fixture.lessons) {
      expect(['a1', 'a2', 'b1']).toContain(l.level);
      expect(['chat', 'alphabet', 'vocab', 'translate']).toContain(l.tab);
      expect(l.course_code).toBe('de');
      expect(l.unit_number).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(l.exercises)).toBe(true);
    }
  });
});

describe('seed fixture — every exercise actually renders', () => {
  it.each(allExercises)('%s renders its own content', (_label, ex) => {
    const { container } = render(<ExerciseViewer id={ex.id} type={ex.type} payload={ex.payload} />);
    // UnknownExercise is the registry's fallback — reaching it means the type
    // never routed, which is the failure this whole file exists to catch.
    expect(container.querySelector('[data-exercise-type]')).toHaveAttribute(
      'data-exercise-type',
      ex.type
    );

    if (ex.type === 'flashcard') {
      expect(screen.getByRole('heading', { name: ex.payload.term })).toBeInTheDocument();
    }
    if (ex.type === 'translate') {
      expect(screen.getByText(ex.payload.prompt)).toBeInTheDocument();
    }
    if (ex.type === 'multiple-choice') {
      expect(screen.getByRole('heading', { name: ex.payload.question })).toBeInTheDocument();
      // The stub filters options to STRINGS. An array of { id, label } objects
      // renders zero choices and still passes a "the question is on screen"
      // assertion — so count them.
      const group = screen.getByRole('group', { name: 'Options' });
      expect(within(group).getAllByRole('listitem')).toHaveLength(ex.payload.choices.length);
    }
    if (ex.type === 'chat') {
      expect(screen.getByText(ex.payload.initialMessage)).toBeInTheDocument();
      expect(screen.getByText(ex.payload.persona)).toBeInTheDocument();
    }
  });
});
