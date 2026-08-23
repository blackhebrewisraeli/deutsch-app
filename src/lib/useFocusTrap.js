import { useEffect } from 'react';

// Tab stops the trap cycles through. `[tabindex="-1"]` is excluded on purpose:
// a trapped container carries -1 so it can be focused programmatically on open,
// and it must not become a stop of its own.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab inside `ref` while `active`.
 *
 * Three dialogs converged on byte-identical wrapping logic — ProfileCard (#144),
 * AuthSheet (#145) and the AuthCallbackLanding error panel (#146) — so it lives
 * here once. What is deliberately NOT here is the policy around it: which of
 * them moves focus in, whether focus is restored to an opener on close, and
 * whether Escape dismisses. Those genuinely differ per dialog (AuthSheet must
 * not steal focus from GoogleButton's autoFocus; AuthCallbackLanding has no
 * opener to return to and is not dismissible), and folding them in as option
 * flags would trade three honest copies for one component with a policy matrix.
 *
 * This is for MODAL surfaces only. The three header sheets are non-modal
 * popovers — `aria-haspopup="dialog"` with no `aria-modal` and no scrim — where
 * trapping Tab would be wrong, and they must not adopt this.
 *
 * Note `active` exists because two of the three callers keep the hook mounted
 * while the surface is closed: AuthSheet renders null rather than unmounting,
 * and AuthCallbackLanding traps only on its actionable phase.
 */
export default function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const container = ref.current;
      if (!container) return;
      const stops = container.querySelectorAll(FOCUSABLE);
      if (stops.length === 0) {
        // Nothing to land on — an error state can render no controls at all.
        e.preventDefault();
        container.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = document.activeElement;
      if (e.shiftKey) {
        // The container is the entry point dialogs focus on open, so going
        // backwards off it wraps just as it would from the first real stop.
        if (here === first || here === container) {
          e.preventDefault();
          last.focus();
        }
      } else if (here === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ref, active]);
}
