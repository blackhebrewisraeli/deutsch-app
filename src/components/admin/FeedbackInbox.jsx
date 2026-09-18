import { useEffect, useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, SPACE, RADIUS } from '../../lib/theme';
import { Stack, Row } from '../ui/Layout';
import Button from '../ui/Button';
import Surface from '../ui/Surface';
import { Body, Meta } from '../ui/Text';
import { deleteFeedback, fetchFeedback, updateFeedbackStatus } from '../../lib/adminApi.js';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'handled', label: 'Handled' },
];

export default function FeedbackInbox() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async (nextStatus = status) => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchFeedback(nextStatus || undefined);
      setItems(payload?.items ?? []);
    } catch (err) {
      setError(err.message ?? 'Could not load feedback.');
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
        const payload = await fetchFeedback();
        if (!active) return;
        setItems(payload?.items ?? []);
      } catch (err) {
        if (!active) return;
        setError(err.message ?? 'Could not load feedback.');
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onFilter = (key) => {
    setStatus(key);
    setPendingDelete(null);
    load(key);
  };

  const onStatus = async (id, next) => {
    setBusyId(id);
    setError('');
    try {
      await updateFeedbackStatus(id, next);
      await load(status);
    } catch (err) {
      setError(err.message ?? 'Could not update feedback.');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id) => {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await deleteFeedback(id);
      setPendingDelete(null);
      await load(status);
    } catch (err) {
      setError(err.message ?? 'Could not delete feedback.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack gap={4}>
      <Row gap={2} wrap>
        {FILTERS.map((filter) => (
          <Button
            key={filter.key || 'all'}
            variant={status === filter.key ? 'primary' : 'secondary'}
            aria-pressed={status === filter.key}
            onClick={() => onFilter(filter.key)}
          >
            {filter.label}
          </Button>
        ))}
      </Row>
      {error ? (
        <Body tone="error" style={{ overflowWrap: 'anywhere' }}>
          {error}
        </Body>
      ) : null}
      {loading ? <Meta>Loading…</Meta> : null}
      {!loading && items.length === 0 ? <Meta>No reports.</Meta> : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: SPACE[3],
        }}
      >
        {items.map((row) => (
          <Surface key={row.id} elevation={1} padding={4} style={{ minWidth: 0 }}>
            <Stack gap={3}>
              <Row gap={2} justify="space-between" align="flex-start">
                <Meta>
                  {row.status} · {row.category}
                </Meta>
                <Meta>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</Meta>
              </Row>
              <Body style={{ overflowWrap: 'anywhere', margin: 0 }}>{row.message}</Body>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  color: COLORS.mute,
                  overflowWrap: 'anywhere',
                }}
              >
                {[row.surface, row.cefr_level, row.deck_id, row.item_id]
                  .filter(Boolean)
                  .join(' · ')}
                {row.item_label ? ` · ${row.item_label}` : ''}
                {row.user_id ? ` · ${row.user_id}` : ' · guest'}
              </div>
              <Row gap={2} wrap>
                {row.status !== 'handled' ? (
                  <Button
                    variant="secondary"
                    busy={busyId === row.id}
                    onClick={() => onStatus(row.id, 'handled')}
                  >
                    Mark handled
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    busy={busyId === row.id}
                    onClick={() => onStatus(row.id, 'open')}
                  >
                    Reopen
                  </Button>
                )}
                <Button
                  variant="danger"
                  busy={busyId === row.id}
                  onClick={() => onDelete(row.id)}
                  style={{ borderRadius: RADIUS.md }}
                >
                  {pendingDelete === row.id ? 'Confirm delete' : 'Delete'}
                </Button>
              </Row>
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
