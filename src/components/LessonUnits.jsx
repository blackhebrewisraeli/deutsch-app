import { Flame, Lock } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE, TEXT } from '../lib/theme';
import { Row, Stack } from './ui/Layout';
import SectionLabel from './ui/SectionLabel';
import { Meta } from './ui/Text';
import ExerciseViewer from './exercises/ExerciseViewer';
import { unitVisualStates, unitXp } from '../lib/lessonProgress';

const STATUS_KEY = {
  locked: 'locked',
  'in-progress': 'inProgress',
  completed: 'completed',
};

const CARD = {
  locked: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.mute,
  },
  'in-progress': {
    background: COLORS.surfaceElevated,
    border: `1px solid ${COLORS.borderStrong}`,
    color: COLORS.ink,
  },
  completed: {
    background: COLORS.greenSoft,
    border: `1px solid ${COLORS.green}`,
    color: COLORS.ink,
  },
};

const CARD_MOTION = 'border-color 0.4s ease, background 0.4s ease';

/**
 * Ordered lesson units. Knows structure — states, a progress bar, exercises —
 * and nothing about German. Chrome copy arrives from the pack.
 */
export default function LessonUnits({ units, grades = {}, chrome = {}, streak = 0, onGraded }) {
  const rows = unitVisualStates(units, grades);
  const byId = new Map((units ?? []).map((unit) => [unit.id, unit]));

  return (
    <section aria-labelledby="lesson-units-heading">
      <SectionLabel id="lesson-units-heading">{chrome.heading}</SectionLabel>
      <Stack gap={6}>
        {rows.map((row) => {
          const unit = byId.get(row.id);
          const status = chrome[STATUS_KEY[row.state]];
          const xp = unitXp(unit, grades);
          const locked = row.state === 'locked';
          return (
            <article
              key={row.id}
              aria-label={`${chrome.unitPrefix} ${row.unitNumber}`}
              aria-disabled={locked || undefined}
              data-unit-state={row.state}
              style={{
                ...CARD[row.state],
                borderRadius: RADIUS.lg,
                padding: SPACE[4],
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                transition: CARD_MOTION,
              }}
            >
              <Stack gap={4}>
                <Row gap={3} align="center" style={{ width: '100%' }}>
                  <h2
                    style={{
                      margin: 0,
                      flex: '1 1 8rem',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                      fontFamily: FONTS.display,
                      fontSize: FONT_SIZE.xl,
                      fontWeight: FONT_WEIGHT.bold,
                      color: locked ? COLORS.mute : COLORS.ink,
                    }}
                  >
                    {chrome.unitPrefix} {row.unitNumber}
                  </h2>
                  <Meta
                    as="span"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: SPACE[1],
                      flexShrink: 0,
                    }}
                  >
                    {locked ? <Lock size={12} aria-hidden="true" /> : null}
                    {status}
                  </Meta>
                  {!locked ? (
                    <Row gap={2} align="center" style={{ flexShrink: 0 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: SPACE[1],
                          color: COLORS.red,
                          fontFamily: FONTS.mono,
                          fontSize: FONT_SIZE.tag,
                          fontWeight: FONT_WEIGHT.bold,
                        }}
                      >
                        <Flame size={14} aria-hidden="true" />
                        {streak}
                      </span>
                      <span
                        style={{
                          ...TEXT.tag,
                          background: COLORS.gold,
                          color: COLORS.accentOn,
                          borderRadius: RADIUS.pill,
                        }}
                      >
                        {xp} {chrome.xpSuffix}
                      </span>
                    </Row>
                  ) : null}
                </Row>

                {row.state === 'in-progress' && row.total > 0 ? (
                  <div
                    role="progressbar"
                    aria-label={chrome.progressLabel}
                    aria-valuenow={row.done}
                    aria-valuemin={0}
                    aria-valuemax={row.total}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      height: 8,
                      borderRadius: RADIUS.pill,
                      background: COLORS.track,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(row.done / row.total) * 100}%`,
                        height: '100%',
                        borderRadius: RADIUS.pill,
                        background: row.done >= row.total ? COLORS.green : COLORS.gold,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                ) : null}

                {!locked && unit
                  ? (unit.exercises ?? []).map((exercise) => (
                      <ExerciseViewer
                        key={exercise.id}
                        id={exercise.id}
                        type={exercise.type}
                        payload={exercise.payload}
                        onGraded={(verdict) => onGraded?.(exercise.id, verdict)}
                      />
                    ))
                  : null}
              </Stack>
            </article>
          );
        })}
      </Stack>
    </section>
  );
}
