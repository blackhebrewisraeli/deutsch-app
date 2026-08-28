import { COLORS } from '../../lib/theme';

/**
 * Ink for the three text tones, plus `error`, shared by Heading, Body and Meta.
 *
 * There is deliberately no `accent` tone: accents in this system are FILLS,
 * each paired with its own ink, and an accent used as a foreground is the drift
 * that contrast.test.js exists to catch. A caller who needs accent ink on an
 * accent fill passes the paired ink through `style` and owns the pairing.
 *
 * `error` is not that case and is why this map has four entries rather than
 * three. COLORS.red is `--c-error`, which means only *wrong*, and it is already
 * swept as a FOREGROUND against ground and against surface-1/2/3 in both
 * palettes (contrast.test.js: `error on surface`, `error on <surface-n>`,
 * `error on ground`). Adding it here introduces no new contrast pair.
 *
 * All four inks are therefore already covered; adding duplicate sweeps would be
 * noise, not coverage.
 *
 * This lives in its own module rather than beside the components: a file that
 * exports both components and constants breaks Fast Refresh
 * (react-refresh/only-export-components), and it would otherwise force
 * Heading.jsx to import from Text.jsx for a four-line map.
 */
export const TONE = {
  default: COLORS.ink,
  soft: COLORS.inkSoft,
  muted: COLORS.mute,
  error: COLORS.red,
};
