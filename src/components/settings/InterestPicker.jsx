import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import { Grid } from '../ui/Layout';
import { toggleInterest } from '../../lib/interests';

// One track per topic put three tiles across at every width. Inside a Surface
// at 320px that is ~77px a tile, or ~45px of content once the 16px padding is
// off each side — narrower than "MUSIK" set in uppercase mono at `widest`
// tracking. The tile carried `overflowWrap: 'anywhere'`, so instead of
// overflowing, the label split inside the word: "SPOR / T", "MUSI / K".
//
// Pack labels are short German nouns and must stay whole, so the wrap opt-in
// is gone and the tiles wrap instead of the letters. 112px is the track floor:
// two tiles fit the 256px content box at 320px with room to spare, and the
// three-across row only returns once each tile can hold the widest label
// ("TECH / IT", ~81px) on one line. `minmax(0, 1fr)` still comes from Grid, so
// a long future label cannot push the page wider than the viewport.
const MIN_TILE = 112;

/**
 * Multi-select topic toggles. Pack supplies labels/icons; this component
 * only flips ids through `toggleInterest`.
 */
export default function InterestPicker({ topics = [], enabled = [], onChange }) {
  return (
    <Grid columns="auto-fit" min={MIN_TILE} gap={3} role="group" aria-label="Interest topics">
      {topics.map((topic) => {
        const active = enabled.includes(topic.id);
        return (
          <button
            key={topic.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(toggleInterest(topic.id, enabled, topics))}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: SHADOW.press(active ? COLORS.greenDeep : COLORS.lip),
              background: active ? COLORS.green : COLORS.card,
              color: active ? COLORS.paper : COLORS.ink,
              padding: SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: FONT_SIZE.lg, marginBottom: SPACE[1] }} aria-hidden="true">
              {topic.icon}
            </div>
            <div
              style={{
                fontWeight: FONT_WEIGHT.bold,
                letterSpacing: LETTER_SPACING.widest,
                fontSize: FONT_SIZE.sm,
                textTransform: 'uppercase',
              }}
            >
              {topic.label}
            </div>
          </button>
        );
      })}
    </Grid>
  );
}
