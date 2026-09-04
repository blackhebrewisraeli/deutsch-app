import { describe, it, expect } from 'vitest';
import { EXERCISE_TYPES, getExerciseComponent } from './exerciseRegistry';
import FlashcardExercise from './FlashcardExercise';
import TranslateExercise from './TranslateExercise';
import UnknownExercise from './UnknownExercise';

describe('exerciseRegistry', () => {
  it('exposes the closed type set from the lesson contract', () => {
    expect(EXERCISE_TYPES).toEqual(['flashcard', 'translate', 'chat', 'multiple-choice']);
  });

  it('resolves flashcard and translate to their stub renderers', () => {
    expect(getExerciseComponent('flashcard')).toBe(FlashcardExercise);
    expect(getExerciseComponent('translate')).toBe(TranslateExercise);
  });

  it('falls back to UnknownExercise for closed types that have no renderer yet', () => {
    expect(getExerciseComponent('chat')).toBe(UnknownExercise);
    expect(getExerciseComponent('multiple-choice')).toBe(UnknownExercise);
  });

  it('falls back to UnknownExercise for an unknown or missing type', () => {
    expect(getExerciseComponent('hologram')).toBe(UnknownExercise);
    expect(getExerciseComponent(undefined)).toBe(UnknownExercise);
    expect(getExerciseComponent(null)).toBe(UnknownExercise);
    expect(getExerciseComponent('')).toBe(UnknownExercise);
  });
});
