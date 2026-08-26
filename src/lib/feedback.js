/**
 * In-exercise problem reports.
 *
 * The transport is a stand-in — it logs and resolves. Everything around it is
 * built for the real one: `buildFeedbackRow` emits a flat, snake_case,
 * JSON-safe object, so swapping the mock for
 *
 *   await supabase.from('feedback').insert(row)
 *
 * is a one-line change inside `submitFeedback` and touches nothing else. The
 * table itself is deliberately out of scope for now.
 */

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
    // TODO(supabase): replace with an insert into the `feedback` table.
    // The stand-in transport IS the log. warn/error would misreport a
    // successful submission as a fault, so the rule is waived rather than the
    // level changed.
    // eslint-disable-next-line no-console
    console.info('[feedback]', row);
    return { ok: true, row };
  } catch (error) {
    return { ok: false, error };
  }
}
