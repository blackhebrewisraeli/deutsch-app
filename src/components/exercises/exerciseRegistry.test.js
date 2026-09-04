import { describe, it, expect } from 'vitest';
import { EXERCISE_TYPES, getExerciseComponent } from './exerciseRegistry';
import ChatExercise from './ChatExercise';
import FlashcardExercise from './FlashcardExercise';
import MultipleChoiceExercise from './MultipleChoiceExercise';
import TranslateExercise from './TranslateExercise';
import UnknownExercise from './UnknownExercise';

describe('exerciseRegistry', () => {
  it('exposes the closed type set from the lesson contract', () => {
    expect(EXERCISE_TYPES).toEqual(['flashcard', 'translate', 'chat', 'multiple-choice']);
  });

  it('resolves every closed type to its stub renderer', () => {
    expect(getExerciseComponent('flashcard')).toBe(FlashcardExercise);
    expect(getExerciseComponent('translate')).toBe(TranslateExercise);
    expect(getExerciseComponent('chat')).toBe(ChatExercise);
    expect(getExerciseComponent('multiple-choice')).toBe(MultipleChoiceExercise);
  });

  it('falls back to UnknownExercise for an unknown or missing type', () => {
    expect(getExerciseComponent('hologram')).toBe(UnknownExercise);
    expect(getExerciseComponent(undefined)).toBe(UnknownExercise);
    expect(getExerciseComponent(null)).toBe(UnknownExercise);
    expect(getExerciseComponent('')).toBe(UnknownExercise);
  });
});
