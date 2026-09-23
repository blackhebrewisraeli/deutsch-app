import { authedFetch, errorMessage } from './authedFetch.js';

// The client half of the social lane (api/v1/social.js).
//
// Every call is authenticated: neither `profiles` nor `profile_follows` is
// readable from the browser, so there is no PostgREST shortcut here the way
// fetchMyProfile has one for the caller's own row.

const ENDPOINT = '/api/v1/social';

/** The server applies this too; matching it here saves a round trip per keystroke. */
export const MIN_QUERY_LEN = 2;

/**
 * Trim a typed term the way the endpoint will, to decide whether it is worth
 * sending at all.
 *
 * This is a LENGTH check, not the security boundary — the server's
 * sanitizeQuery is, and it runs regardless of what this returns. Mirroring the
 * minimum here only stops the obvious wasted request while someone is still
 * typing the first letter.
 */
export function isSearchable(term) {
  return typeof term === 'string' && term.trim().length >= MIN_QUERY_LEN;
}

/**
 * People whose handle or display name matches `term`.
 *
 * @returns {Promise<Array<{user_id, handle, display_name, avatar_path, is_following}>>}
 *   Empty for a term too short to search — the endpoint answers 200 with no
 *   results rather than an error, so the box can be emptied without painting
 *   a failure over an ordinary edit.
 */
export async function searchUsers(term, { signal } = {}) {
  const res = await authedFetch(`${ENDPOINT}?q=${encodeURIComponent(term ?? '')}`, {
    method: 'GET',
    signal,
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not search right now.'));
  const body = await res.json();
  return Array.isArray(body?.results) ? body.results : [];
}

/**
 * Follow someone. Idempotent: following twice is the same state as following
 * once, and the server reports the second call as success for exactly the
 * double-tap an optimistic button produces.
 */
export async function followUser(userId) {
  const res = await authedFetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not follow.'));
  return res.json();
}

/** Unfollow someone. Idempotent for the same reason follow is. */
export async function unfollowUser(userId) {
  const res = await authedFetch(`${ENDPOINT}?userId=${encodeURIComponent(userId ?? '')}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not unfollow.'));
  return res.json();
}

/** One page of the caller's own followers or following list. */
export async function listFollows(kind, { offset = 0, signal } = {}) {
  const res = await authedFetch(`${ENDPOINT}?list=${kind}&offset=${offset}`, {
    method: 'GET',
    signal,
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load that list.'));
  const body = await res.json();
  return {
    results: Array.isArray(body?.results) ? body.results : [],
    hasMore: Boolean(body?.hasMore),
  };
}
