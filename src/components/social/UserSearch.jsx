import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, SearchX, UserCheck, UserPlus } from 'lucide-react';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
  SPACE,
} from '../../lib/theme';
import { isSearchable, searchUsers } from '../../lib/social.js';
import { useDebouncedValue } from '../../lib/useDebouncedValue.js';
import { useFollowToggle } from '../../lib/useFollowToggle.js';
import { profileName } from '../../lib/profile.js';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { SectionLabel } from '../UI';
import StatusNote from '../ui/StatusNote';

/** One settled term per burst of typing, not one request per keystroke. */
export const DEBOUNCE_MS = 300;

/** Bigger than the 40 an inline identity row uses — here the face IS the result. */
const AVATAR_SIZE = 48;

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Find people by handle or display name, and follow them.
 *
 * Lives inside the Profile tab rather than behind a nav slot of its own: the
 * nav already carries six items, seven for a verified admin, and that seventh
 * was measured to fit 320px with no slack left. An eighth would overflow the
 * narrowest supported viewport, so "prominently inside Social/Profile" is the
 * placement the budget actually allows.
 */
export default function UserSearch({ mobile = false, num = '✱' }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const { pending, toggle } = useFollowToggle(setResults);

  const settled = useDebouncedValue(term, DEBOUNCE_MS);

  // Monotone request id. Typing "sam" then "sami" can resolve out of order, and
  // the LAST response to arrive is not necessarily the last one asked for — so
  // a resolution only counts if nothing newer has been issued since.
  //
  // Deliberately not an unmount guard: React 18 no-ops a setState after
  // unmount anyway, so an unmount test cannot tell a present guard from a
  // missing one. Superseding is the condition that actually has an effect.
  const issued = useRef(0);

  useEffect(() => {
    const trimmed = settled.trim();

    if (!isSearchable(trimmed)) {
      // Emptying the box supersedes anything in flight, so a late response to
      // the term just deleted cannot repopulate a list the learner cleared.
      issued.current += 1;
      setResults([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const seq = issued.current + 1;
    issued.current = seq;
    setStatus('searching');
    setError(null);

    searchUsers(trimmed)
      .then((rows) => {
        if (seq !== issued.current) return;
        setResults(rows);
        setStatus('done');
      })
      .catch((err) => {
        if (seq !== issued.current) return;
        setError(err?.message ?? 'Could not search right now.');
        setStatus('error');
      });
  }, [settled]);

  // The optimistic flip-then-reconcile logic lives in useFollowToggle, shared
  // with the followers/following list modal — this wrapper only owns what is
  // specific to a search box: clearing a stale error before a fresh attempt.
  const toggleFollow = useCallback(
    async (row) => {
      setError(null);
      const message = await toggle(row);
      if (message) setError(message);
    },
    [toggle]
  );

  const showEmpty = status === 'done' && results.length === 0;

  return (
    // aria-label rather than aria-labelledby: the page's SectionLabel is a
    // numbered row, not a heading element, so naming the region directly is
    // the honest markup.
    <section aria-label="Find people" style={{ minWidth: 0 }}>
      <SectionLabel num={num} text="Find people" />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          minWidth: 0,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.inset,
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
        }}
      >
        <Search size={16} aria-hidden="true" color={COLORS.mute} />
        <span style={visuallyHidden}>Search people by name or handle</span>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={mobile ? 'Name or @handle' : 'Search people — name or @handle'}
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.md,
            color: COLORS.ink,
          }}
        />
      </label>

      {/* One live region for the whole outcome. Announcing each row separately
          would read the list twice — once as it renders, once as it changes. */}
      <div aria-live="polite" style={{ minWidth: 0 }}>
        {status === 'searching' && (
          <p
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              textTransform: 'uppercase',
              color: COLORS.mute,
              marginTop: SPACE[3],
            }}
          >
            Searching…
          </p>
        )}

        {status === 'error' && error && (
          <StatusNote tone="error" icon={SearchX} style={{ marginTop: SPACE[4] }}>
            {error}
          </StatusNote>
        )}

        {showEmpty && (
          <StatusNote tone="empty" icon={SearchX} style={{ marginTop: SPACE[4] }}>
            Nobody matches “{settled.trim()}”.
          </StatusNote>
        )}

        {results.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: `${SPACE[4]}px 0 0`,
              padding: 0,
              display: 'grid',
              gap: SPACE[2],
              minWidth: 0,
            }}
          >
            {results.map((row) => (
              <UserSearchRow
                key={row.user_id}
                row={row}
                busy={Boolean(pending[row.user_id])}
                onToggle={toggleFollow}
              />
            ))}
          </ul>
        )}
      </div>

      {/* The follow write can fail while results are still on screen, so the
          error surface above is not the only one that needs to speak. */}
      {status !== 'error' && error && (
        <p
          role="alert"
          style={{
            marginTop: SPACE[3],
            color: COLORS.red,
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.sm,
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}

export function UserSearchRow({ row, busy, onToggle }) {
  const name = profileName(row);
  const following = Boolean(row.is_following);

  return (
    <li
      style={{
        display: 'grid',
        // minmax(0, 1fr) and never a bare 1fr: a bare track keeps
        // min-width:auto, so a long display name would push the row — and the
        // page — wider than a 320px viewport instead of ellipsing.
        gridTemplateColumns: `${AVATAR_SIZE}px minmax(0, 1fr) auto`,
        alignItems: 'center',
        gap: SPACE[3],
        minWidth: 0,
        padding: SPACE[3],
        background: COLORS.card,
        border: BORDER.panel,
        borderRadius: RADIUS.md,
      }}
    >
      <Avatar profile={row} userId={row.user_id} size={AVATAR_SIZE} />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.md,
            fontWeight: FONT_WEIGHT.bold,
            color: COLORS.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        {/* Only when it adds something. When there is no display name,
            profileName already returned the handle and this would print it
            twice. */}
        {row.handle && name !== row.handle && (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.sm,
              color: COLORS.mute,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            @{row.handle}
          </div>
        )}
      </div>

      <Button
        variant={following ? 'secondary' : 'primary'}
        size="sm"
        busy={busy}
        onClick={() => onToggle(row)}
        // The visible word is "Follow"; the accessible name says who, because a
        // list of identical buttons is unnavigable by name alone.
        aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
        aria-pressed={following}
      >
        {following ? (
          <UserCheck size={14} aria-hidden="true" />
        ) : (
          <UserPlus size={14} aria-hidden="true" />
        )}
        <span style={{ marginLeft: SPACE[1] }}>{following ? 'Following' : 'Follow'}</span>
      </Button>
    </li>
  );
}
