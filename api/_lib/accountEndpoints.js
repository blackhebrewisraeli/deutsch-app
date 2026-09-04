import { createAccountHandler } from './accountHandler.js';
import { sendError } from './respond.js';
export { REAUTH_MAX_AGE_SEC } from './authTime.js';
import { REAUTH_MAX_AGE_SEC } from './authTime.js';

// profileHandler, exportHandler and deleteHandler live in one file — not three
// api/v1/account/*.js files — because Vercel's Hobby plan caps a deployment at
// 12 Serverless Functions and this project was over. api/v1/account.js
// dispatches on req.method between the three (PATCH/GET/DELETE are distinct
// methods, so no action parameter is needed); see that file for the
// dispatcher and vercel.json for the rewrites that keep the documented
// /profile, /export and /delete URLs working.

// ---------------------------------------------------------------------------
// profile — PATCH
// ---------------------------------------------------------------------------
//
// Profile editing for the Settings page.
//
// Generalises api/v1/league/handle.js rather than sitting beside it. That
// endpoint already solved the two hard parts — mapping Postgres 23505 to a
// human "handle is taken", and re-syncing the handle DENORMALISED onto
// league_members so a rename actually reaches the standings. A second
// profile-patching endpoint that forgot the denormalisation is the predictable
// regression, so there is one writer and league/handle delegates to it.
//
// Client-direct writes are technically permitted (RLS grants `update own
// profile` to authenticated), but handle uniqueness and the denormalisation
// both need the server, so every profile write goes through here.
//
// Deliberately NOT re-auth gated: renaming yourself is not destructive, and
// gating it would make an ordinary edit demand a fresh sign-in. Changing the
// account's EMAIL is a different matter and is gated — see EmailSection.
//
// display_name was dropped from EDITABLE_FIELDS: it was writable here and
// populated on no account. The column remains, so an old client that still
// sends the field simply has it ignored by the allowlist rather than erroring.

/** Only these columns are writable. Anything else in the body is ignored. */
export const EDITABLE_FIELDS = ['handle', 'avatar_emoji', 'avatar_path'];

const MAX_LEN = { handle: 24, avatar_emoji: 8, avatar_path: 200 };

/**
 * `avatar_path` is the one editable field that names something OUTSIDE this
 * row, so it needs a check the others do not.
 *
 * Storage RLS stops a learner writing an object into someone else's folder, but
 * this column is ordinary text: nothing in the database stops them SAYING their
 * avatar lives at another user's path and wearing that person's picture. The
 * path must therefore start with their own id — the same first-segment rule the
 * bucket policies enforce, applied to the pointer rather than the object.
 *
 * Clearing it (null) is always allowed: that is "remove my avatar".
 */
export function ownsAvatarPath(path, userId) {
  if (path === null || path === undefined) return true;
  if (typeof path !== 'string') return false;
  return path.startsWith(`${userId}/`) && !path.includes('..');
}

