import { createPublicHandler } from '../../_lib/publicHandler.js';
import { sendError } from '../../_lib/respond.js';

// Language-blind content lane. courseCode / level / tab are opaque identifiers
// validated against closed sets; no German string appears in this file, and no
// branch reads a pack's field names. Payload shape is owned by the exercise
// type and lives in pack data.
//
// Query parameters rather than a dynamic route: this project compiles twelve
// static function filenames and has no [param] routes or rewrites, and
// api/v1/league/profile.js already reads req.query. See the plan's Ruling 1.

const COURSE_CODES = ['de'];
const LEVELS = ['a1', 'a2', 'b1'];
const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const PACK_IDS = ['de'];

/** The closed set of renderers the engine knows how to call. */
export const EXERCISE_TYPES = ['flashcard', 'translate', 'chat', 'multiple-choice'];

/**
 * Drop exercise elements the engine could not render, and say how many went.
 *
 * SQL cannot cheaply enforce "every array element has id + type" without a
 * constraint trigger, so a bad row is filtered on the way out instead. It
 * returns the count as well as the survivors because "served 3 of 3" and
 * "served 3 of 40" are the same response body otherwise — a seed that silently
 * loses most of its content would look exactly like a short lesson.
 */
export function sanitizeExercises(exercises, rowId) {
  if (!Array.isArray(exercises)) return { kept: [], dropped: 0 };
  const kept = exercises.filter(
    (ex) =>
      ex &&
      typeof ex.id === 'string' &&
      ex.id.length > 0 &&
      typeof ex.type === 'string' &&
      EXERCISE_TYPES.includes(ex.type)
  );
  const dropped = exercises.length - kept.length;
  if (dropped > 0) {
    console.error(`content: lesson ${rowId} dropped ${dropped}/${exercises.length} exercises`);
  }
  return { kept, dropped };
}

const handler = createPublicHandler({
  method: 'GET',
  ipRate: { max: 60, windowMs: 300000 },
  name: 'content lessons',
  failureMessage: 'Content unavailable.',
  run: async ({ req, res, db }) => {
    const courseCode = req.query?.courseCode;
    const level = req.query?.level;
    const tab = req.query?.tab;
    const packId = req.query?.packId ?? 'de';

    if (!COURSE_CODES.includes(courseCode)) {
      return sendError(res, 'bad_request', 'Unknown courseCode.');
    }
    if (!LEVELS.includes(level)) {
      return sendError(res, 'bad_request', 'Unknown level.');
    }
    if (!TABS.includes(tab)) {
      return sendError(res, 'bad_request', 'Unknown tab.');
    }
    if (!PACK_IDS.includes(packId)) {
      return sendError(res, 'bad_request', 'Unknown packId.');
    }

    const { data, error } = await db
      .from('lessons')
      .select('id, pack_id, course_code, level, tab, unit_number, exercises, updated_at')
      .eq('pack_id', packId)
      .eq('course_code', courseCode)
      .eq('level', level)
      .eq('tab', tab)
      .order('unit_number', { ascending: true });

    if (error) {
      console.error('content lessons query failed:', error.message);
      return sendError(res, 'server_error', 'Content unavailable.');
    }

    const lessons = (data ?? []).map((row) => ({
      id: row.id,
      packId: row.pack_id,
      courseCode: row.course_code,
      level: row.level,
      tab: row.tab,
      unitNumber: row.unit_number,
      exercises: sanitizeExercises(row.exercises, row.id).kept,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({ lessons });
  },
});

export default handler;
