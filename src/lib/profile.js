import { getAccessToken, getSupabase } from './auth.js';

// The learner's own profile row: league handle, avatar (emoji + uploaded
// path), join date.
//
// Reads go straight to PostgREST — it is an own-row select and the existing
// "select own profile" RLS policy already permits exactly that, so no endpoint
// is needed. Writes do NOT: handle is UNIQUE and is denormalised onto
// league_members, and both of those need the server, so they go through
// PATCH /api/v1/account/profile.

export const PROFILE_COLUMNS = 'handle, avatar_emoji, avatar_path, created_at';

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
export async function updateProfile(patch) {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in again.');

  const res = await fetch('/api/v1/account/profile', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

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
