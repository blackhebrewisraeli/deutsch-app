/**
 * The "Deutsch." mark, as geometry.
 *
 * Every brand bitmap in public/ is rendered from this one module, which is the
 * point: the previous sources drew the D with an SVG <text> element asking for
 * `Georgia, 'Times New Roman', serif`. Neither face is vendored, so the glyph
 * was whatever serif the rasterising machine happened to have — public/pwa-512.png
 * on `main` is a Times D, which appears nowhere in the app's type system. Same
 * input, different output, and nothing in CI could see it.
 *
 * So the D is CONSTRUCTED, not set. It is not a Fraunces instance and does not
 * try to be. Outlining a variable font needs a font-parsing dependency, and
 * embedding a subset would bloat a 32px favicon; constructing it makes the
 * artwork byte-identical on every machine, forever. Fraunces still carries the
 * wordmark everywhere the wordmark is live text — the pre-JS shell in
 * index.html, the masthead, the social card.
 *
 * Geometry lives on a 0–100 unit em box. `MARK` is exported as data rather than
 * baked into the SVG string so brandAssets.test.js can do arithmetic on the
 * same numbers the renderer uses, instead of parsing them back out of markup.
 */

import { MODE_COLORS, FLAG_STRIPES } from '../../src/lib/themeTokens.js';

/**
 * The letterform, as outer contour + counter under `fill-rule: evenodd`.
 *
 * Stem 26 and bar 22 out of a 100 em is a heavy weight, chosen so the counter
 * stays open at 16px — the favicon is the size that decides this, not the 512.
 */
export const MARK = {
  outer: 'M0 0 L40 0 C68 0 88 20 88 50 C88 80 68 100 40 100 L0 100 Z',
  counter: 'M26 22 L38 22 C54 22 62 33 62 50 C62 67 54 78 38 78 L26 78 Z',
  // The period, baseline-aligned and set 10 units clear of the bowl.
  dotR: 13,
  dotCx: 111,
  dotCy: 87,
  width: 124,
  height: 100,
};

/**
 * An app icon has no theme. It is rasterised once and shown on a launcher, a
 * tab strip and a share card, none of which know anything about
 * `prefers-color-scheme` — so every colour here comes from a family
 * themeTokens.js documents as NOT varying by mode.
 *
 * - `accent-black` is "the only stable dark plane in the system", identical in
 *   LIGHT and DARK, and it is the masthead the app already wears.
 * - `accent-black-on` ships with that plane; its own comment calls the pairing
 *   "the contract".
 * - `flag-red` is a FLAG_STRIPES value — "brand colours, not theme colours".
 *   `accent-red` and `error` both flip by mode and would be a coin toss here.
 *
 * Read from the tokens rather than copied, so a palette change propagates to
 * `npm run gen:assets` instead of silently drifting. The three literals the old
 * artwork carried (#16110b, #FDF3C0, #D62828) are none of them reachable as a
 * current token.
 */
export const BRAND = {
  plane: MODE_COLORS.light['accent-black'],
  ink: MODE_COLORS.light['accent-black-on'],
  dot: FLAG_STRIPES['flag-red'],
};

/**
 * Light `ground`: the PWA manifest's `background_color` and the pre-JS shell's
 * default ground. Mode-dependent in the app, pinned to light here for the
 * reason splashSvg gives.
 */
export const SPLASH_GROUND = MODE_COLORS.light.ground;

/**
 * Half-diagonal of the mark's bounding box once scaled into `size`.
 *
 * Android's maskable contract is a safe zone of the central circle at 80% of
 * the canvas (r = 0.4 × size). Content is safe iff this value clears it — which
 * the current `pwa-512.png` does not, which is why declaring it `maskable`
 * promised something the artwork never kept.
 *
 * @param {{ markHeight: number }} opts
 */
export function maskableClearance({ markHeight }) {
  const scale = markHeight / MARK.height;
  const w = (MARK.width * scale) / 2;
  const h = (MARK.height * scale) / 2;
  return Math.sqrt(w * w + h * h);
}

/** @param {number} size */
export function maskableSafeRadius(size) {
  return size * 0.4;
}

/**
 * Android's adaptive-icon contract, which is tighter than the web's maskable
 * one: the foreground layer is a 108dp canvas, and only the central 66dp circle
 * is guaranteed to survive every launcher mask and the parallax shift.
 *
 * @param {number} size foreground canvas edge, px
 */
export function adaptiveSafeRadius(size) {
  return (size * 33) / 108;
}

/**
 * Render the mark onto a plane.
 *
 * @param {object} opts
 * @param {number} opts.size          canvas edge, px
 * @param {number} opts.radius        plane corner radius. 0 for anything a
 *                                    platform masks itself (maskable, iOS).
 * @param {number} opts.markHeight    em height of the mark, px
 * @param {number} [opts.dotRScale]   optical bump for the period at small sizes
 * @param {boolean} [opts.plane]      false omits the plane, leaving the mark on
 *                                    transparency — Android's adaptive
 *                                    foreground, whose plane is its own layer.
 * @returns {string} standalone SVG, containing no <text> and no font reference
 */
export function iconSvg({ size, radius, markHeight, dotRScale = 1, plane = true }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    ...iconBody({ size, radius, markHeight, dotRScale, plane }),
    `</svg>`,
    '',
  ].join('\n');
}

/**
 * A launch screen: the `any` icon, centred on the ivory ground.
 *
 * The same picture an installed PWA already shows on Android, which builds its
 * splash from `background_color` (light `ground`, see vite.config.js) plus the
 * icon — and the ground the pre-JS shell in index.html paints next, so the
 * hand-off from native splash to web shell does not flash. A launch screen is
 * as theme-blind as an icon: it is drawn before any JavaScript can read the
 * stored mode, so it takes the light ground in both.
 *
 * @param {object} opts
 * @param {number} opts.width     canvas width, px
 * @param {number} opts.height    canvas height, px
 * @param {number} opts.iconSize  edge of the centred icon, px
 * @returns {string} standalone SVG, containing no <text> and no font reference
 */
export function splashSvg({ width, height, iconSize }) {
  const x = round((width - iconSize) / 2);
  const y = round((height - iconSize) / 2);
  const icon = iconBody({
    size: iconSize,
    radius: round((iconSize * 96) / 512),
    markHeight: round(iconSize / 2),
    dotRScale: 1,
    plane: true,
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <rect width="${width}" height="${height}" fill="${SPLASH_GROUND}"/>`,
    `  <g transform="translate(${x} ${y})">`,
    ...icon.map((line) => `  ${line}`),
    `  </g>`,
    `</svg>`,
    '',
  ].join('\n');
}

/** The plane and the mark, as SVG lines, for a `size`-edged canvas at 0,0. */
function iconBody({ size, radius, markHeight, dotRScale, plane }) {
  const scale = markHeight / MARK.height;
  const markW = MARK.width * scale;
  const tx = (size - markW) / 2;
  const ty = (size - markHeight) / 2;
  const r = round(MARK.dotR * dotRScale);

  return [
    ...(plane
      ? [`  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND.plane}"/>`]
      : []),
    `  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(scale, 5)})">`,
    `    <path fill="${BRAND.ink}" fill-rule="evenodd" d="${MARK.outer} ${MARK.counter}"/>`,
    `    <circle cx="${MARK.dotCx}" cy="${MARK.dotCy}" r="${r}" fill="${BRAND.dot}"/>`,
    `  </g>`,
  ];
}

/**
 * @param {number} n
 * @param {number} [places]
 */
function round(n, places = 3) {
  return Number(n.toFixed(places));
}
