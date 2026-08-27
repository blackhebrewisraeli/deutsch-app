import { COLORS } from '../../lib/theme';

/**
 * Ink for the three text tones, shared by Heading, Body and Meta.
 *
 * Three tones, no more. There is deliberately no `accent` tone: accents in this
 * system are FILLS, each paired with its own ink, and an accent used as a
 * foreground is the drift that contrast.test.js exists to catch. A caller who
 * needs accent ink on an accent fill passes the paired ink through `style` and
 * owns the pairing.
 *
 * All three inks are already swept against ground and all three surface steps,
 * in both mode palettes — see contrast.test.js (`fg`, `fg-muted` and
 * `fg-subtle` on surface-1/2/3). No new contrast pairs are needed for the
 * typography primitives, and adding duplicates would be noise, not coverage.
 *
 * This lives in its own module rather than beside the components: a file that
 * exports both components and constants breaks Fast Refresh
 * (react-refresh/only-export-components), and it would otherwise force
 * Heading.jsx to import from Text.jsx for a three-line map.
 */
export const TONE = {
  default: COLORS.ink,
  soft: COLORS.inkSoft,
  muted: COLORS.mute,
};
