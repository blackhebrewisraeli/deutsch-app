import { useEffect, useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, SPACE } from '../../lib/theme';
import { Stack, Row } from '../ui/Layout';
import Button from '../ui/Button';
import Surface from '../ui/Surface';
import { Body, Meta } from '../ui/Text';
import { fetchAdminUsers, setUserBlocked } from '../../lib/adminApi.js';

export default function UserList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchAdminUsers();
      setItems(payload?.items ?? []);
    } catch (err) {
      setError(err.message ?? 'Could not load users.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await fetchAdminUsers();
        if (!active) return;
        setItems(payload?.items ?? []);
      } catch (err) {
        if (!active) return;
        setError(err.message ?? 'Could not load users.');
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onBlock = async (user, blocked) => {
    if (pending !== user.userId) {
      setPending(user.userId);
      return;
    }
    setBusyId(user.userId);
    setError('');
    try {
      await setUserBlocked(user.userId, blocked);
      setPending(null);
      await load();
    } catch (err) {
      setError(err.message ?? 'Could not update block state.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack gap={4}>
      {error ? (
        <Body tone="error" style={{ overflowWrap: 'anywhere' }}>
          {error}
        </Body>
      ) : null}
      {loading ? <Meta>Loading…</Meta> : null}
      {!loading && items.length === 0 ? <Meta>No users.</Meta> : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: SPACE[3],
        }}
      >
        {items.map((user) => (
          <Surface key={user.userId} elevation={1} padding={4} style={{ minWidth: 0 }}>
            <Stack gap={3}>
              <Body style={{ overflowWrap: 'anywhere', margin: 0 }}>
                {user.email ?? user.userId}
              </Body>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  color: COLORS.mute,
                  overflowWrap: 'anywhere',
                }}
              >
                {user.handle ? `@${user.handle} · ` : ''}
                {user.providers?.length ? `${user.providers.join(', ')} · ` : ''}
                {user.userId}
              </div>
              <Row gap={2} wrap>
                {user.isAdmin ? <Meta>admin</Meta> : null}
                {user.isSystemAccount ? <Meta>system</Meta> : null}
                {user.blockedAt ? <Meta tone="error">blocked</Meta> : null}
              </Row>
              {user.isAdmin ? (
                <Meta>Admin accounts cannot be blocked.</Meta>
              ) : (
                <Button
                  variant={user.blockedAt ? 'secondary' : 'danger'}
                  busy={busyId === user.userId}
                  onClick={() => onBlock(user, !user.blockedAt)}
                >
                  {pending === user.userId
                    ? user.blockedAt
                      ? 'Confirm unblock'
                      : 'Confirm block'
                    : user.blockedAt
                      ? 'Unblock'
                      : 'Block'}
                </Button>
              )}
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
