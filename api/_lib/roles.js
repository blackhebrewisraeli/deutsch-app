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
import { verifiedEmailsFromUser } from '../../src/lib/verifiedEmails.js';

export const ADMIN_EMAILS = Object.freeze(['esterkinshimon712@gmail.com']);

export const SYSTEM_ACCOUNT_EMAILS = Object.freeze(['esterkinshimon712@gmail.com']);

/**
 * Product decision: system and test activity stays in stats and leagues.
 * Classification must not be used as an exclusion filter.
 */
export const INCLUDE_SYSTEM_ACCOUNTS_IN_STATS = true;

// The .js extension is mandatory: this resolves under native Node ESM on
// Vercel, where a missing extension is a 500 that Vite and vitest both hide.
export { normalizeEmail, verifiedEmailsFromUser } from '../../src/lib/verifiedEmails.js';

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
