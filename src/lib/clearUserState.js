// Sign-out must not leave the previous account's progress in this browser.
// Theme is a per-device preference (themeMode.js), not account data, so it
// survives. Everything else in localStorage is user-specific: the state blob,
// CEFR level, sync baseline, tutorial/welcome flags, leftover auth tokens.
//
// Sequence is load-bearing:
//   1. await supabase signOut — the session has to die first. Wiping storage
//      while still authenticated would let sync push an empty blob to the
//      account. Reloading before signOut resolves would leave the session.
//   2. clearUserLocalState — so the next hydrate cannot restore XP / SRS.
//   3. hard navigation — React memory (stats, learnedWords, level, the
//      gateDismissed latch) has no other bulletproof reset in this SPA.
import { signOut as authSignOut } from './auth.js';
import { THEME_MODE_KEY } from './themeMode.js';

/**
 * Device chrome that must survive a sign-out. Theme is the recorded
 * exception; do not add account data here.
 */
export const PRESERVED_LOCAL_KEYS = Object.freeze([THEME_MODE_KEY]);

/**
 * Overridable in tests so jsdom does not have to fake window.location.
 * Production always assigns '/' — a full load, not a client-side swap.
 */
export const locationReset = {
  go() {
    window.location.assign('/');
  },
};

/** Wipe every localStorage key except device theme. */
export function clearUserLocalState() {
  try {
    const preserved = {};
    for (const key of PRESERVED_LOCAL_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) preserved[key] = value;
    }
    localStorage.clear();
    for (const [key, value] of Object.entries(preserved)) {
      localStorage.setItem(key, value);
    }
  } catch {
    // private browsing / blocked storage — the hard reload still drops memory
  }
}

/**
 * Revoke the session, wipe user persistence, then hard-reset the SPA.
 * On a signOut error the local account is left intact so sync cannot clobber
 * a still-authenticated user with an empty blob.
 *
 * @param {{ signOut?: () => Promise<{ error?: unknown }>, reload?: () => void }} [opts]
 * @returns {Promise<{ error: unknown }>}
 */
export async function signOutAndReset(opts = {}) {
  const signOutFn = opts.signOut ?? authSignOut;
  const { error } = await signOutFn();
  if (error) return { error };
  clearUserLocalState();
  if (opts.reload) opts.reload();
  else locationReset.go();
  return { error: null };
}
