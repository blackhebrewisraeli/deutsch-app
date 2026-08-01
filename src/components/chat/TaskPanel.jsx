import {
  COLORS,
  FONTS,
  FONT_BODY,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';

// Section C — the learner's current task card (red), or the "all tasks done"
// card (gold) once the scenario's task list has cycled. Rendered by the parent
// only when there is a current task.
export default function TaskPanel({
  currentTask,
  taskIdx,
  tasksCompleted,
  hintVisible,
  setHintVisible,
  onResetTasks,
}) {
  return (
    <div style={{ marginTop: SPACE[5] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[2],
          marginBottom: SPACE[3],
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.ipa,
            letterSpacing: LETTER_SPACING.wider,
            background: COLORS.red,
            color: COLORS.paper,
            padding: `2px ${SPACE[2]}px`,
          }}
        >
          C
        </span>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.ultra,
            textTransform: 'uppercase',
            color: COLORS.mute,
          }}
        >
          Your Task
        </span>
      </div>
      {tasksCompleted ? (
        <div
          style={{
            borderRadius: RADIUS.lg,
            boxShadow: SHADOW.press('#d9ab10'),
            background: COLORS.gold,
            color: COLORS.ink,
            padding: SPACE[5],
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
            onClick={onResetTasks}
            style={{
              background: 'transparent',
              border: `1px solid ${COLORS.ink}`,
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
            boxShadow: SHADOW.press(COLORS.rust),
            background: COLORS.red,
            color: COLORS.paper,
            padding: SPACE[5],
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
            TASK {taskIdx + 1}
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: FONT_SIZE.base,
              lineHeight: 1.6,
              fontStyle: 'italic',
              marginBottom: currentTask.hint ? SPACE[3] : 0,
            }}
          >
            {currentTask.task}
          </div>
          {currentTask.hint && (
            <>
              <button
                type="button"
                onClick={() => setHintVisible((v) => !v)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.paperA60}`,
                  color: COLORS.paper,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.wider,
                  padding: `${SPACE[1]}px ${SPACE[3]}px`,
                  cursor: 'pointer',
                }}
              >
                {hintVisible ? 'HIDE HINT' : 'SHOW HINT'}
              </button>
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
