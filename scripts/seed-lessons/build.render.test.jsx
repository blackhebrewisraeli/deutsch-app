import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ExerciseViewer from '../../src/components/exercises/ExerciseViewer';
import { EXERCISE_TYPES, sanitizeLessons } from '../../src/lib/lessons';
import { buildLessons } from './build.js';

const lessons = buildLessons();
const allExercises = lessons.flatMap((l) => l.exercises.map((ex) => [`${l.tab}/${ex.id}`, ex]));

describe('built lessons — every exercise actually renders', () => {
  it('survives the client sanitizer with every exercise intact', () => {
    const asServed = sanitizeLessons(lessons.map((l) => ({ ...l, unitNumber: l.unit_number })));
    const before = lessons.reduce((n, l) => n + l.exercises.length, 0);
    const after = asServed.reduce((n, l) => n + l.exercises.length, 0);
    expect(after).toBe(before);
  });

  it('uses only types the registry can route', () => {
    for (const [, ex] of allExercises) expect(EXERCISE_TYPES).toContain(ex.type);
  });

  it.each(allExercises)('%s renders its own content', (_label, ex) => {
    const { container } = render(<ExerciseViewer id={ex.id} type={ex.type} payload={ex.payload} />);
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
      const group = screen.getByRole('group', { name: 'Options' });
      expect(within(group).getAllByRole('listitem')).toHaveLength(ex.payload.choices.length);
    }
    if (ex.type === 'chat') {
      // ChatExercise puts the opening in one <p>; RTL's default matcher
      // collapses newlines, so the raw joined string is not queryable.
      for (const line of ex.payload.initialMessage.split('\n').filter(Boolean)) {
        expect(screen.getByText(line, { exact: false })).toBeInTheDocument();
      }
      expect(screen.getByText(ex.payload.persona)).toBeInTheDocument();
    }
  });
});
