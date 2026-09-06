import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  BUTTON,
  RADIUS,
  SHADOW,
} from '../../lib/theme';

/**
 * Shown once an answer is in: the verdict, the correct meaning, and the SRS
 * buttons. A wrong answer offers only AGAIN — grading how well you knew
 * something you did not know is meaningless.
 *
 * Named VerdictPanel rather than FeedbackPanel because translate/ already has a
 * FeedbackPanel, and two same-named panels in sibling directories is a trap.
 *
 * @param {{ result: 'correct'|'almost'|'wrong', answer: string,
 *           onVerdict: (v: 'again'|'hard'|'good'|'easy') => void }} props
 */
export default function VerdictPanel({ result, answer, onVerdict }) {
  return (
    <div
      className={result === 'wrong' ? 'wiggle' : 'pop'}
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background:
          result === 'correct' ? COLORS.gold : result === 'almost' ? COLORS.paperDeep : COLORS.red,
        color:
          result === 'correct' ? COLORS.accentOn : result === 'almost' ? COLORS.ink : COLORS.paper,
        padding: SPACE[4],
        marginTop: SPACE[3],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          marginBottom: SPACE[2],
          textAlign: 'center',
        }}
      >
        {result === 'correct'
          ? '✓ CORRECT'
          : result === 'almost'
            ? '≈ ALMOST — CHECK SPELLING'
            : '✗ NOT QUITE'}
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE.xl,
          fontWeight: FONT_WEIGHT.semibold,
          marginBottom: SPACE[3],
          textAlign: 'center',
        }}
      >
        {answer}
      </div>
      {result === 'wrong' ? (
        <button
          type="button"
          onClick={() => onVerdict('again')}
          style={{ ...BUTTON.primary, width: '100%' }}
        >
          AGAIN — REVIEW SOON →
        </button>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: SPACE[2],
            width: '100%',
          }}
        >
          <button type="button" onClick={() => onVerdict('hard')} style={{ ...BUTTON.tile }}>
            HARD
          </button>
          <button type="button" onClick={() => onVerdict('good')} style={{ ...BUTTON.primary }}>
            GOOD
          </button>
          <button type="button" onClick={() => onVerdict('easy')} style={{ ...BUTTON.go }}>
            EASY
          </button>
        </div>
      )}
    </div>
  );
}
