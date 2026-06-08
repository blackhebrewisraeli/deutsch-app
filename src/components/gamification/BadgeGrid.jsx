import { ACHIEVEMENTS } from '../../lib/gamification';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../../lib/theme';

// All achievements as tiles: earned = full color, locked = greyed.
// `achievements` is the persisted { id: unlockedTs } map.
export default function BadgeGrid({ achievements }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: SPACE[3],
      }}
    >
      {ACHIEVEMENTS.map((a) => {
        const earned = !!achievements?.[a.id];
        return (
          <div
            key={a.id}
            title={a.name}
            style={{
              borderRadius: RADIUS.md,
              boxShadow: earned ? SHADOW.card : 'none',
              background: earned ? COLORS.card : COLORS.paperDeep,
              opacity: earned ? 1 : 0.55,
              padding: SPACE[4],
              textAlign: 'center',
              filter: earned ? 'none' : 'grayscale(1)',
            }}
          >
            <div style={{ fontSize: 30 }}>{a.icon}</div>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.base,
                fontWeight: 600,
                color: COLORS.ink,
                marginTop: SPACE[1],
              }}
            >
              {a.name}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 9,
                letterSpacing: LETTER_SPACING.caps,
                color: COLORS.mute,
                marginTop: 2,
              }}
            >
              {earned ? 'FREIGESCHALTET' : 'GESPERRT'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
