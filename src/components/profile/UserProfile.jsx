import { useEffect, useState } from 'react';
import { Shield, Users, UserPlus, Flame, Sparkles, GraduationCap } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
} from '../../lib/theme';
import { TIER_NAMES, LEAGUES_ENABLED, fetchProfile } from '../../lib/leagues.js';
import { profileName } from '../../lib/profile.js';
import Avatar from '../ui/Avatar';
import Surface from '../ui/Surface';
import Heading from '../ui/Heading';
import Button from '../ui/Button';
import StatusNote from '../ui/StatusNote';
import LeaderboardSection from '../stats/LeaderboardSection';

// The Profile tab — ONE page.
//
// It replaced a segmented control (STATS / LEAGUES / SETTINGS) that split one
// identity across three destinations, so that the page a learner thinks of as
// "me" never showed who they were, what league they were in, and how they were
// doing at the same time. Nothing here may reintroduce a sub-tab; the guard is
// in UserProfile.test.jsx.
//
// Settings did NOT move into this page. It is a route (`#/settings`) reached
// from the account sheet, which #314 made the one door to it. StatsTab still
// renders the settings panel for that route; this component is what the tab
// shows otherwise.
//
// READING ORDER, top to bottom: who you are → the numbers → your league →
// the standings → the detailed charts. The charts used to open the tab, which
// is why it read as an analytics dashboard rather than a profile.

const labelStyle = {
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  letterSpacing: LETTER_SPACING.caps,
  color: COLORS.mute,
  textTransform: 'uppercase',
};

/**
 * One metric. Deliberately flat-bottomed and quiet: five of these sit in a row
 * and any per-card decoration multiplies by five.
 */
function Metric({ icon: Icon, label, value }) {
  return (
    <Surface
      elevation={1}
      padding={3}
      radius="lg"
      // minWidth:0 is what lets the track actually shrink. Without it a long
      // value (a five-digit XP total) holds the column open and pushes the
      // grid past a 320px viewport.
      style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE[1] }}
    >
      <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
        <Icon size={12} aria-hidden="true" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.lg,
          fontWeight: FONT_WEIGHT.bold,
          color: COLORS.ink,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </Surface>
  );
}

export default function UserProfile({
  user,
  local = {},
  onSignIn,
  onSelectUser,
  onOpenSettings,
  mobile = false,
  children = null,
}) {
  const [profile, setProfile] = useState(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return undefined;
    let live = true;
    // A failed social fetch must not blank the page: the XP, level and streak
    // below come from localStorage and are still true offline. So the error is
    // swallowed into "no social row" rather than raised into an error state.
    fetchProfile(userId)
      .then((row) => {
        if (live) setProfile(row ?? null);
      })
      .catch(() => {
        if (live) setProfile(null);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  // Spec §9: a guest gets an explanation and a way in, never a profile full of
  // zeroes that reads as a real account with no progress.
  //
  // But only the SOCIAL half is withheld. A guest's XP, streak and charts come
  // from localStorage and are entirely real — an early return that dropped
  // `children` took the whole practice dashboard away from everyone who had
  // not signed in, which is most of the people who open this tab.
  if (!user) {
    return (
      <div style={{ display: 'grid', gap: SPACE[6] }}>
        <div style={{ display: 'grid', gap: SPACE[4], justifyItems: 'start' }}>
          <Heading level={2}>Dein Profil</Heading>
          <StatusNote>
            Sign in to keep your progress, earn badges and join a weekly league.
          </StatusNote>
          <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
            <Button onClick={onSignIn}>Sign in</Button>
            {/* A guest still needs Settings — level, daily goal and sound all
                live there, and none of them require an account. The segmented
                control this page replaced was their ONLY way in; the account
                sheet is not, because a signed-out header shows "Sign in" and
                no sheet at all. */}
            {onOpenSettings && (
              <Button variant="secondary" onClick={onOpenSettings}>
                Settings
              </Button>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  const name = profileName(profile);
  const handle = profile?.handle ?? null;
  const showHandle = Boolean(handle) && name !== handle;
  const avatarSize = mobile ? 112 : 144;

  return (
    <div style={{ display: 'grid', gap: SPACE[6] }}>
      {/* ── Identity ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: SPACE[2],
          minWidth: 0,
        }}
      >
        <Avatar profile={profile ?? {}} userId={userId} size={avatarSize} />
        {/* Handles and display names are user-supplied and can be one long
            unbroken token, which normal wrapping refuses to break. */}
        <Heading level={1} size="xl" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {name}
        </Heading>
        {showHandle && (
          <div style={{ ...labelStyle, textTransform: 'none', overflowWrap: 'anywhere' }}>
            @{handle}
          </div>
        )}
        {profile?.join_year && (
          <div style={{ ...labelStyle, textTransform: 'none' }}>
            Mitglied seit {profile.join_year}
          </div>
        )}
        {/* Spec §8: the self profile carries a SECONDARY edit action. It is
            also, since the segmented control went, the signed-in route into
            Settings from this page — the same destination the account sheet
            opens. */}
        {onOpenSettings && (
          <Button variant="secondary" onClick={onOpenSettings} style={{ marginTop: SPACE[2] }}>
            Edit profile
          </Button>
        )}
      </div>

      {/* ── Metrics ──────────────────────────────────────────────
          Social counts and progress in ONE band. They were previously on
          different screens, which is why the tab never answered "how am I
          doing" in a single glance. */}
      <div
        data-testid="profile-metrics"
        style={{
          display: 'grid',
          // auto-fit + minmax(0, …) so the row reflows to two columns at
          // 320px instead of overflowing. A bare 1fr would refuse to shrink.
          gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
          gap: SPACE[3],
        }}
      >
        <Metric icon={Sparkles} label="XP" value={local.xp ?? profile?.total_xp ?? 0} />
        <Metric icon={GraduationCap} label="Level" value={(local.level ?? 'a1').toUpperCase()} />
        <Metric icon={Flame} label="Streak" value={`${local.streak ?? 0}d`} />
        <Metric icon={Users} label="Follower" value={profile?.followers_count ?? 0} />
        <Metric icon={UserPlus} label="Folgt" value={profile?.following_count ?? 0} />
      </div>

      {LEAGUES_ENABLED && (
        <>
          {/* ── League ───────────────────────────────────────────
              The one expressive element on the page (spec §8): a shield, the
              tier name, and what it is worth so far. */}
          <Surface
            elevation={2}
            padding={4}
            radius="xl"
            data-testid="profile-league"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[3],
              minWidth: 0,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: RADIUS.pill,
                background: COLORS.surface2,
                border: `1px solid ${COLORS.borderStrong}`,
                color: COLORS.ink,
              }}
            >
              <Shield size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>Liga</div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.lg,
                  fontWeight: FONT_WEIGHT.bold,
                  color: COLORS.ink,
                  overflowWrap: 'anywhere',
                }}
              >
                {TIER_NAMES[profile?.tier ?? 0]}
              </div>
              <div style={{ ...labelStyle, textTransform: 'none' }}>
                {profile?.league_wins ? `${profile.league_wins} Ligasiege` : 'Noch kein Ligasieg'}
              </div>
            </div>
          </Surface>

          {/* The full standings, in the main column — not behind a sub-tab. */}
          <LeaderboardSection onSelectUser={onSelectUser} />
        </>
      )}

      {/* ── Secondary: the detailed charts ───────────────────────
          Last, deliberately. These are the dense analytics that used to BE
          the Profile tab. */}
      {children}
    </div>
  );
}
