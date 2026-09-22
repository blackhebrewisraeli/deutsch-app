import { useEffect, useState } from 'react';

/**
 * `value`, but only after it has stopped changing for `delay` ms.
 *
 * Search sends one request per settled term rather than one per keystroke:
 * typing "sprechen" is eight renders and one query. The timer is cleared on
 * every change, so an interrupted burst never fires the intermediate term.
 *
 * The cleanup also runs on unmount, which is what stops a request being
 * scheduled for a box that is no longer on screen.
 */
export function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return settled;
}
