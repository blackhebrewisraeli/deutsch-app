import { useRef, useState } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
  TRANSITION,
} from '../../lib/theme';
import { LEVELS, LEVEL_NAMES, LEVEL_MODES } from '../../lib/levelPref';

// CEFR practice-level control. Two variants off one implementation so the
// header sheet and the settings section cannot drift apart:
//   compact — codes only, sized for the header popover
//   full    — codes plus the gloss and the exercise mode, for settings
//
// A radiogroup rather than SegmentedPicker's `role="group"` + aria-pressed:
// picking a level is a single choice from a set, which is what a radiogroup
// means, and it buys arrow-key traversal that a row of buttons does not have.
//
// MANUAL selection, not selection-follows-focus. Two reasons, one of them
// load-bearing:
//   1. Committing a level restarts the exercise set, which APG calls out as
//      the case where following focus is the wrong default.
//   2. The compact variant lives in a popover that closes on commit. With
//      selection following focus, one ArrowRight selected A2, closed the
//      sheet and pulled focus back to the trigger — B1 was unreachable by
//      keyboard entirely. Arrows move focus; Space/Enter commit (both fire
//      click natively on a <button>, so there is no key handler for them).
//
// `value` and the values handed to `onChange` are LOWERCASE ('a1' | 'a2' |
// 'b1'). Uppercase is not accepted here because setUserLevel rejects it —
// coercing would let a caller write a value that reads back as corrupt and
// resets the learner to A1.
export default function LevelSwitcher({
  value,
  onChange,
  variant = 'full',
  ariaLabel = 'Select learning level',
}) {
  const compact = variant === 'compact';
  const refs = useRef({});

  // Which option currently holds DOM focus, or null when focus is outside the
  // group. Stored rather than derived because with manual selection the
  // focused option and the checked one are different things.
  const [focusedLevel, setFocusedLevel] = useState(null);

  // Roving tabindex: the group is one tab stop. The focused option owns it
  // while focus is inside; otherwise the checked one does, so tabbing back in
  // lands on the current level. Falls back to the first level so a corrupt
  // `value` still leaves the group reachable instead of trapping every option
  // at tabIndex -1.
  const rovingLevel = focusedLevel ?? (LEVELS.includes(value) ? value : LEVELS[0]);
  const focusIndex = Math.max(0, LEVELS.indexOf(rovingLevel));

  const pick = (level) => {
    if (level !== value) onChange?.(level);
  };

  const onKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (delta) next = (focusIndex + delta + LEVELS.length) % LEVELS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LEVELS.length - 1;
    if (next === null) return;
    e.preventDefault();
    // Focus only. `onFocus` on the button records it; nothing is committed
    // until the user presses Space/Enter or clicks.
    refs.current[LEVELS[next]]?.focus();
  };

  // Hand the tab stop back to the checked option once focus leaves the group,
  // so an abandoned traversal does not leave the roving index parked on a
  // level the learner never committed to.
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocusedLevel(null);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        display: 'grid',
        // minmax(0, 1fr), never a bare 1fr — see AGENTS.md. A bare track keeps
        // min-width:auto and pushes the page wider than the viewport.
        gridTemplateColumns: `repeat(${LEVELS.length}, minmax(0, 1fr))`,
        gap: compact ? SPACE[2] : SPACE[3],
      }}
    >
      {LEVELS.map((level) => {
        const active = level === value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            // Named explicitly rather than from content: the visible text is
            // the bare code, and "A1" alone does not say what it selects.
            // Also keeps the name identical across both variants, which the
            // full variant's second line would otherwise change.
            aria-label={`${level.toUpperCase()} — ${LEVEL_NAMES[level] ?? ''}`}
            // Only the roving option is in the tab order; arrows reach the rest.
            tabIndex={level === LEVELS[focusIndex] ? 0 : -1}
            ref={(el) => {
              refs.current[level] = el;
            }}
            // Covers every route in — click, Tab, and the arrow handler above
            // — so the roving index never disagrees with real DOM focus.
            onFocus={() => setFocusedLevel(level)}
            onClick={() => pick(level)}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: SHADOW.press(active ? COLORS.greenDeep : COLORS.lip),
              // Same green-fill / paper-ink pairing SegmentedPicker uses —
              // that combination is already audited by the contrast gate.
              background: active ? COLORS.green : COLORS.card,
              color: active ? COLORS.paper : COLORS.ink,
              padding: compact ? `${SPACE[2]}px ${SPACE[1]}px` : SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              textAlign: 'center',
              transition: TRANSITION.fast,
              // The grid track can be narrower than the word; let it wrap
              // rather than push the 320px viewport wider.
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontWeight: FONT_WEIGHT.bold,
                letterSpacing: LETTER_SPACING.widest,
                fontSize: FONT_SIZE.sm,
              }}
            >
              {level.toUpperCase()}
            </div>
            {/* Codes only in compact: the gloss is a single unbreakable word
                that overflows the box below 375px, which is exactly the width
                the header sheet is clamped to. */}
            {!compact && (
              <div
                style={{
                  marginTop: SPACE[1],
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.label,
                  letterSpacing: LETTER_SPACING.caps,
                  textTransform: 'uppercase',
                  color: active ? COLORS.paper : COLORS.mute,
                  // Wraps instead of overflowing at 320px.
                  overflowWrap: 'anywhere',
                }}
              >
                {LEVEL_MODES[level]?.label ?? LEVEL_NAMES[level] ?? ''}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
