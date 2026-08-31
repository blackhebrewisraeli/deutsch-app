// When did this person last actually prove who they are?
//
// This is the ONE implementation. `api/_lib/authTime.js` re-exports it for the
// server re-auth gate, and the client imports it directly to decide whether to
// offer a sensitive control at all. Two copies of a security predicate is two
// things to keep in step, and the one that drifts is the one nobody is looking
// at.
//
// `iat` does NOT answer the question: it is reissued on every access-token
// refresh. Sign in, refresh two seconds later, and iat moves while session_id
// stays the same. supabase-js refreshes in the background for the life of the
// refresh token, so a session stolen weeks ago presents a token whose iat is
// minutes old. A gate keyed on iat would wave it straight through.
//
// `amr` (Authentication Methods References) does: each entry records a method
// and the second it was performed, and it is copied unchanged across refreshes.
// Signing in again mints a new session with a new amr timestamp, which is what
// lets a re-auth gate be satisfied at all.
//
// amr is optional and may arrive in the RFC-8176 string form (`['otp']`) with
// no timestamps, so "unknown" is a real outcome and callers must fail closed.

/**
 * How long after proving who you are a sensitive action stays available.
 *
 * Supabase does not re-issue amr on a token refresh, so this is less "was your
 * session fresh?" and more "you have this long, after proving who you are, to
 * finish confirming" — 15 minutes is forgiving for someone interrupted mid-flow
 * while barely widening the one exposure it leaves: a device grabbed within 15
 * minutes of a real sign-in.
 */
export const REAUTH_MAX_AGE_SEC = 15 * 60;

/**
 * Decode one JWT segment. `atob` and `TextDecoder` are globals in both the
 * browser and Node 18+, which is what lets this file serve both runtimes —
 * `Buffer` would have made it server-only.
 */
function decodeSegment(segment) {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  // atob rejects unpadded input; base64url omits the padding.
  const padded = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Seconds-since-epoch of the most recent authentication in the token, or
 * `null` when the token carries no usable authentication time.
 *
 * The token is NOT verified here. Server callers must have validated it already
 * (requireAuth does, against the auth server); this only reads claims.
 */
export function latestAuthTime(token) {
  if (typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length < 2) return null;

  let claims;
  try {
    claims = JSON.parse(decodeSegment(segments[1]));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object') return null;

  const { amr } = claims;
  if (!Array.isArray(amr) || amr.length === 0) return null;

  // Only the detailed form carries timestamps. Strings mean we know WHICH
  // methods were used but not WHEN — which is not an answer to this question.
  const stamps = amr
    .filter((e) => e && typeof e === 'object' && Number.isFinite(e.timestamp))
    .map((e) => e.timestamp);

  return stamps.length > 0 ? Math.max(...stamps) : null;
}

/**
 * Did this token's holder authenticate within `maxAgeSec`?
 *
 * Fails closed: an unreadable or timestamp-less auth time returns false, so an
 * unexpected token shape asks the person to prove themselves again rather than
 * silently disabling the gate.
 */
export function isRecentAuth(token, maxAgeSec, now = Date.now()) {
  const authedAt = latestAuthTime(token);
  if (authedAt === null) return false;
  // A negative age means the clock skewed, not that the auth is ancient.
  const ageSec = Math.floor(now / 1000) - authedAt;
  return ageSec <= maxAgeSec;
}
