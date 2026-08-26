import { useState } from 'react';
import { Flag } from 'lucide-react';
import { COLORS, RADIUS, SPACE } from '../lib/theme';
import FeedbackDialog from './FeedbackDialog';

/** Minimum comfortable touch target, px — the iOS Human Interface guideline. */
const TAP_TARGET_MIN = 44;

/**
 * The "something is wrong with this exercise" affordance, sat inside an
 * exercise card. Owns nothing but the open state, so a tab wires it in with
 * one line and hands it the context it already has.
 *
 * `context` is `{ surface, level, itemId, itemLabel, deckId? }` and is passed
 * through untouched — see FeedbackDialog for why itemLabel is never rendered.
 */
export default function FeedbackButton({ context }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report an issue with this exercise"
        title="Report an issue with this exercise"
        style={{
          // Subtle by design: this sits beside the exercise, and a learner who
          // is not stuck should not be drawn to it.
          background: 'transparent',
          border: 'none',
          borderRadius: RADIUS.sm,
          color: COLORS.mute,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: TAP_TARGET_MIN,
          minHeight: TAP_TARGET_MIN,
          padding: SPACE[2],
          flexShrink: 0,
        }}
      >
        <Flag size={16} aria-hidden="true" />
      </button>
      {open && <FeedbackDialog context={context} onClose={() => setOpen(false)} />}
    </>
  );
}
