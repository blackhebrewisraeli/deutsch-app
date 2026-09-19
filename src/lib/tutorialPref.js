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

/**
 * Fired on `window` when the learner asks to see the tour again from Settings.
 * The overlay reads its flag once, on mount, and it is mounted for the whole
 * session — so without an announcement "Show tutorial" would do nothing until
 * the next reload.
 */
export const TUTORIAL_REPLAY_EVENT = 'deutsch-tutorial-replay';

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

/**
 * Mark the tour seen. Called from every exit path — Skip, Got it, Escape — AND
 * from the moment the tour first paints.
 *
 * MARKING ON SHOW, NOT ONLY ON DISMISS, IS THE POINT. The flag answers "has
 * this browser been offered the tour?", and the honest moment to record that is
 * when the offer is made. Recording it only on dismissal meant every exit that
 * is not a click — a reload, a closed tab, a crash, following a link out — left
 * the flag unset, so the tour came back on the next open. That is the
 * "tutorial on every app open" report, and no amount of dismissing fixed it
 * because the learner had not dismissed it; they had navigated away from it.
 *
 * The cost of being wrong in this direction is one skipped tour. The cost of
 * the other direction is a modal in front of the app, forever.
 */
export function completeTutorial() {
  try {
    localStorage.setItem(TUTORIAL_KEY, DONE);
  } catch {
    // Best-effort: see the module note.
  }
}

/**
 * Clear the flag and ask any mounted overlay to reopen. The discreet way back
 * in — Settings → "Show tutorial" — so that marking the tour seen on first
 * paint does not make it unreachable for someone who wanted it.
 */
export function replayTutorial() {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    // Best-effort; the event below still reopens this session's overlay.
  }
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(TUTORIAL_REPLAY_EVENT));
  } catch {
    // no CustomEvent — nothing to announce to
  }
}
