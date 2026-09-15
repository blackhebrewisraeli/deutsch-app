import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { Grid, Row } from './ui/Layout';
import InteractiveCard from './ui/InteractiveCard';
import { activePack } from '../packs';
import { resolveRecommended } from './resolveRecommended';

// Two next-action cards under the personal hub.
//
// Home used to list every open mission in one board. The top two are the
// ones a returning learner should take now, so they sit above the fold as
// cards rather than as a list, with pack fallbacks so the layout never
// collapses to an empty state on a quiet day. Dense on purpose: the hub
// already spent the glance, so these are a short hop, not a second hero.
export default function RecommendedActions({ missions = [], onGo }) {
  const chrome = activePack.content.homeChrome ?? {};
  const { cards } = resolveRecommended(missions);
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="recommended-heading">
      <div
        id="recommended-heading"
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
          marginBottom: SPACE[3],
        }}
      >
        {chrome.recommendedHeading}
      </div>
      <Grid columns="auto-fit" min={240} gap={3}>
        {cards.map((card) => (
          <InteractiveCard
            key={card.id}
            elevation={2}
            onClick={() => onGo?.(card.tab, card.mission)}
            aria-label={card.text}
            style={{ padding: `${SPACE[3]}px ${SPACE[4]}px` }}
          >
            <Row wrap={false} gap={3} align="center">
              <span aria-hidden="true" style={{ fontSize: FONT_SIZE.xl, flexShrink: 0 }}>
                {card.icon}
              </span>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.lg,
                  fontWeight: FONT_WEIGHT.bold,
                  color: COLORS.ink,
                  overflowWrap: 'anywhere',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {card.text}
              </span>
            </Row>
          </InteractiveCard>
        ))}
      </Grid>
    </section>
  );
}
