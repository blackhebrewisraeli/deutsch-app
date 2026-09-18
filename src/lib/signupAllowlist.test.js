import { describe, it, expect } from 'vitest';
import {
  parseSignupAllowlist,
  signupAllowlistActive,
  userAllowedBySignupList,
  typedEmailAllowedForSignup,
  readServerSignupAllowlist,
  readClientSignupAllowlist,
  assertSignupAllowed,
  SIGNUP_NOT_ALLOWED_CODE,
  SIGNUP_NOT_ALLOWED_MESSAGE,
} from './signupAllowlist.js';

const ADMIN = 'esterkinshimon712@gmail.com';
const STRANGER = 'fateevvl@gmail.com';
const FRIEND = 'friend@example.com';

const confirmed = (email, extra = {}) => ({
  id: 'uid-1',
  email,
  email_confirmed_at: '2026-09-18T00:00:00Z',
  ...extra,
});

describe('parseSignupAllowlist', () => {
  it('is empty for unset, empty, and whitespace-only values (open signup)', () => {
    expect(parseSignupAllowlist(undefined)).toEqual([]);
    expect(parseSignupAllowlist('')).toEqual([]);
    expect(parseSignupAllowlist('   ,  , ')).toEqual([]);
    expect(parseSignupAllowlist(null)).toEqual([]);
  });

  it('splits, trims, lowercases, and de-dupes', () => {
    expect(parseSignupAllowlist(` ${ADMIN.toUpperCase()} , ${FRIEND} , ${ADMIN} ,`)).toEqual([
      ADMIN,
      FRIEND,
    ]);
  });
});

describe('signupAllowlistActive', () => {
  it('is false for an empty list and true once any address is present', () => {
    expect(signupAllowlistActive([])).toBe(false);
    expect(signupAllowlistActive([ADMIN])).toBe(true);
  });
});

describe('userAllowedBySignupList — default off', () => {
  it('allows anyone, including a stranger and an unverified user', () => {
    expect(userAllowedBySignupList(confirmed(STRANGER), [])).toBe(true);
    expect(userAllowedBySignupList({ email: STRANGER }, [])).toBe(true);
    expect(userAllowedBySignupList(null, [])).toBe(true);
  });
});

describe('userAllowedBySignupList — closed list', () => {
  const list = parseSignupAllowlist(`${ADMIN},${FRIEND}`);

  it('allows a verified admin mailbox (must remain usable when enabled)', () => {
    expect(userAllowedBySignupList(confirmed(ADMIN), list)).toBe(true);
  });

  it('allows another listed verified mailbox', () => {
    expect(userAllowedBySignupList(confirmed(FRIEND), list)).toBe(true);
  });

  it('denies a verified stranger (the open-Google signup case)', () => {
    expect(userAllowedBySignupList(confirmed(STRANGER), list)).toBe(false);
  });

  it('denies an unverified address even when it matches the list', () => {
    expect(userAllowedBySignupList({ email: ADMIN }, list)).toBe(false);
  });

  it('allows a verified Google identity whose primary is unconfirmed', () => {
    const user = {
      email: STRANGER,
      email_confirmed_at: null,
      identities: [
        {
          provider: 'google',
          identity_data: { email: ADMIN, email_verified: true },
        },
      ],
    };
    expect(userAllowedBySignupList(user, list)).toBe(true);
  });

  it('ignores user_metadata emails', () => {
    const user = {
      email: STRANGER,
      email_confirmed_at: '2026-09-18T00:00:00Z',
      user_metadata: { email: ADMIN },
    };
    expect(userAllowedBySignupList(user, list)).toBe(false);
  });
});

describe('typedEmailAllowedForSignup', () => {
  it('is a no-op when the list is open', () => {
    expect(typedEmailAllowedForSignup(STRANGER, [])).toBe(true);
  });

  it('matches the typed address against a closed list, case-insensitively', () => {
    const list = [ADMIN];
    expect(typedEmailAllowedForSignup(`  ${ADMIN.toUpperCase()}  `, list)).toBe(true);
    expect(typedEmailAllowedForSignup(STRANGER, list)).toBe(false);
  });
});

describe('readServerSignupAllowlist / readClientSignupAllowlist', () => {
  it('reads SIGNUP_EMAIL_ALLOWLIST from the provided env', () => {
    expect(readServerSignupAllowlist({ SIGNUP_EMAIL_ALLOWLIST: ADMIN })).toEqual([ADMIN]);
    expect(readServerSignupAllowlist({ SIGNUP_EMAIL_ALLOWLIST: '' })).toEqual([]);
    expect(readServerSignupAllowlist({})).toEqual([]);
  });

  it('reads VITE_SIGNUP_EMAIL_ALLOWLIST from the provided env', () => {
    expect(readClientSignupAllowlist({ VITE_SIGNUP_EMAIL_ALLOWLIST: ADMIN })).toEqual([ADMIN]);
    expect(readClientSignupAllowlist({ VITE_SIGNUP_EMAIL_ALLOWLIST: '' })).toEqual([]);
    expect(readClientSignupAllowlist({})).toEqual([]);
  });
});

describe('assertSignupAllowed', () => {
  it('does not throw when the list is open', () => {
    expect(() => assertSignupAllowed(confirmed(STRANGER), [])).not.toThrow();
  });

  it('throws signup_not_allowed for a closed-list miss, with human copy', () => {
    try {
      assertSignupAllowed(confirmed(STRANGER), [ADMIN]);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toMatchObject({
        code: SIGNUP_NOT_ALLOWED_CODE,
        message: SIGNUP_NOT_ALLOWED_MESSAGE,
      });
    }
  });

  it('lets the admin mailbox through a closed list', () => {
    expect(() => assertSignupAllowed(confirmed(ADMIN), [ADMIN])).not.toThrow();
  });
});
