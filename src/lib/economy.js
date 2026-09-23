import { getSupabase } from './auth.js';

/**
 * Token economy — the client half.
 *
 * The server is the ledger. Every balance change goes through one of two
 * SECURITY DEFINER RPCs (supabase/migrations/20260923120000_token_economy.sql)
 * over the existing Supabase client, so there is no API route to add:
 *   award_tokens(reason, key) — the SERVER picks the amount and caps it daily
 *   spend_tokens(amount, reason, key) — atomic, never below zero
 * Both are idempotent on (reason, key) and return the balance afterwards,
 * which the caller adopts as the truth.
 *
 * TOKEN_REWARDS mirrors the server's amounts for OPTIMISTIC display only. If
 * the two ever disagree the server wins on the next reconcile — nothing here
 * decides what a learner earns.
 */
export const TOKEN_REWARDS = Object.freeze({ daily_quest: 10 });

/** One idempotency key per quest per day, so a quest pays once. */
export const questRewardKey = (todayKey, questId) => `${todayKey}:${questId}`;

async function rpc(fn, args) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('No backend configured.');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** @returns {Promise<number>} the balance after the award (unchanged if capped/duplicate). */
export function awardTokens(reason, key) {
  return rpc('award_tokens', { p_reason: reason, p_key: key });
}

/** @returns {Promise<number>} the balance after the spend. Rejects on insufficient funds. */
export function spendTokens(amount, reason, key) {
  return rpc('spend_tokens', { p_amount: amount, p_reason: reason, p_key: key });
}

/**
 * The caller's balance, or null when it cannot be read.
 *
 * Its OWN query, deliberately not a column in PROFILE_COLUMNS. main deploys on
 * merge but the migration is applied by hand afterwards, and in that window a
 * select naming `tokens` fails outright — folded into the profile read, that
 * would blank every learner's name and avatar, not just the balance. Here the
 * worst case is that the balance does not render.
 */
export async function fetchMyTokens(userId) {
  if (!userId) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || typeof data?.tokens !== 'number') return null;
  return data.tokens;
}
