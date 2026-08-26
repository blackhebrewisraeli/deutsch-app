import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TUTORIAL_KEY, isTutorialDone, completeTutorial } from './tutorialPref';

describe('tutorialPref', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports not-done for a device that has never seen the tutorial', () => {
    expect(isTutorialDone()).toBe(false);
  });

  it('reports done once completeTutorial has written the flag', () => {
    completeTutorial();
    expect(isTutorialDone()).toBe(true);
  });

  it('writes the documented key so the flag survives a reload', () => {
    completeTutorial();
    expect(localStorage.getItem(TUTORIAL_KEY)).toBe('true');
    expect(TUTORIAL_KEY).toBe('deutsch-tutorial-completed');
  });

  it('treats any value other than the written flag as not-done', () => {
    // A half-written or foreign value must not silently suppress the tour.
    localStorage.setItem(TUTORIAL_KEY, 'false');
    expect(isTutorialDone()).toBe(false);
  });

  it('reports not-done rather than throwing when reads are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => isTutorialDone()).not.toThrow();
    expect(isTutorialDone()).toBe(false);
  });

  it('swallows a write failure so a full quota cannot break dismissal', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => completeTutorial()).not.toThrow();
  });
});
