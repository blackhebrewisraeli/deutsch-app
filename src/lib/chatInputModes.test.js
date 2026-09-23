import { describe, it, expect } from 'vitest';
import { INPUT_MODES, defaultInputMode } from './chatInputModes';

describe('defaultInputMode (mock)', () => {
  it.each([
    ['A1', INPUT_MODES.WORD_BANK],
    ['a1', INPUT_MODES.WORD_BANK],
    ['A2', INPUT_MODES.WORD_BANK],
    ['B1', INPUT_MODES.FREE_TEXT],
    [undefined, INPUT_MODES.FREE_TEXT],
  ])('%s starts in %s', (level, mode) => {
    expect(defaultInputMode(level)).toBe(mode);
  });
});
