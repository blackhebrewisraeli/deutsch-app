import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';

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

/** Only these two columns are writable. Anything else in the body is ignored. */
export const EDITABLE_FIELDS = ['handle', 'avatar_emoji'];

const MAX_LEN = { handle: 24, avatar_emoji: 8 };

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

export default createAccountHandler({
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
      .select('handle, avatar_emoji, created_at')
      .eq('user_id', auth.userId)
      .maybeSingle();

    return res.status(200).json(data ?? patch);
  },
});
