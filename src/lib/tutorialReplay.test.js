import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TUTORIAL_KEY,
  TUTORIAL_REPLAY_EVENT,
  completeTutorial,
  isTutorialDone,
  replayTutorial,
} from './tutorialPref.js';

describe('replayTutorial', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears the seen flag so the overlay opens again', () => {
    completeTutorial();
    expect(isTutorialDone()).toBe(true);

    replayTutorial();

    expect(isTutorialDone()).toBe(false);
    expect(localStorage.getItem(TUTORIAL_KEY)).toBeNull();
  });

  it('announces the replay, because the overlay reads its flag once on mount', () => {
    const heard = vi.fn();
    window.addEventListener(TUTORIAL_REPLAY_EVENT, heard);
    replayTutorial();
    window.removeEventListener(TUTORIAL_REPLAY_EVENT, heard);

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('still announces when storage refuses the write', () => {
    // Settings' "Show tutorial" must work in private mode too: the overlay is
    // already mounted, so the event alone is enough to reopen it this session.
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const heard = vi.fn();
    window.addEventListener(TUTORIAL_REPLAY_EVENT, heard);

    expect(() => replayTutorial()).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);

    window.removeEventListener(TUTORIAL_REPLAY_EVENT, heard);
    removeItem.mockRestore();
  });
});
