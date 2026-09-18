import { useEffect, useState } from 'react';
import { fetchAdminMe } from './adminApi.js';

const EMPTY = { status: 'idle', me: null };

/**
 * Server-computed flags for the signed-in user. Permission is never read from
 * localStorage, profile rows, or user_metadata — only from GET admin?op=me.
 *
 * `user` going null (sign-out / account switch) clears state synchronously so
 * admin chrome cannot survive the previous session.
 */
export function useAdminSession(user) {
  const [state, setState] = useState(EMPTY);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      return undefined;
    }

    let active = true;
    setState({ status: 'loading', me: null });
    fetchAdminMe()
      .then((me) => {
        if (!active) return;
        setState({
          status: 'ready',
          me: {
            isAdmin: Boolean(me?.isAdmin),
            isSystemAccount: Boolean(me?.isSystemAccount),
            blocked: Boolean(me?.blocked),
          },
        });
      })
      .catch(() => {
        if (!active) return;
        // Fail closed: no admin chrome on a failed probe.
        setState({
          status: 'error',
          me: { isAdmin: false, isSystemAccount: false, blocked: false },
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}
