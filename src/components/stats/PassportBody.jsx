import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
} from '../../lib/theme.js';
import { TIER_NAMES } from '../../lib/leagues.js';
import { ACHIEVEMENTS } from '../../lib/gamification';
import Avatar from '../ui/Avatar';

// The Learning Passport — everything inside ProfileCard's dialog chrome.
//
// Split out from ProfileCard on purpose. That component owns a focus trap, an
// opener-restore that has already been got wrong once in this codebase, and a
// load/error state machine; none of that wanted to be re-read every time the
// LAYOUT changes. This file is pure presentation over a fetched row and can be
// rendered in a test without a modal, a fetch, or a focus trap.
//
// ONE CARD, TWO AUDIENCES. Nothing here branches on self-vs-other except the
// "This is you" marker. A passport that showed different FACTS depending on who
// was reading would be two components wearing one name, and the numbers a
// competitor sees ought to be the numbers you see.

/** Badge metadata by id. The endpoint returns ids only — names and icons are
 *  copy, and copy stays on the client where the pack lives. An id the client
 *  does not recognise (an older app meeting a newer badge) is skipped rather
 *  than rendered as a blank chip. */
const BADGES = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

const labelStyle = {
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  letterSpacing: LETTER_SPACING.caps,
  color: COLORS.mute,
  textTransform: 'uppercase',
};

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.lg,
          fontWeight: FONT_WEIGHT.bold,
          color: COLORS.ink,
          // Long numbers must shrink the column, not widen the card past a
          // 320px viewport.
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function PassportBody({ profile, userId, isSelf = false }) {
  const badges = (profile.achievements ?? []).map((id) => BADGES.get(id)).filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], minWidth: 0 }}>
        <Avatar profile={profile} userId={userId} size={56} />
        <div style={{ minWidth: 0 }}>
          {/* Handles are user-supplied and can be one long unbroken token,
              which normal wrapping refuses to break. */}
          <h3
            style={{
              margin: 0,
              fontSize: FONT_SIZE.lg,
              overflowWrap: 'anywhere',
              color: COLORS.ink,
            }}
          >
            {profile.handle ?? 'Anonym'}
          </h3>
          <div style={{ ...labelStyle, textTransform: 'none' }}>
            {TIER_NAMES[profile.tier]}
            {profile.join_year ? ` · seit ${profile.join_year}` : ''}
          </div>
          {isSelf && (
            <div
              // A slow accent glow, defined in injectGlobalStyles. It is the
              // one element on the card that is about WHO is reading rather
              // than what the numbers say, so it earns a treatment nothing
              // else here has — and it is decoration over text that is already
              // legible without it, which is why it can be a glow and not a
              // colour change. Reduced motion holds it at its dimmest frame
              // rather than removing it: the marker still has to mark.
              className="self-glow"
              style={{
                marginTop: SPACE[1],
                display: 'inline-block',
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                // NOT accentBlack. That token is documented as "identity
                // chrome that must not invert with the theme" and is #1A1816 in
                // BOTH modes — correct for a masthead on paper, and invisible
                // for a pill on a dark card, which is exactly how it looked.
                // surface2/borderStrong adapt, so this reads in either theme by
                // construction rather than by a colour chosen for one of them.
                background: COLORS.surface2,
                border: `1px solid ${COLORS.borderStrong}`,
                color: COLORS.ink,
                fontWeight: FONT_WEIGHT.bold,
                padding: `2px ${SPACE[2]}px`,
                borderRadius: RADIUS.pill,
              }}
            >
              This is you
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          // Three columns that can each shrink to nothing rather than pushing
          // the card wide; auto-fit keeps them on one row when there is room.
          gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
          gap: SPACE[3],
          marginTop: SPACE[5],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <Stat label="XP" value={profile.total_xp ?? 0} />
        <Stat label="Streak" value={`${profile.longest_streak ?? 0}d`} />
        <Stat label="Ligasiege" value={profile.league_wins ?? 0} />
      </div>

      <div
        style={{
          marginTop: SPACE[5],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ ...labelStyle, marginBottom: SPACE[2] }}>
          Abzeichen {badges.length > 0 ? `· ${badges.length}` : ''}
        </div>
        {badges.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
            }}
          >
            {isSelf ? 'Noch keine — üben lohnt sich.' : 'Noch keine Abzeichen.'}
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: SPACE[2],
            }}
          >
            {badges.map((b) => (
              <li
                key={b.id}
                data-badge={b.id}
                // The name is the accessible text; the emoji is decoration
                // beside it, so it must not be announced twice.
                //
                // badge-chip is a hover lift, gated on a fine pointer by the
                // global sheet — a phone would otherwise latch the lifted
                // state on tap and keep it. Deliberately quieter than a
                // button's hover: no pointer cursor and no colour change,
                // because a chip that looks pressable and does nothing when
                // pressed is a worse bargain than one that never invited it.
                className="badge-chip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE[1],
                  background: COLORS.surface2,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.pill,
                  padding: `${SPACE[1]}px ${SPACE[2]}px`,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  color: COLORS.ink,
                }}
              >
                <span aria-hidden="true">{b.icon}</span>
                {b.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