export function buildPatch(body) {
  const source = typeof body === 'string' ? safeParse(body) : body;
  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    const value = source?.[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    // An empty string clears the field rather than storing "", so a learner can
    // remove a display name they no longer want.
    patch[field] = trimmed === '' ? null : trimmed;
  }
  return patch;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tooLong(patch) {
  return EDITABLE_FIELDS.find((f) => typeof patch[f] === 'string' && patch[f].length > MAX_LEN[f]);
}

export const profileHandler = createAccountHandler({
  method: 'PATCH',
  ipRate: { windowMs: 60 * 60 * 1000, max: 60 },
  userRate: { windowMs: 60 * 60 * 1000, max: 30 },
  name: 'account.profile',
  failureMessage: 'Failed to update profile.',
  run: async ({ req, res, auth, db }) => {
    const patch = buildPatch(req.body);
    if (Object.keys(patch).length === 0) {
      return sendError(res, 'bad_request', 'Nothing to update.');
    }
    const over = tooLong(patch);
    if (over) {
      return sendError(res, 'bad_request', `That ${over.replace('_', ' ')} is too long.`);
    }
    if ('avatar_path' in patch && !ownsAvatarPath(patch.avatar_path, auth.userId)) {
      return sendError(res, 'bad_request', 'That avatar path is not yours.');
    }

    const { error } = await db.from('profiles').update(patch).eq('user_id', auth.userId);
    if (error) {
      if (error.code === '23505') return sendError(res, 'bad_request', 'That handle is taken.');
      throw error;
    }

    // handle is denormalised onto league_members, which is what the leaderboard
    // renders. Without this a rename never reaches the standings.
    if (typeof patch.handle === 'string') {
      await db.from('league_members').update({ handle: patch.handle }).eq('user_id', auth.userId);
    }

    // The server is the source of truth here — the client must not assume its
    // optimistic value survived, because a handle can be rejected as taken.
    const { data } = await db
      .from('profiles')
      .select('handle, avatar_emoji, avatar_path, created_at')
      .eq('user_id', auth.userId)
      .maybeSingle();

    return res.status(200).json(data ?? patch);
  },
});

// ---------------------------------------------------------------------------
// export — GET
// ---------------------------------------------------------------------------
//
// Full data export. Shares the account lane's guards with delete: this endpoint
// returns the caller's entire dataset in one response, so an unlimited version
// is a bulk-read primitive for anyone holding a token.
//
// Deliberately NOT re-auth gated (§11 Q3, resolved 2026-08-30): export is
// non-destructive, the data is the caller's own, and the lane's rate limits
// already bound bulk pulls.

/**
 * Which user-owned tables the payload covers, and what each is called in it.
 *
 * Declared rather than inlined so export.test.js can assert this set against
 * the full list of user-owned tables. Before that guard existed, `decks` was
 * missing for two months: the cascade deleted it on account deletion while the
 * export quietly left it out, so "export my data" returned less than the
 * account actually held and nothing failed.
 */
export const EXPORTED_TABLES = {
  srs_state: 'srs',
  stats_daily: 'daily',
  decks: 'decks',
  settings: 'settings',
};

/**
 * User-owned tables kept OUT of the payload, each for a stated reason. A table
 * appears here or in EXPORTED_TABLES — never in neither, which is how `decks`
 * went missing.
 */
export const EXCLUDED_TABLES = {
  // Identity the learner already sees and edits in Settings. Including it is
  // defensible and cheap; it is a payload-shape decision rather than a bug fix,
  // so it stays out until asked for.
  profiles: 'editable in Settings; pending a payload-shape decision',
  // Shared competition scaffolding rather than private learning data, and the
  // standings are already visible in the app.
  league_members: 'public competition data; pending a payload-shape decision',
  // Opaque idempotency tokens. The counters they protect already export as daily.
  progress_events_seen: 'idempotency keys for the progress RPC; counters already export as daily',
};

// `settings` is one row per user; everything else is a collection. Keeping the
// singular shape avoids changing what existing consumers already parse.
const SINGLE_ROW = new Set(['settings']);

export const exportHandler = createAccountHandler({
  method: 'GET',
  ipRate: { windowMs: 60 * 60 * 1000, max: 20 },
  userRate: { windowMs: 60 * 60 * 1000, max: 10 },
  name: 'account.export',
  failureMessage: 'Failed to export data.',
  run: async ({ res, auth, db }) => {
    const tables = Object.keys(EXPORTED_TABLES);

    const results = await Promise.all(
      tables.map((table) => db.from(table).select('*').eq('user_id', auth.userId))
    );

    const data = {};
    results.forEach((result, index) => {
      if (result.error) throw result.error;
      const table = tables[index];
      const key = EXPORTED_TABLES[table];
      data[key] = SINGLE_ROW.has(table) ? (result.data?.[0] ?? null) : (result.data ?? []);
    });

    res.setHeader('Content-Disposition', 'attachment; filename="sprachschule-export.json"');
    return res.status(200).json({
      email: auth.email,
      exportedAt: new Date().toISOString(),
      data,
    });
  },
});

// ---------------------------------------------------------------------------
// delete — DELETE
// ---------------------------------------------------------------------------
//
// How recently the caller must have actually authenticated. Not how old their
// token is — see src/lib/authClaims.js for why those differ, and for the
// reasoning behind the 15 minutes.
//
// Re-exported rather than redefined: the email-change flow gates on the SAME
// window, and two copies of a security constant is one of them going stale.
// In practice almost every deletion hits the re-auth prompt, because amr only
// advances on a real sign-in and sessions here survive for weeks on refresh
// tokens.

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
/**
 * Delete everything under `avatars/<userId>/`. Best-effort; never throws.
 *
 * Listed rather than derived from profiles.avatar_path: the column names only
 * the CURRENT avatar, and a learner who changed theirs several times may have
 * left orphans behind when a `removeAvatar` call failed. The folder is the
 * complete answer; the column is not.
 */
export async function removeAvatarObjects(db, userId) {
  try {
    const { data, error } = await db.storage.from('avatars').list(userId);
    if (error || !data?.length) return 0;
    const paths = data.map((o) => `${userId}/${o.name}`);
    const { error: rmErr } = await db.storage.from('avatars').remove(paths);
    return rmErr ? 0 : paths.length;
  } catch {
    return 0;
  }
}

export const deleteHandler = createAccountHandler({
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

    // STORAGE IS NOT IN THE CASCADE. Every user-owned TABLE goes when the auth
    // row goes, but storage.objects is not in that foreign-key graph, so a
    // deleted account's avatar would stay in a PUBLIC bucket indefinitely —
    // still fetchable by anyone holding the URL, long after the person asked to
    // be forgotten. Nothing else in this handler would notice.
    //
    // Done BEFORE deleteUser, because afterwards there is no row left to tell
    // us which objects were theirs. Failures are swallowed on purpose: an
    // orphaned image must never block the deletion the person actually asked
    // for, and a half-delete is the one outcome this endpoint's design forbids.
    await removeAvatarObjects(db, auth.userId);

    const { error } = await db.auth.admin.deleteUser(auth.userId);
    if (error) throw error;
    return res.status(204).end();
  },
});
