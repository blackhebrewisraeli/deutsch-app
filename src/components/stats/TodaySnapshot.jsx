import { CalendarDays } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import StatusNote from '../ui/StatusNote';

// Section A — today's exercise count + three-way accuracy bar + streak.
export default function TodaySnapshot({ snap }) {
  const { exercises, accuracy, streak } = snap;
  const totalGraded = accuracy.correct + accuracy.almost + accuracy.wrong;
  const pct = (n) => (totalGraded === 0 ? 0 : Math.round((n / totalGraded) * 100));

  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background: COLORS.card,
        padding: SPACE[6],
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: SPACE[8],
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginBottom: SPACE[2],
          }}
        >
          TODAY
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE['6xl'],
            fontWeight: FONT_WEIGHT.black,
            letterSpacing: LETTER_SPACING.tight,
            lineHeight: 1,
            color: COLORS.ink,
          }}
        >
          {exercises}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
            marginTop: SPACE[2],
          }}
        >
          exercise{exercises === 1 ? '' : 's'}
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginBottom: SPACE[3],
          }}
        >
          ACCURACY · STREAK {streak}
        </div>
        {totalGraded === 0 ? (
          <StatusNote icon={CalendarDays}>No exercises graded yet today.</StatusNote>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                height: 24,
                borderRadius: RADIUS.pill,
                overflow: 'hidden',
                marginBottom: SPACE[2],
              }}
            >
              {accuracy.correct > 0 && (
                <div style={{ width: `${pct(accuracy.correct)}%`, background: COLORS.gold }} />
              )}
              {accuracy.almost > 0 && (
                <div style={{ width: `${pct(accuracy.almost)}%`, background: COLORS.paperDeep }} />
              )}
              {accuracy.wrong > 0 && (
                <div style={{ width: `${pct(accuracy.wrong)}%`, background: COLORS.red }} />
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: SPACE[5],
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                color: COLORS.ink,
              }}
            >
              <span>
                ✓ {accuracy.correct} ({pct(accuracy.correct)}%)
              </span>
              <span>
                ≈ {accuracy.almost} ({pct(accuracy.almost)}%)
              </span>
              <span>
                ✗ {accuracy.wrong} ({pct(accuracy.wrong)}%)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
