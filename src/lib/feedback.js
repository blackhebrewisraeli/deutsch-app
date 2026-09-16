/**
 * In-exercise problem reports.
 *
 * `buildFeedbackRow` emits a flat, snake_case, JSON-safe object. `submitFeedback`
 * inserts it into `public.feedback`. The insert does not chain `.select()`:
 * clients have INSERT only, and a RETURNING clause would fail the request even
 * after a successful write.
 *
 * When auth/sync is unconfigured (`getSupabase()` is null) the row is logged
 * and treated as sent, so a demo without `VITE_SUPABASE_*` still resolves the
 * dialog. A configured backend that then errors returns `{ ok: false }` — the
 * learner can retry. Never throws.
 */

import { getSupabase } from './auth.js';

/** The three problems a learner can actually hit mid-exercise. */
export const FEEDBACK_CATEGORIES = Object.freeze([
  { key: 'translation', label: 'Wrong translation' },
  { key: 'ui', label: 'Confusing UI' },
  { key: 'audio', label: 'Bad audio' },
]);

/**
 * Flatten an exercise context plus the learner's words into one insert-ready row.
 *
 * Absent context is written as `null`, never left `undefined`: undefined keys
 * vanish through JSON.stringify, so "this surface has no deck" and "the deck
 * was lost on the way" would arrive identical and unfixable.
 *
 * `user_id` is attached in `submitFeedback` from the session, not here: the
 * row shape is the exercise payload; identity is a transport concern.
 *
 * @param {{surface:string, level:string, deckId?:string|null, itemId?:string|null,
 *          itemLabel?:string|null, category:string, message:string}} report
 * @param {Date} [now]
 */
export function buildFeedbackRow(report, now = new Date()) {
  return {
    surface: report.surface ?? null,
    cefr_level: report.level ?? null,
    deck_id: report.deckId ?? null,
    item_id: report.itemId ?? null,
    // Captured, never displayed — see FeedbackDialog: for a concealing drill
    // this string IS the answer the learner is being asked for.
    item_label: report.itemLabel ?? null,
    category: report.category ?? null,
    message: (report.message ?? '').trim(),
    created_at: now.toISOString(),
  };
}

/**
 * Send one report. Never throws: a learner reporting a broken exercise must not
 * be handed a second broken thing.
 *
 * @returns {Promise<{ok: boolean, row?: object, error?: unknown}>}
 */
export async function submitFeedback(report) {
  const row = buildFeedbackRow(report);
  if (!row.message) return { ok: false, error: 'empty' };

  try {
    const supabase = await getSupabase();
    if (!supabase) {
      // Demo / CI / any checkout without VITE_SUPABASE_*: keep the dialog
      // succeeding. warn/error would misreport a successful local send as a
      // fault, so the rule is waived rather than the level changed.
      // eslint-disable-next-line no-console
      console.info('[feedback]', row);
      return { ok: true, row };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const payload = {
      ...row,
      user_id: sessionData?.session?.user?.id ?? null,
    };

    const { error } = await supabase.from('feedback').insert(payload);
    if (error) return { ok: false, error };
    return { ok: true, row: payload };
  } catch (error) {
    return { ok: false, error };
  }
}
