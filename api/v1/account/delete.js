import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';

// How recently the caller must have actually authenticated. Not how old their
// token is — see api/_lib/authTime.js for why those differ.
//
// In practice almost every deletion will hit the re-auth prompt, because amr
// only advances on a real sign-in and sessions here survive for weeks on
// refresh tokens. So this is less "was your session fresh?" and more "you have
// this long, after proving who you are, to finish confirming" — 15 minutes is
// forgiving for someone interrupted mid-flow while barely widening the one
// exposure it leaves: a device grabbed within 15 minutes of a real sign-in.
export const REAUTH_MAX_AGE_SEC = 15 * 60;

// Typed rather than clicked. The two-step button it replaces guarded against a
// mis-click; it never established intent.
export const CONFIRM_PHRASE = 'DELETE';

// Vercel normally parses a JSON body, but a DELETE body is unusual enough in
// proxies and test harnesses that it can arrive as a raw string. Accept both
// rather than reading `undefined.confirm` off an unparsed payload.
function readConfirm(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)?.confirm;
    } catch {
      return undefined;
    }
  }
  return body?.confirm;
}

// Permanent account deletion.
//
// This endpoint deletes the auth user and NOTHING ELSE, on purpose.
//
// Every user-owned table declares `references auth.users(id) on delete cascade`
// — profiles, srs_state, stats_daily, decks, settings, league_members (see
// supabase/migrations/20260611232000_user_tables.sql and ..._leagues.sql). So
// removing the auth row already removes every row the user owns, in ONE
// server-side transaction that cannot half-apply.
//
// It used to delete srs_state, stats_daily and settings explicitly first, and
// only then call deleteUser. That was not merely redundant — it manufactured the
// exact failure B3's design forbade ("no silent half-deletes"): if the loop
// succeeded and deleteUser then failed, the user's learning data was destroyed
// while their account stayed live and signable-into. The loop also omitted
// `decks`, which was harmless precisely because the cascade — not the loop — is
// what makes the deletion complete.
//
// The invariant is enforced in two places: delete.test.js asserts this handler
// issues exactly one delete call and touches no table directly, and the RLS
// suite (npm run test:rls) asserts zero surviving rows across all six tables
// after a real deletion. If a future table is added without `on delete cascade`,
// the RLS suite is what fails.
export default createAccountHandler({
  method: 'DELETE',
  // Deleting is a once-ever action; the only legitimate repeat is a retry after
  // a transient failure.
  ipRate: { windowMs: 60 * 60 * 1000, max: 10 },
  userRate: { windowMs: 60 * 60 * 1000, max: 5 },
  name: 'account.delete',
  failureMessage: 'Failed to delete account.',
  recentAuthMaxAgeSec: REAUTH_MAX_AGE_SEC,
  run: async ({ req, res, auth, db }) => {
    if (readConfirm(req.body) !== CONFIRM_PHRASE) {
      return sendError(res, 'bad_request', `Type ${CONFIRM_PHRASE} to confirm.`);
    }

    const { error } = await db.auth.admin.deleteUser(auth.userId);
    if (error) throw error;
    return res.status(204).end();
  },
});
