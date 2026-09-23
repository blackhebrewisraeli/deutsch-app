import { sendError } from './respond.js';
import { createAccountHandler } from './accountHandler.js';

// The social lane: find a person, follow them, unfollow them.
//
// Every operation here runs through createAccountHandler, so it inherits the
// same guard chain as the account lane — method, origin, IP rate, auth,
// identity rate, blocked check — rather than hand-rolling a second one.
//
// WHY THIS IS A SERVER LANE AT ALL
// --------------------------------
// Neither table is reachable from a browser. `profiles` carries exactly one
// RLS policy, "select own profile", so a client cannot read anyone else's row;
// `profile_follows` has every grant revoked from anon and authenticated plus a
// deny-all policy (20260921210000). Search and follow therefore cannot be
// PostgREST calls from the client — they are service-role reads and writes
// behind an authenticated endpoint, which is also the only place the result
// can be trimmed to public fields.

/**
 * Public identity, and nothing else.
 *
 * These are the same fields the league passport already publishes for someone
 * you share a league with: what to call a person, and what they look like.
 * Search stops there on purpose. XP, streak, league standing, badges and the
 * follow graph itself stay behind the passport's `shares_league` gate in
 * api/v1/league/profile.js — being findable is not the same permission as
 * being readable.
 */
export const SEARCH_COLUMNS = 'user_id, handle, display_name, avatar_path';

/** Two characters. One would return a large slice of the table per keystroke. */
export const MIN_QUERY_LEN = 2;

/** The handle column's own write-path cap (accountEndpoints MAX_LEN.handle). */
export const MAX_QUERY_LEN = 24;

/** One screenful of people. Also the ceiling on what one query can enumerate. */
export const SEARCH_LIMIT = 20;

/** A page of a follow list — smaller than SEARCH_LIMIT because a row here
 * carries a Follow/Unfollow button, not just a search hit, and the caller can
 * always ask for the next page. */
export const LIST_LIMIT = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST errors on a malformed uuid (22P02); that is a 400, not a 500. */
export function isUserId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Reduce a raw search box to something that cannot escape a PostgREST filter.
 *
 * `.or()` takes a DSL STRING — `handle.ilike.%sam%,display_name.ilike.%sam%`.
 * A comma, a dot or a parenthesis in the typed term therefore does not search
 * FOR those characters, it adds or closes a FILTER: `sam,user_id.eq.<uuid>`
 * would be a second condition rather than a query.
 *
 * So this is an allowlist, not an escape. Letters of any script survive
 * (display names are not latin-only), along with digits, space, underscore and
 * hyphen; every separator the DSL relies on is replaced. Nothing structural
 * can then reach the filter string.
 *
 * Replaced with a SPACE rather than deleted: dropping the comma in "a,b" would
 * splice two unrelated terms into "ab" and match something the learner never
 * typed. A space just fails to match, which is the honest outcome.
 *
 * A leading "@" disappears through the same rule, which is what makes the
 * obvious thing to type — "@sam" — search for "sam".
 *
 * `_` is KEPT, because every auto-assigned handle contains one
 * (`learner_ab12…`). It is also a LIKE single-character wildcard, so
 * `learner_` matches `learnerX` too. That slightly wider match is accepted
 * deliberately: escaping it means putting a backslash into a DSL string whose
 * own quoting rules are a second hazard, and a search box over-matching is not
 * a correctness problem the way a broken filter would be.
 */
export function sanitizeQuery(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LEN);
}

/** POST carries the target in the body; DELETE has no body, so it uses a query. */
function targetId(req) {
  const fromBody = req.body && typeof req.body === 'object' ? req.body.userId : undefined;
  return fromBody ?? req.query?.userId;
}

export const searchHandler = createAccountHandler({
  method: 'GET',
  // Typed input. The client debounces, so a real session sends far fewer than
  // this; the limit is here for the client that does not.
  ipRate: { windowMs: 60 * 1000, max: 60 },
  userRate: { windowMs: 60 * 1000, max: 40 },
  name: 'social.search',
  failureMessage: 'Search failed.',
  run: async ({ req, res, auth, db }) => {
    const query = sanitizeQuery(req.query?.q);

    // Too short is an EMPTY RESULT, not an error. The search box calls this on
    // the way down to an empty string as the learner deletes what they typed,
    // and a 400 there would paint an error over an ordinary edit.
    if (query.length < MIN_QUERY_LEN) {
      return res.status(200).json({ query, results: [] });
    }

    const pattern = `%${query}%`;
    const { data, error } = await db
      .from('profiles')
      .select(SEARCH_COLUMNS)
      .or(`handle.ilike.${pattern},display_name.ilike.${pattern}`)
      .is('blocked_at', null)
      .neq('user_id', auth.userId)
      .order('handle', { ascending: true })
      .limit(SEARCH_LIMIT);
    if (error) throw error;

    const rows = data ?? [];

    // Which of these the caller already follows — ONE query for the whole page
    // rather than one per row. Only the caller's OWN edges are read: this asks
    // "who do I follow", never "who follows them", so the graph stays private
    // exactly as the passport's counts-only rule intends.
    const ids = rows.map((row) => row.user_id);
    let following = new Set();
    if (ids.length > 0) {
      const { data: edges, error: edgeError } = await db
        .from('profile_follows')
        .select('followed_id')
        .eq('follower_id', auth.userId)
        .in('followed_id', ids);
      if (edgeError) throw edgeError;
      following = new Set((edges ?? []).map((edge) => edge.followed_id));
    }

    return res.status(200).json({
      query,
      results: rows.map((row) => ({
        user_id: row.user_id,
        handle: row.handle,
        display_name: row.display_name,
        avatar_path: row.avatar_path,
        is_following: following.has(row.user_id),
      })),
    });
  },
});

