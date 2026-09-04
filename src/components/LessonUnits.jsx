import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import ExerciseViewer from './exercises/ExerciseViewer';
import { useLessons } from '../lib/useLessons';
import { activePack } from '../packs';

/**
 * Server-driven lesson units for the active (level, tab), as an ADDITIVE
 * overlay over the bundled pack (E5 plan, Ruling 1).
 *
 * It renders `null` for every state except "ready with at least one renderable
 * exercise": loading, an empty track, a broken lane, and a unit whose exercises
 * were all dropped as invalid all leave the tab exactly as it was. That is what
 * lets this ship against a `lessons` table with zero rows in all twelve
 * (level, tab) combinations without any user-visible change.
 *
 * It does not write progress. Wiring answers into the queue is E5.5.
 */
export default function LessonUnits({ courseCode = 'de', level, tab, packId = 'de' }) {
  const { status, lessons } = useLessons({ courseCode, level, tab, packId });
  const chrome = activePack.content.lessonChrome ?? {};

  if (status !== 'ready') return null;

  // A unit whose exercises were all dropped has nothing to show. Rendering its
  // shell anyway would put an empty titled card on the tab — worse than the
  // absence, because it reads as a loading bug rather than as no content.
  const units = lessons
    .filter((lesson) => lesson.exercises.length > 0)
    .slice()
    // The handler already orders by unit_number, but a cached blob was written
    // by whatever the server said then, and `slice().sort()` is cheap next to
    // rendering the units out of sequence.
    .sort((a, b) => a.unitNumber - b.unitNumber);

  if (units.length === 0) return null;

  return (
    <section aria-labelledby="lesson-units-heading">
      <div
        id="lesson-units-heading"
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
          marginBottom: SPACE[3],
        }}
      >
        {chrome.heading}
      </div>
      <Stack gap={6}>
        {units.map((lesson) => (
          <article key={lesson.id} aria-label={`${chrome.unitPrefix} ${lesson.unitNumber}`}>
            <h2
              style={{
                margin: 0,
                marginBottom: SPACE[3],
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.xl,
                fontWeight: FONT_WEIGHT.bold,
                color: COLORS.ink,
              }}
            >
              {chrome.unitPrefix} {lesson.unitNumber}
            </h2>
            <Stack gap={5}>
              {lesson.exercises.map((exercise) => (
                <ExerciseViewer
                  key={exercise.id}
                  id={exercise.id}
                  type={exercise.type}
                  payload={exercise.payload}
                />
              ))}
            </Stack>
          </article>
        ))}
      </Stack>
    </section>
  );
}
