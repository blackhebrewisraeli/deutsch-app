import FlashcardExercise from './FlashcardExercise';
import TranslateExercise from './TranslateExercise';
import UnknownExercise from './UnknownExercise';

/**
 * Closed exercise `type` set from the lessons contract (spec §5.2).
 * New types are a contract change — do not silently insert one here.
 */
export const EXERCISE_TYPES = ['flashcard', 'translate', 'chat', 'multiple-choice'];

const REGISTRY = {
  flashcard: FlashcardExercise,
  translate: TranslateExercise,
};

/**
 * Strategy lookup: `type` string → presentation component.
 * Unknown, missing, or not-yet-built types (chat, multiple-choice) fall back
 * to UnknownExercise so a bad row cannot take down the viewer.
 */
export function getExerciseComponent(type) {
  return REGISTRY[type] ?? UnknownExercise;
}
