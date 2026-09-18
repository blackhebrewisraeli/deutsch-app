import {
  COLORS,
  FONTS,
  FONT_BODY,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  RADIUS,
} from '../../lib/theme';

// The learner's current task card, or the "all tasks done" card (gold) once
// the scenario's task list has cycled. Rendered by the parent only when there
// is a current task.
//
// The task chrome is `COLORS.accentRed`, NOT `COLORS.red`. They looked identical
// before the flag tiers landed because `COLORS.red` is `--c-error`, so "here is
// your assignment" and "you got that wrong" (VerdictPanel) were the same colour.
// Red now means only *wrong*; the flag's red tier means the app is asking for
// something. Don't collapse them back.
export default function TaskPanel({
  currentTask,
  taskIdx,
  tasksCompleted,
  hintVisible,
  setHintVisible,
  onResetTasks,
  level,
  compact = false,
}) {
  const kicker = `TASK ${taskIdx + 1}${level ? ` · ${String(level).toUpperCase()}` : ''}`;

  if (compact && !tasksCompleted) {
    return (
      <div
        style={{
          marginTop: SPACE[3],
          background: COLORS.accentRed,
          color: COLORS.accentRedOn,
          borderRadius: RADIUS.lg,
          padding: '10px 12px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE[2],
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                opacity: 0.85,
              }}
            >
              {kicker}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: FONT_SIZE.base,
                lineHeight: 1.4,
                overflowWrap: 'anywhere',
              }}
            >
              {currentTask.task}
            </div>
          </div>
          {currentTask.hint && (
            <HintButton hintVisible={hintVisible} setHintVisible={setHintVisible} />
          )}
        </div>
        {hintVisible && currentTask.hint && (
          <div
            style={{
              marginTop: SPACE[3],
              borderTop: `1px dashed ${COLORS.paperA50}`,
              paddingTop: SPACE[3],
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.sm,
              opacity: 0.9,
            }}
          >
            {currentTask.hint}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: compact ? SPACE[3] : SPACE[5] }}>
      {tasksCompleted ? (
        <div
          style={{
            borderRadius: RADIUS.lg,
            background: COLORS.gold,
            color: COLORS.accentOn,
            padding: compact ? SPACE[3] : SPACE[5],
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              marginBottom: SPACE[2],
            }}
          >
            ✓ ALL TASKS DONE
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.base,
              fontStyle: 'italic',
              marginBottom: SPACE[3],
            }}
          >
            Great work! Tasks are cycling from the start.
          </div>
          <button
            type="button"
            data-ui="button"
            data-focus-on-dark=""
            onClick={onResetTasks}
            style={{
              background: 'transparent',
              border: `1px solid ${COLORS.accentOn}`,
              color: COLORS.accentOn,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.wider,
              padding: `${SPACE[1]}px ${SPACE[3]}px`,
              cursor: 'pointer',
            }}
          >
            CONTINUE
          </button>
        </div>
      ) : (
        <div
          style={{
            borderRadius: RADIUS.lg,
            background: COLORS.accentRed,
            color: COLORS.accentRedOn,
            padding: SPACE[3],
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              opacity: 0.8,
              marginBottom: SPACE[2],
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: FONT_SIZE.base,
              lineHeight: 1.5,
              marginBottom: currentTask.hint ? SPACE[3] : 0,
            }}
          >
            {currentTask.task}
          </div>
          {currentTask.hint && (
            <>
              <HintButton hintVisible={hintVisible} setHintVisible={setHintVisible} />
              {hintVisible && (
                <div
                  style={{
                    marginTop: SPACE[3],
                    borderTop: `1px dashed ${COLORS.paperA50}`,
                    paddingTop: SPACE[3],
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.sm,
                    opacity: 0.9,
                  }}
                >
                  {currentTask.hint}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HintButton({ hintVisible, setHintVisible }) {
  return (
    <button
      type="button"
      data-ui="button"
      data-focus-on-dark=""
      onClick={() => setHintVisible((v) => !v)}
      style={{
        background: 'transparent',
        // paperA60/paperA50 track `ground`, which runs the same
        // direction as accentRedOn in both modes — near-white on
        // light, near-black on dark — so they read as the tier ink
        // at alpha. (No hex here: the guard in noHardcodedHex.test.js
        // scans comments too, and it is right to.)
        border: `1px solid ${COLORS.paperA60}`,
        color: COLORS.accentRedOn,
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.wider,
        padding: `${SPACE[1]}px ${SPACE[3]}px`,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {hintVisible ? 'HIDE HINT' : 'SHOW HINT'}
    </button>
  );
}
