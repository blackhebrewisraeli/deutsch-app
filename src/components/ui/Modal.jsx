import { useEffect, useRef } from 'react';
import { COLORS, RADIUS, SPACE, Z } from '../../lib/theme';
import useFocusTrap from '../../lib/useFocusTrap';

/**
 * The scrim + card + focus-trap shell ProfileCard, AuthSheet and the
 * AuthCallbackLanding error panel each rolled independently (#144–#146) before
 * useFocusTrap was extracted — this is that same convergence one level up, for
 * any NEW modal rather than another hand-rolled copy.
 *
 * Policy this owns: focus lands on the card (not its first control) so a
 * screen reader announces the label before any content — see the capture
 * timing note below for why that happens during RENDER, not an effect.
 * Escape and a click on the scrim both dismiss. Closing restores focus to
 * whatever opened the modal.
 */
export default function Modal({ label, onClose, maxWidth = 400, children }) {
  const cardRef = useRef(null);
  const openerRef = useRef(null);
  const capturedRef = useRef(false);

  // Captured during RENDER, on the first pass — not in the effect below.
  // React applies a child's `autoFocus` during commit, which runs BEFORE
  // effects, so an effect-time read of `document.activeElement` can return
  // whatever won the commit instead of the control that opened this modal.
  // See ProfileCard.jsx for the production regression (PR #148) this guards.
  if (!capturedRef.current) {
    capturedRef.current = true;
    openerRef.current = document.activeElement;
  }

  useEffect(() => {
    cardRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // This is a modal — a scrim covers the page and aria-modal tells assistive
  // tech the rest of the document is inert — so Tab has to stay inside it.
  useFocusTrap(cardRef, true);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-scrim-in"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.scrim,
        zIndex: Z.modal,
        padding: SPACE[4],
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className="modal-card-in"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card,
          padding: `${SPACE[6]}px`,
          borderRadius: RADIUS.md,
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          maxWidth,
          maxHeight: '85vh',
          overflowY: 'auto',
          color: COLORS.ink,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            float: 'right',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.mute,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
