import { useEffect, useRef, useState } from 'react';
import { COLORS, RADIUS, SPACE } from '../lib/theme';
import { Stack } from './ui/Layout';
import SectionLabel from './ui/SectionLabel';
import LessonUnits from './LessonUnits';
import { useLessons } from '../lib/useLessons';
import { recordEvent, todayKey } from '../lib/stats';
import { currentStreak } from '../lib/streak';
import { DEFAULT_GOAL } from '../lib/gameConfig';
import { loadState } from '../lib/storage';
import { activePack } from '../packs';

function readStreak() {
  try {
    const s = loadState() ?? {};
    return currentStreak(
      s.daily ?? {},
      s.gamification?.goal ?? DEFAULT_GOAL,
      todayKey(),
      s.gamification?.frozenDays ?? {}
    );
  } catch {
    return 0;
  }
}

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
  // bank the same answer twice. The ref is the sync guard; `grades` is the
  // session map the unit states re-render from. Reset when the lane changes,
  // or a learner who came back to a tab would find their answers silently
  // unrecorded.
  const graded = useRef(new Set());
  const [grades, setGrades] = useState({});
  const [streak, setStreak] = useState(readStreak);
  const laneKey = `${packId}:${courseCode}:${level}:${tab}`;
  useEffect(() => {
    graded.current = new Set();
    setGrades({});
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
    setGrades((prev) => ({ ...prev, [exerciseId]: verdict }));
    // The same single entry point every other tab uses: it writes local daily
    // through applyEvent AND enqueues the event for the RPC. Going near
    // applyEvent directly would write one and skip the other.
    recordEvent(tab, level, verdict);
    setStreak(readStreak());
  }

  return (
    <Stack gap={6}>
      <LessonUnits
        units={units}
        grades={grades}
        chrome={chrome}
        streak={streak}
        onGraded={handleGraded}
      />

      <details
        style={{
          border: `1px solid ${COLORS.border}`,
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
