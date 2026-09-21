import { getAccessToken, getSupabase, refreshAccessToken } from './auth.js';

// The learner's own profile row: league handle, uploaded avatar path, join
// date.
//
// Reads go straight to PostgREST — it is an own-row select and the existing
// "select own profile" RLS policy already permits exactly that, so no endpoint
// is needed. Writes do NOT: handle is UNIQUE and is denormalised onto
// league_members, and both of those need the server, so they go through
// PATCH /api/v1/account/profile.

// display_name leads: it is what the profile header and the account sheet
// render, falling back to @handle and then the anonymous label. Social Profile
// v1 §7.
export const PROFILE_COLUMNS = 'display_name, handle, avatar_path, created_at';

/**
 * @returns the caller's profile row, or null when there is no backend, no
 * session, or no row yet. Never throws for an absent profile — Home renders a
 * greeting either way, and a missing row must not take the landing tab down.
 */
export async function fetchMyProfile(userId) {
  if (!userId) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Patch the profile. Resolves with the STORED row — the server is the source of
 * truth here, because a handle can be rejected as already taken, so an
 * optimistic local value must never be treated as accepted.
 *
 * @throws {Error} with the server's human message (e.g. "That handle is taken.")
 */
/**
 * The anonymous label. PassportBody used to spell this inline, as the only
 * place that needed it; the profile header and the account sheet need the same
 * word, and three copies of a fallback is how two of them drift.
 */
export const ANONYMOUS_NAME = 'Anonym';

/**
 * What to call this person: display name, else handle, else anonymous.
 *
 * Social Profile v1 §7. Takes any row carrying `display_name` / `handle` —
 * the own-profile row and the public profile row both do — so the passport
 * body, the profile header and the account sheet cannot disagree.
 *
 * Whitespace counts as absent. The write path trims to null, but a row that
 * predates that guard can still hold "   ", and a header rendering blank
 * reads as a bug rather than as a missing name.
 */
export function profileName(profile) {
  const display = typeof profile?.display_name === 'string' ? profile.display_name.trim() : '';
  if (display) return display;
  const handle = typeof profile?.handle === 'string' ? profile.handle.trim() : '';
  if (handle) return handle;
  return ANONYMOUS_NAME;
}

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again and retry.';

const send = (token, patch) =>
  fetch('/api/v1/account/profile', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

export async function updateProfile(patch) {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in again.');

  let res = await send(token, patch);

  // 401 means the token did not survive `auth.getUser()` on the server. The
  // token in local storage can be perfectly well-formed and still fail that
  // check, because GoTrue also requires the session behind it to exist — and a
  // sign-out anywhere else revokes it globally. Storage and PostgREST only
  // check the signature, which is why an avatar's BYTES upload fine and then
  // the row pointing at them cannot be saved.
  //
  // One refresh, one retry. Not a loop: if a fresh token is also rejected the
  // session is genuinely gone, and retrying just spends the learner's time
  // before telling them the same thing.
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (!fresh) throw new Error(SESSION_EXPIRED_MESSAGE);
    res = await send(fresh, patch);
    if (res.status === 401) throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (!res.ok) {
    // Surface the server's wording rather than a generic failure: "That handle
    // is taken" is the difference between a fixable and a baffling error.
    const message = await res
      .json()
      .then((b) => b?.error?.message)
      .catch(() => null);
    throw new Error(message ?? 'Could not save your profile.');
  }
  return res.json();
}
