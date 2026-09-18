/**
 * Optional closed-signup allowlist.
 *
 * Default (unset / empty): open signup — anyone with a valid session may use
 * the account lane. That is production today and must stay that way until the
 * owner sets env.
 *
 * When `SIGNUP_EMAIL_ALLOWLIST` (server) and/or `VITE_SIGNUP_EMAIL_ALLOWLIST`
 * (client, build-time) is a comma-separated list, only those verified emails
 * keep a session. Guests are untouched: they never present a JWT.
 *
 * Exact match after trim + lowercase; no plus-address aliasing. Same recipe
 * as the admin allowlist in `api/_lib/roles.js`.
 */
import { normalizeEmail, verifiedEmailsFromUser } from './verifiedEmails.js';

export const SIGNUP_NOT_ALLOWED_CODE = 'signup_not_allowed';

export const SIGNUP_NOT_ALLOWED_MESSAGE =
  "This email isn't invited to the beta. Ask the owner for access.";

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseSignupAllowlist(raw) {
  if (typeof raw !== 'string') return [];
  return [...new Set(raw.split(',').map(normalizeEmail).filter(Boolean))];
}

/** Empty / unset list = open signup (production default). */
export function signupAllowlistActive(list) {
  return Array.isArray(list) && list.length > 0;
}

/**
 * May this authenticated user keep a session against `list`?
 *
 * Open list → yes, including unverified users (current behaviour).
 * Closed list → only a *verified* address on the list. Unverified mailboxes
 * matching the list are denied — same rule as admin classification.
 *
 * @param {object | null | undefined} user
 * @param {string[]} list
 */
export function userAllowedBySignupList(user, list) {
  if (!signupAllowlistActive(list)) return true;
  return verifiedEmailsFromUser(user).some((email) => list.includes(email));
}

/**
 * Typed-email pre-check for the magic-link form. We do not yet have a
 * verified identity, so this is UX only — the session gate still uses
 * `userAllowedBySignupList`.
 *
 * @param {unknown} email
 * @param {string[]} list
 */
export function typedEmailAllowedForSignup(email, list) {
  if (!signupAllowlistActive(list)) return true;
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && list.includes(normalized);
}

export function readServerSignupAllowlist(env) {
  return parseSignupAllowlist(env?.SIGNUP_EMAIL_ALLOWLIST);
}

export function readClientSignupAllowlist(env = import.meta.env) {
  return parseSignupAllowlist(env?.VITE_SIGNUP_EMAIL_ALLOWLIST);
}

/**
 * Server gate used by `requireAuth`. Throws the envelope `accountHandler`
 * already maps through `sendError`.
 *
 * @param {object | null | undefined} user
 * @param {string[]} list
 */
export function assertSignupAllowed(user, list) {
  if (userAllowedBySignupList(user, list)) return;
  throw { code: SIGNUP_NOT_ALLOWED_CODE, message: SIGNUP_NOT_ALLOWED_MESSAGE };
}
