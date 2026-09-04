import { useEffect, useRef } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import SectionLabel from './ui/SectionLabel';
import ExerciseViewer from './exercises/ExerciseViewer';
import { useLessons } from '../lib/useLessons';
import { recordEvent } from '../lib/stats';
import { activePack } from '../packs';

/**
 * One practice tab's lane: server-driven lesson units on top, the tab's own
 * bundled content below.
 *
 * **With no units it renders `children` and nothing else** — no wrapper, no
 * collapsible, no heading. That is the whole basis for shipping this against a
 * `lessons` table with zero rows: every tab is byte-identical until content
 * exists (E5 plan, Ruling 1).
 *
 * With units, the dynamic pathway is the primary journey and the bundled decks
 * and tables move into a collapsed `<details>` (owner decision, 2026-09-04).
 * Native `<details>` rather than a custom accordion: it is keyboard- and
 * screen-reader-operable for free, and it HIDES its children without
 * unmounting them, so a half-finished drill survives a lesson appearing above
 * it.
 */
export default function PracticeLane({ courseCode = 'de', level, tab, packId = 'de', children }) {
  const { status, lessons } = useLessons({ courseCode, level, tab, packId });
  const chrome = activePack.content.lessonChrome ?? {};

  // One event per exercise. Each renderer already locks itself after grading,
  // so this is the second line of defence: a re-render or a double-fire cannot
  // bank the same answer twice. Reset when the lane changes, or a learner who
  // came back to a tab would find their answers silently unrecorded.
  const graded = useRef(new Set());
  const laneKey = `${packId}:${courseCode}:${level}:${tab}`;
  useEffect(() => {
    graded.current = new Set();
  }, [laneKey]);

  const units =
    status === 'ready'
      ? lessons
          .filter((lesson) => lesson.exercises.length > 0)
          .slice()
          // The handler orders by unit_number, but a cached blob was written by
          // whatever the server said then, and sorting is cheap next to
          // rendering the units out of sequence.
          .sort((a, b) => a.unitNumber - b.unitNumber)
      : [];

  if (units.length === 0) return children ?? null;

  function handleGraded(exerciseId, verdict) {
    if (graded.current.has(exerciseId)) return;
    graded.current.add(exerciseId);
    // The same single entry point every other tab uses: it writes local daily
    // through applyEvent AND enqueues the event for the RPC. Going near
    // applyEvent directly would write one and skip the other.
    recordEvent(tab, level, verdict);
  }

  return (
    <Stack gap={6}>
      <section aria-labelledby="lesson-units-heading">
        <SectionLabel id="lesson-units-heading">{chrome.heading}</SectionLabel>
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
                    onGraded={(verdict) => handleGraded(exercise.id, verdict)}
                  />
                ))}
              </Stack>
            </article>
          ))}
        </Stack>
      </section>

      <details
        style={{
          border: `1px solid ${COLORS.line}`,
          borderRadius: RADIUS.md,
          background: COLORS.surface,
        }}
      >
        <SectionLabel
          as="summary"
          style={{
            // A summary is the tap target, so it gets a thumb-sized one.
            minHeight: SPACE[12],
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${SPACE[4]}px`,
            marginBottom: 0,
            cursor: 'pointer',
          }}
        >
          {chrome.bundledHeading}
        </SectionLabel>
        <div style={{ padding: SPACE[4], minWidth: 0 }}>{children}</div>
      </details>
    </Stack>
  );
}
