/**
 * The iOS and Android launcher icons and launch screens, as data.
 *
 * `npx cap add` seeds both native projects with Capacitor's own placeholder
 * artwork, and nothing replaced it: until this existed the APK and IPA would
 * have shipped the Capacitor logo. Every file listed here is rendered by
 * `npm run gen:assets` from the same geometry as the PWA icons (mark.js), at
 * the path and pixel size the Capacitor templates already use — so the Xcode
 * asset catalog and the Android resource tree need no rewiring, and a second
 * run of the generator overwrites them in place.
 *
 * Kept apart from index.js because that module renders on import; this one is
 * inert, so brandAssets.test.js can assert against the same numbers the
 * renderer used.
 *
 * All paths are relative to the repo root.
 */

import { BRAND, SPLASH_GROUND } from './mark.js';

const IOS_ASSETS = 'ios/App/App/Assets.xcassets';
const ANDROID_RES = 'android/app/src/main/res';

/** Android density buckets and their scale over mdpi. */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

/**
 * Launcher icons. Same four mask contracts as the PWA set, mapped onto what
 * each platform does to the bitmap:
 *
 * - iOS          — one 1024 marketing icon (Xcode derives every other size).
 *                  Full-bleed square for the reason apple-touch-icon.png is:
 *                  iOS applies its own squircle. It must also carry no alpha
 *                  channel or App Store Connect rejects the upload; the
 *                  opaque plane guarantees that, and the test checks the PNG.
 * - ic_launcher  — the legacy icon for API 24–25, shown exactly as drawn, so it
 *                  brings its own rounded plane like the PWA's `any`.
 * - _round       — the legacy round slot: the plane is a full circle, with the
 *                  mark at the maskable proportion so it clears it.
 * - _foreground  — API 26+ adaptive icon. The plane is the adaptive background
 *                  layer (ANDROID_COLORS), so this layer is the mark alone on
 *                  transparency, sized inside the 66dp safe circle.
 */
export const NATIVE_ICONS = [
  {
    file: `${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`,
    size: 1024,
    radius: 0,
    // apple-touch-icon.png's 92/180, at 1024.
    markHeight: 524,
  },
  ...DENSITIES.flatMap(([bucket, scale]) => {
    const legacy = 48 * scale;
    const adaptive = 108 * scale;
    return [
      {
        file: `${ANDROID_RES}/mipmap-${bucket}/ic_launcher.png`,
        size: legacy,
        radius: (legacy * 96) / 512,
        markHeight: legacy / 2,
      },
      {
        file: `${ANDROID_RES}/mipmap-${bucket}/ic_launcher_round.png`,
        size: legacy,
        radius: legacy / 2,
        markHeight: Math.round((legacy * 240) / 512),
      },
      {
        file: `${ANDROID_RES}/mipmap-${bucket}/ic_launcher_foreground.png`,
        size: adaptive,
        radius: 0,
        markHeight: Math.round(adaptive * 0.36),
        plane: false,
        adaptive: true,
      },
    ];
  }),
];

/**
 * The template's Android splash dimensions per bucket, portrait. Not a clean
 * multiple of mdpi (hdpi is 3:5, xhdpi 9:16), so listed rather than derived.
 */
const SPLASH_PORTRAIT = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};

/**
 * Launch screens: the icon centred on the ivory ground (see splashSvg).
 *
 * iOS: LaunchScreen.storyboard draws the `Splash` image set aspect-fill, so a
 * phone in portrait sees only the central ~46% of the square's width. 384 of
 * 2732 comes out near 120pt there (~30% of the width) — the same share as
 * Android's below.
 *
 * Android: API 24–30 stretch `@drawable/splash` over the window, which is why
 * the template ships one bitmap per orientation and density. The icon edge is
 * 30% of the short side. API 31+ ignore these bitmaps and draw the adaptive
 * icon on `splash_background` instead (styles.xml).
 */
export const NATIVE_SPLASHES = [
  ...['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'].map((name) => ({
    file: `${IOS_ASSETS}/Splash.imageset/${name}`,
    width: 2732,
    height: 2732,
    iconSize: 384,
  })),
  androidSplash('drawable', 480, 320),
  ...Object.entries(SPLASH_PORTRAIT).flatMap(([bucket, [w, h]]) => [
    androidSplash(`drawable-port-${bucket}`, w, h),
    androidSplash(`drawable-land-${bucket}`, h, w),
  ]),
];

/**
 * Colour resources the generator owns, so a palette change in themeTokens.js
 * reaches the native projects by re-running it.
 */
export const ANDROID_COLORS = [
  {
    file: `${ANDROID_RES}/values/ic_launcher_background.xml`,
    name: 'ic_launcher_background',
    value: BRAND.plane,
  },
  {
    file: `${ANDROID_RES}/values/splash_background.xml`,
    name: 'splash_background',
    value: SPLASH_GROUND,
  },
];

/** @param {{ name: string, value: string }} color */
export function colorResourceXml({ name, value }) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- Generated by `npm run gen:assets` (scripts/gen-assets/native.js). Do not hand-edit. -->',
    '<resources>',
    `    <color name="${name}">${value.toUpperCase()}</color>`,
    '</resources>',
    '',
  ].join('\n');
}

function androidSplash(dir, width, height) {
  return {
    file: `${ANDROID_RES}/${dir}/splash.png`,
    width,
    height,
    iconSize: Math.round(Math.min(width, height) * 0.3),
  };
}
