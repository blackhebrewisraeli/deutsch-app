// api/_lib/authTime.test.js
import { describe, it, expect } from 'vitest';
import { latestAuthTime, isRecentAuth } from './authTime.js';

// Build a token shaped like a Supabase access token. Only the payload segment
// is read — the signature is never checked here, because requireAuth has
// already validated the token against the auth server by the time this runs.
function tokenWith(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

const NOW_SEC = 1_787_977_000;
const NOW_MS = NOW_SEC * 1000;

describe('latestAuthTime', () => {
  it('reads the timestamp out of a detailed amr entry', () => {
    const t = tokenWith({ iat: NOW_SEC, amr: [{ method: 'otp', timestamp: NOW_SEC - 60 }] });
    expect(latestAuthTime(t)).toBe(NOW_SEC - 60);
  });

  it('takes the most recent entry when several factors were used', () => {
    const t = tokenWith({
      amr: [
        { method: 'password', timestamp: NOW_SEC - 900 },
        { method: 'mfa/totp', timestamp: NOW_SEC - 30 },
      ],
    });
    expect(latestAuthTime(t)).toBe(NOW_SEC - 30);
  });

  // The whole point of this module. `iat` is reissued on every token refresh
  // (verified against a real Supabase: same session_id, iat moved, amr did
  // not), so a gate keyed on iat would treat an indefinitely-refreshed stolen
  // session as freshly authenticated. amr is the only claim that records when
  // the human actually proved who they were.
  it('never falls back to iat, however fresh iat looks', () => {
    const t = tokenWith({ iat: NOW_SEC, session_id: 's1' }); // no amr at all
    expect(latestAuthTime(t)).toBeNull();
  });

  it('returns null for the RFC-8176 string form, which carries no timestamps', () => {
    const t = tokenWith({ iat: NOW_SEC, amr: ['password', 'otp'] });
    expect(latestAuthTime(t)).toBeNull();
  });

  it.each([
    ['a non-array amr', tokenWith({ amr: { method: 'otp', timestamp: NOW_SEC } })],
    ['an empty amr', tokenWith({ amr: [] })],
    ['a non-numeric timestamp', tokenWith({ amr: [{ method: 'otp', timestamp: 'now' }] })],
    ['a malformed payload segment', 'header.not-base64-json.sig'],
    ['a token with too few segments', 'onlyonesegment'],
    ['an empty string', ''],
    ['null', null],
  ])('returns null for %s', (_label, token) => {
    expect(latestAuthTime(token)).toBeNull();
  });
});

describe('isRecentAuth', () => {
  const fresh = tokenWith({ amr: [{ method: 'otp', timestamp: NOW_SEC - 60 }] });
  const stale = tokenWith({ amr: [{ method: 'otp', timestamp: NOW_SEC - 3600 }] });

  it('accepts an authentication inside the window', () => {
    expect(isRecentAuth(fresh, 900, NOW_MS)).toBe(true);
  });

  it('rejects an authentication older than the window', () => {
    expect(isRecentAuth(stale, 900, NOW_MS)).toBe(false);
  });

  it('accepts exactly at the boundary and rejects one second past it', () => {
    const at = tokenWith({ amr: [{ method: 'otp', timestamp: NOW_SEC - 900 }] });
    const past = tokenWith({ amr: [{ method: 'otp', timestamp: NOW_SEC - 901 }] });
    expect(isRecentAuth(at, 900, NOW_MS)).toBe(true);
    expect(isRecentAuth(past, 900, NOW_MS)).toBe(false);
  });

  // Fail closed: an unreadable auth time on a destructive endpoint must mean
  // "prove it again", never "waved through".
  it('rejects when the auth time cannot be determined', () => {
    expect(isRecentAuth(tokenWith({ iat: NOW_SEC }), 900, NOW_MS)).toBe(false);
    expect(isRecentAuth(null, 900, NOW_MS)).toBe(false);
  });

  // A clock skew that puts auth in the future must not read as "very old".
  it('accepts a timestamp slightly in the future rather than treating it as stale', () => {
    const skewed = tokenWith({ amr: [{ method: 'otp', timestamp: NOW_SEC + 30 }] });
    expect(isRecentAuth(skewed, 900, NOW_MS)).toBe(true);
  });
});
