/**
 * First-run walkthrough dismissal flag.
 *
 * Deliberately NOT part of the synced `deutsch-app-state-v1` blob and NOT
 * carried by sync.js's settings payload: "I have seen the tour" is a property
 * of a browser, not of an account. Syncing it would mean a learner who signs
 * in on a second device never gets oriented on that device's chrome — which is
 * the one place the tour is still useful.
 *
 * Storage is best-effort in both directions. A blocked read (Safari private
 * mode, a locked-down embed) must report "not done" rather than throw, and a
 * blocked write must not stop the overlay from closing — a tour you cannot
 * dismiss because the disk is full is strictly worse than one shown twice.
 */
export const TUTORIAL_KEY = 'deutsch-tutorial-completed';

/** The one value that counts as dismissed. Anything else re-shows the tour. */
const DONE = 'true';

/** @returns {boolean} true only when this browser has dismissed the tour. */
export function isTutorialDone() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === DONE;
  } catch {
    return false;
  }
}

/** Mark the tour dismissed. Every exit path calls this — Skip, Got it, Escape. */
export function completeTutorial() {
  try {
    localStorage.setItem(TUTORIAL_KEY, DONE);
  } catch {
    // Best-effort: see the module note.
  }
}
