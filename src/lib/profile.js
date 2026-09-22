import { getSupabase } from './auth.js';
import { authedFetch, errorMessage, SESSION_EXPIRED_MESSAGE } from './authedFetch.js';

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

// Re-exported so the one name for an expired session has one definition.
// authedFetch owns the refresh-once rule; this module owns the profile verbs.
export { SESSION_EXPIRED_MESSAGE };

/**
 * Patch the profile. Resolves with the STORED row — the server is the source of
 * truth here, because a handle can be rejected as already taken, so an
 * optimistic local value must never be treated as accepted.
 *
 * @throws {Error} with the server's human message (e.g. "That handle is taken.")
 */
export async function updateProfile(patch) {
  const res = await authedFetch('/api/v1/account/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Could not save your profile.'));
  }
  return res.json();
}
