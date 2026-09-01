import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { Grid, Stack } from './ui/Layout';
import InteractiveCard from './ui/InteractiveCard';
import { activePack } from '../packs';
import { resolveRecommended } from './resolveRecommended';

// Two large next-action cards under the personal hub.
//
// Home used to list every open mission in one board. The top two are the
// ones a returning learner should take now, so they sit above the fold as
// cards rather than as a list, with pack fallbacks so the layout never
// collapses to an empty state on a quiet day.
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
      <Grid columns="auto-fit" min={240} gap={4}>
        {cards.map((card) => (
          <InteractiveCard
            key={card.id}
            elevation={2}
            onClick={() => onGo?.(card.tab, card.mission)}
            aria-label={card.text}
            style={{ padding: SPACE[5], minHeight: 96 }}
          >
            <Stack gap={3}>
              <span aria-hidden="true" style={{ fontSize: FONT_SIZE['2xl'] }}>
                {card.icon}
              </span>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.xl,
                  fontWeight: FONT_WEIGHT.bold,
                  color: COLORS.ink,
                }}
              >
                {card.text}
              </span>
            </Stack>
          </InteractiveCard>
        ))}
      </Grid>
    </section>
  );
}
