/**
 * Should the app open the placement test by itself?
 *
 * Placement is for a FIRST-TIME learner — someone with no classified CEFR code
 * anywhere. It is not a login wall, and it is not something a returning learner
 * should ever meet again unless they ask for it (Settings / StatusChip retake,
 * or the 3-deck Home invite, both of which bypass this predicate entirely).
 *
 * THE BUG THIS EXISTS FOR. `deutsch-level` lives in localStorage, but a
 * signed-in account's level also lives in `settings.data.level` on the server
 * and arrives via the first sync reconcile — which is async and lands AFTER the
 * first paint. Deciding from localStorage alone at mount meant a returning
 * learner on a fresh browser (cleared storage, surviving auth session, or a
 * second device) was pushed into "Find your level" while their real CEFR code
 * was sitting on the server, about to be pulled down. Production confirmed it:
 * the account that hit this had `level: "b1"` stored server-side the whole time.
 *
 * So the rule is: never decide "this learner has no level" until the place the
 * level could still be coming from has actually answered.
 *
 * Deliberately pure — no storage, no React, no network. The caller reads
 * `hasStoredLevel()`, the auth status and the sync status and passes them in,
 * which is what makes every branch below testable without a DOM.
 */

/**
 * @param {object} args
 * @param {boolean} args.hasLevel      a valid (or legacy-resolvable) stored CEFR code
 * @param {'loading'|'anonymous'|'authenticated'|string|null|undefined} args.authStatus
 * @param {boolean} [args.syncEnabled] VITE_SYNC_ENABLED — is there a server to wait for?
 * @param {boolean} [args.syncSettled] has the first reconcile of this session finished?
 * @returns {boolean}
 */
export function shouldOpenPlacement({
  hasLevel,
  authStatus,
  syncEnabled = false,
  syncSettled = false,
} = {}) {
  // A returning learner. The single most important branch here: whatever else
  // is true, a stored level means the gate stays shut.
  if (hasLevel) return false;

  // Auth has not resolved yet. `anonymous` and `authenticated` lead to
  // different answers below, so answering now is answering at random — and the
  // wrong answer is a full-screen takeover.
  if (authStatus === 'loading') return false;

  // Signed in, sync is on, and the first reconcile has not landed. The level
  // may be one round trip away; asking them to re-classify would also overwrite
  // it, because placement writes a NEW levelUpdatedAt that wins the LWW merge.
  if (authStatus === 'authenticated' && syncEnabled && !syncSettled) return false;

  // Genuinely nothing to seed from: a guest continuing without an account, or a
  // signed-in account whose server settings came back with no level. This is
  // the first-time learner the test is for.
  return true;
}
