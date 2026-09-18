/**
 * Server-side identity classification.
 *
 * Admin permission and system-account classification are two concepts that
 * happen to share a mailbox in v1. They are separate allowlists so they can
 * diverge without a redesign.
 *
 * Source of truth: verified emails on the Supabase user from getUser().
 * localStorage, profiles columns, user_metadata, app_metadata, and request
 * fields are untrusted and are never read here.
 */

export const ADMIN_EMAILS = Object.freeze(['esterkinshimon712@gmail.com']);

export const SYSTEM_ACCOUNT_EMAILS = Object.freeze(['esterkinshimon712@gmail.com']);

/**
 * Product decision: system and test activity stays in stats and leagues.
 * Classification must not be used as an exclusion filter.
 */
export const INCLUDE_SYSTEM_ACCOUNTS_IN_STATS = true;

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function identityEmailVerified(identity) {
  if (!identity || typeof identity !== 'object') return false;
  const data =
    identity.identity_data && typeof identity.identity_data === 'object'
      ? identity.identity_data
      : {};
  if (data.email_verified === true || data.email_verified === 'true') return true;
  // Completing a magic-link / OTP is how an email identity is created.
  if (identity.provider === 'email') return true;
  return false;
}

/**
 * Verified emails on this user: confirmed primary plus verified identities
 * (Google `email_verified`, email-provider identities). Unverified addresses
 * are omitted even when they match an allowlist.
 *
 * @param {object | null | undefined} user
 * @returns {string[]}
 */
export function verifiedEmailsFromUser(user) {
  const emails = new Set();
  if (!user || typeof user !== 'object') return [];

  const primary = normalizeEmail(user.email);
  if (primary && user.email_confirmed_at) emails.add(primary);

  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    if (!identityEmailVerified(identity)) continue;
    const data =
      identity.identity_data && typeof identity.identity_data === 'object'
        ? identity.identity_data
        : {};
    const email = normalizeEmail(data.email || identity.email);
    if (email) emails.add(email);
  }
  return [...emails];
}

/**
 * @param {object | null | undefined} user
 * @returns {{ isAdmin: boolean, isSystemAccount: boolean, emails: string[] }}
 */
export function classifyAuthUser(user) {
  const emails = verifiedEmailsFromUser(user);
  return {
    isAdmin: emails.some((email) => ADMIN_EMAILS.includes(email)),
    isSystemAccount: emails.some((email) => SYSTEM_ACCOUNT_EMAILS.includes(email)),
    emails,
  };
}
