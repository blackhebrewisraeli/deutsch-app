// When did this person last actually prove who they are?
//
// A destructive endpoint wants "authenticated recently", not "holding a valid
// token". Those are different questions, and only one claim answers the first.
//
// `iat` does NOT: it is reissued on every access-token refresh. Verified
// against a real Supabase — sign in, refresh two seconds later, and iat moves
// while session_id stays the same. supabase-js refreshes in the background for
// the life of the refresh token, so a session stolen weeks ago presents a token
// whose iat is minutes old. A gate keyed on iat would wave it straight through.
//
// `amr` (Authentication Methods References) does: each entry records a method
// and the second it was performed, and it is copied unchanged across refreshes.
// Signing in again mints a new session with a new amr timestamp, which is what
// lets a re-auth gate be satisfied at all.
//
// amr is optional and may arrive in the RFC-8176 string form (`['otp']`) with
// no timestamps, so "unknown" is a real outcome and callers must fail closed.

/**
 * Seconds-since-epoch of the most recent authentication in the token, or
 * `null` when the token carries no usable authentication time.
 *
 * The token is NOT verified here. Callers must have validated it already
 * (requireAuth does, against the auth server); this only reads claims.
 */
export function latestAuthTime(token) {
  if (typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length < 2) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
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