export const followHandler = createAccountHandler({
  method: 'POST',
  ipRate: { windowMs: 60 * 60 * 1000, max: 300 },
  userRate: { windowMs: 60 * 60 * 1000, max: 120 },
  name: 'social.follow',
  failureMessage: 'Could not follow.',
  run: async ({ req, res, auth, db }) => {
    const target = targetId(req);
    if (!isUserId(target)) return sendError(res, 'bad_request', 'Missing userId.');
    // The table's own check constraint refuses this too. Catching it here is
    // what turns a 500 into a sentence.
    if (target === auth.userId) {
      return sendError(res, 'bad_request', 'You cannot follow yourself.');
    }

    // A follow names a row in another table, so the target has to be real —
    // and a blocked account is not followable, for the same reason it cannot
    // use the account lane.
    const { data: profile, error: lookupError } = await db
      .from('profiles')
      .select('user_id, blocked_at')
      .eq('user_id', target)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!profile || profile.blocked_at) {
      return sendError(res, 'bad_request', 'No such account.');
    }

    const { error } = await db
      .from('profile_follows')
      .insert({ follower_id: auth.userId, followed_id: target });

    // 23505 is "already following", and following twice is the same STATE as
    // following once — so the request succeeded. Reporting a failure here
    // would make an optimistic button roll itself back to the wrong value on
    // the one input a double-tap reliably produces.
    if (error && error.code !== '23505') throw error;

    return res.status(200).json({ user_id: target, is_following: true });
  },
});

export const unfollowHandler = createAccountHandler({
  method: 'DELETE',
  ipRate: { windowMs: 60 * 60 * 1000, max: 300 },
  userRate: { windowMs: 60 * 60 * 1000, max: 120 },
  name: 'social.unfollow',
  failureMessage: 'Could not unfollow.',
  run: async ({ req, res, auth, db }) => {
    const target = targetId(req);
    if (!isUserId(target)) return sendError(res, 'bad_request', 'Missing userId.');

    // No existence check and no self check: deleting an edge that is not there
    // is a no-op that leaves exactly the state the caller asked for. Unfollow
    // is idempotent for the same reason follow is.
    const { error } = await db
      .from('profile_follows')
      .delete()
      .eq('follower_id', auth.userId)
      .eq('followed_id', target);
    if (error) throw error;

    return res.status(200).json({ user_id: target, is_following: false });
  },
});

/**
 * Followers or following, for the CALLER only.
 *
 * `api/v1/league/profile.js` deliberately ships counts only, never the edges —
 * shipping the LIST there would publish who follows whom for everyone in a
 * shared league. That reasoning does not apply here: this endpoint only ever
 * answers "who follows me" / "who do I follow", the same self-only shape
 * `fetchMyProfile` already uses elsewhere, so there is no third party's graph
 * to protect.
 */
export const listHandler = createAccountHandler({
  method: 'GET',
  ipRate: { windowMs: 60 * 1000, max: 60 },
  userRate: { windowMs: 60 * 1000, max: 40 },
  name: 'social.list',
  failureMessage: 'Could not load that list.',
  run: async ({ req, res, auth, db }) => {
    const list = req.query?.list;
    if (list !== 'followers' && list !== 'following') {
      return sendError(res, 'bad_request', 'Invalid list.');
    }
    const offset = Math.max(0, Number.parseInt(req.query?.offset, 10) || 0);

    // followers = people whose edge POINTS AT me (followed_id = me); the other
    // side of that edge (follower_id) is who to show. following is the mirror.
    const anchorColumn = list === 'followers' ? 'followed_id' : 'follower_id';
    const otherColumn = list === 'followers' ? 'follower_id' : 'followed_id';

    const { data: edges, error: edgeError } = await db
      .from('profile_follows')
      .select(otherColumn)
      .eq(anchorColumn, auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + LIST_LIMIT - 1);
    if (edgeError) throw edgeError;

    const rows = edges ?? [];
    const orderedIds = rows.map((row) => row[otherColumn]);
    if (orderedIds.length === 0) {
      return res.status(200).json({ list, results: [], hasMore: false });
    }

    const { data: profiles, error: profileError } = await db
      .from('profiles')
      .select(SEARCH_COLUMNS)
      .in('user_id', orderedIds)
      .is('blocked_at', null);
    if (profileError) throw profileError;

    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    // On the followers list, "do I follow them back" is a genuine unknown and
    // needs its own query — the edge that put them on THIS list points the
    // other way. On the following list every row is, by construction, someone
    // the caller follows, so it needs no second query at all.
    let followingBack = new Set();
    if (list === 'followers') {
      const { data: mine, error: mineError } = await db
        .from('profile_follows')
        .select('followed_id')
        .eq('follower_id', auth.userId)
        .in('followed_id', orderedIds);
      if (mineError) throw mineError;
      followingBack = new Set((mine ?? []).map((edge) => edge.followed_id));
    }

    const results = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((profile) => ({
        user_id: profile.user_id,
        handle: profile.handle,
        display_name: profile.display_name,
        avatar_path: profile.avatar_path,
        is_following: list === 'following' ? true : followingBack.has(profile.user_id),
      }));

    return res.status(200).json({ list, results, hasMore: rows.length === LIST_LIMIT });
  },
});
