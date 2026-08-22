import { createContext, useContext, useEffect, useId, useMemo, useRef } from 'react';

// Lets a tab declare "I am holding practice state that a level switch would
// throw away", so the header control can ask before doing it.
//
// A REGISTRY keyed on a mounted component, not a prop or a callback handed up
// to App. TranslateTab is keyed by level and conditionally rendered, so it
// unmounts constantly — on every tab switch and on every level change. A flag
// pushed upward would be left behind as a stale `true` by exactly those
// unmounts, and the app would then start asking about a session that no
// longer exists. Registration is unmount-driven, so a tab that goes away
// silently stops claiming anything.
//
// This also means StatsTab's own switcher needs no special case: when the
// learner is on Stats, TranslateTab is not mounted, so nothing is registered
// and nothing is asked.
export const SessionGuardContext = createContext(null);

/**
 * Build the guard value. App holds this and renders the Provider itself —
 * this module deliberately exports no component, so the whole file stays
 * hook-only and React Fast Refresh keeps working for it.
 */
export function useSessionGuardValue() {
  // A ref, not state: registering must never re-render the holder (App owns
  // the whole tree). Nothing renders off this — it is only ever read at the
  // moment the learner tries to switch.
  const entries = useRef(new Map());

  return useMemo(
    () => ({
      set: (id, label) => {
        if (label) entries.current.set(id, label);
        else entries.current.delete(id);
      },
      clear: (id) => entries.current.delete(id),
      // The first live claim, or null. A string rather than a boolean so the
      // confirmation can say what is actually at stake instead of a generic
      // "you may lose progress".
      activeSession: () => {
        for (const label of entries.current.values()) if (label) return label;
        return null;
      },
    }),
    []
  );
}

/**
 * Read the guard. Returns null outside a provider so a component can be
 * rendered standalone (a test, a story) without one.
 */
export function useSessionGuard() {
  return useContext(SessionGuardContext);
}

/**
 * Declare this component's throwaway-on-switch state.
 *
 * @param label human-readable description of what is in progress
 *              ("exercise 4 of 10"), or null/'' when there is nothing to lose.
 */
export function useDirtySession(label) {
  const guard = useContext(SessionGuardContext);
  const id = useId();
  useEffect(() => {
    if (!guard) return undefined;
    guard.set(id, label);
    return () => guard.clear(id);
  }, [guard, id, label]);
}
