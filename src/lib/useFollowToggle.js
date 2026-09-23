import { useCallback, useState } from 'react';
import { followUser, unfollowUser } from './social.js';

/**
 * Flip a row's `is_following` NOW, reconcile after — shared by every place a
 * list of people carries a Follow/Unfollow button (UserSearch, and any
 * followers/following list), so the rollback-on-failure logic exists once.
 *
 * The write is idempotent on the server — following twice is the same state
 * as following once — so the only case that has to undo itself is a genuine
 * failure, and that restores the value the server still holds rather than
 * re-fetching the whole list.
 *
 * @param {(updater: (rows: Array) => Array) => void} setRows
 * @returns {{ pending: Record<string, boolean>, toggle: (row) => Promise<string|null> }}
 *   `toggle` resolves to an error message on failure, or null on success —
 *   callers decide how (or whether) to surface it.
 */
export function useFollowToggle(setRows) {
  const [pending, setPending] = useState({});

  const toggle = useCallback(
    async (row) => {
      const next = !row.is_following;
      const id = row.user_id;

      setRows((prev) => prev.map((r) => (r.user_id === id ? { ...r, is_following: next } : r)));
      setPending((prev) => ({ ...prev, [id]: true }));

      try {
        await (next ? followUser(id) : unfollowUser(id));
        return null;
      } catch (err) {
        setRows((prev) => prev.map((r) => (r.user_id === id ? { ...r, is_following: !next } : r)));
        return err?.message ?? 'Could not save that.';
      } finally {
        setPending((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
      }
    },
    [setRows]
  );

  return { pending, toggle };
}
