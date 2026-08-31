import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACE } from '../lib/theme';
import Surface from './ui/Surface';
import { Row, Stack } from './ui/Layout';
import Heading from './ui/Heading';
import { Meta } from './ui/Text';
import { activePack } from '../packs';
import { isAuthConfigured } from '../lib/auth.js';
import Avatar from './ui/Avatar';

// Who you are, at the top of Home.
//
// Read-only on purpose. HomeTab's own design (decision E5) keeps account
// MANAGEMENT — email, sign out, export, danger zone — exclusive to Settings,
// and that exclusion stands: this is identity, not administration. The single
// interactive element is the link into Settings.
//
// The level chip is deliberately a static badge rather than the header's
// StatusChip: level lives in ONE control, and a second switcher here would be
// the fork that PR #151's level-clobber fix exists to prevent.
export default function IdentityStrip({ user, profile, lvl, onOpenSettings }) {
  const copy = activePack.content.identity ?? {};

  // The league handle, then the email's local part. `display_name` used to sit
  // at the front of this chain; it was written by a form nobody filled in and
  // was null for every account, so the chain always fell through it. `handle`
  // is the one name: it is unique, it is denormalised onto league_members, and
  // it is what other learners already see on the leaderboard.
  //
  // A guest has neither and is greeted without a name rather than with a
  // placeholder that implies an account.
  const name = user ? (profile?.handle ?? user.email?.split('@')[0] ?? null) : null;

  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const showsAccountLine = Boolean(user);

  return (
    <Surface elevation={1} padding={4}>
      <Row align="center" gap={4}>
        <Avatar profile={profile} userId={user?.id} size={40} />

        {/* minmax(0, 1fr) semantics: this column must be allowed to shrink, or
            a long display name pushes the chip off a 320px screen. */}
        <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
          <Heading level={2} style={{ margin: 0 }}>
            {copy.greeting?.(name)}
          </Heading>
          {showsAccountLine && (
            <Meta
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {[
                profile?.handle ? `@${profile.handle}` : null,
                createdAt ? copy.memberSince?.(createdAt) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Meta>
          )}
        </Stack>

        <span
          aria-label={copy.levelLabel?.(String(lvl ?? '').toUpperCase())}
          style={{
            flexShrink: 0,
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.ink,
            border: `1px solid ${COLORS.mute}`,
            borderRadius: RADIUS.sm,
            padding: `${SPACE[1]}px ${SPACE[2]}px`,
          }}
        >
          {String(lvl ?? '').toUpperCase()}
        </span>
      </Row>

      {/* Only shown when there is an account to manage, and only when there is
          a backend to manage it against — AccountChip and AccountSection make
          the same check, so an unreachable Settings link never appears. */}
      {showsAccountLine && isAuthConfigured() && (
        <div style={{ marginTop: SPACE[3] }}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
              textDecoration: 'underline',
            }}
          >
            {copy.settingsLink} →
          </button>
        </div>
      )}
    </Surface>
  );
}
