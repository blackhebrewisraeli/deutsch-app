import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { FONTS, FONT_SIZE, FONT_WEIGHT, SPACE } from '../../lib/theme';
import { listFollows } from '../../lib/social.js';
import { useFollowToggle } from '../../lib/useFollowToggle.js';
import Modal from '../ui/Modal';
import StatusNote from '../ui/StatusNote';
import Button from '../ui/Button';
import { UserSearchRow } from './UserSearch';

const TITLE = { followers: 'Follower', following: 'Folgt' };
const EMPTY_TEXT = {
  followers: 'No followers yet.',
  following: 'Not following anyone yet.',
};

/**
 * The self-only followers/following list opened from the Profile card's
 * "Follower" / "Folgt" counts. Rows are the same UserSearchRow the search
 * modal renders — same avatar/name/handle layout, same Follow/Unfollow
 * button — so a person looks identical whether you found them by typing or by
 * opening this list.
 */
export default function FollowListModal({ kind, onClose }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | done | error
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bumped by Retry to re-run the load effect without remounting the modal.
  const [nonce, setNonce] = useState(0);
  // Not state: advancing it must not itself trigger a render, and nothing
  // reads it to decide what to draw — only loadMore's next call does.
  const offsetRef = useRef(0);

  const { pending, toggle } = useFollowToggle(setRows);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    offsetRef.current = 0;

    listFollows(kind)
      .then(({ results, hasMore: more }) => {
        if (cancelled) return;
        setRows(results);
        setHasMore(more);
        offsetRef.current = results.length;
        setStatus('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Could not load that list.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [kind, nonce]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const { results, hasMore: more } = await listFollows(kind, { offset: offsetRef.current });
      setRows((prev) => [...prev, ...results]);
      offsetRef.current += results.length;
      setHasMore(more);
    } catch (err) {
      setError(err?.message ?? 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggle = async (row) => {
    setError(null);
    const message = await toggle(row);
    if (message) setError(message);
  };

  return (
    <Modal label={TITLE[kind]} onClose={onClose} maxWidth={440}>
      <h2
        style={{
          margin: `0 0 ${SPACE[4]}px`,
          fontFamily: FONTS.body,
          fontSize: FONT_SIZE.lg,
          fontWeight: FONT_WEIGHT.bold,
        }}
      >
        {TITLE[kind]}
      </h2>

      {/* One live region for the whole outcome — see UserSearch for the same
          reasoning: announcing each row separately reads the list twice. */}
      <div aria-live="polite">
        {status === 'loading' && (
          <p
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              textTransform: 'uppercase',
            }}
          >
            Loading…
          </p>
        )}

        {status === 'error' && (
          <StatusNote
            tone="error"
            icon={AlertTriangle}
            action={{ label: 'Retry', onClick: () => setNonce((n) => n + 1) }}
          >
            {error}
          </StatusNote>
        )}

        {status === 'done' && rows.length === 0 && (
          <StatusNote tone="empty" icon={Users}>
            {EMPTY_TEXT[kind]}
          </StatusNote>
        )}

        {rows.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: SPACE[2],
              minWidth: 0,
            }}
          >
            {rows.map((row) => (
              <UserSearchRow
                key={row.user_id}
                row={row}
                busy={Boolean(pending[row.user_id])}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        )}
      </div>

      {status !== 'error' && error && (
        <p
          role="alert"
          style={{ marginTop: SPACE[3], fontFamily: FONTS.body, fontSize: FONT_SIZE.sm }}
        >
          {error}
        </p>
      )}

      {hasMore && (
        <div style={{ marginTop: SPACE[4], display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" busy={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </Modal>
  );
}
