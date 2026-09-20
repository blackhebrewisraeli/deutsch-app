# UI sub-project 3 — brand + sharing assets (plan)

Design: `docs/superpowers/specs/2026-09-20-brand-and-sharing-assets-design.md`
Branch: `feat/ui3-brand-assets` off `main` @ `8e2d4fd`.

---

## Task 1 — the mark module

**New:** `scripts/gen-assets/mark.js`

Exports the geometry as data so the test can assert on the same numbers the
renderer uses:

- `MARK` — `{ outer, counter, dotCx, dotCy, dotR, width: 124, height: 100 }`,
  path strings in the 0–100 em box of the design §3.
- `BRAND` — `{ plane, ink, dot }`, imported from `src/lib/themeTokens.js`
  (`MODE_COLORS.light['accent-black']`, `['accent-black-on']`,
  `FLAG_STRIPES['flag-red']`) so a token change propagates instead of drifting.
- `iconSvg({ size, radius, markHeight, dotRScale })` → an SVG string. No
  `<text>`, ever.
- `maskableClearance({ size, markHeight })` → the half-diagonal of the scaled
  mark box, for the safe-circle assertion.

**Files:** create only.

## Task 2 — the generator

**New:** `scripts/gen-assets/index.js`, `scripts/gen-assets/social-preview.html`
**Delete:** `scripts/gen-icons.js`
**Edit:** `package.json` (`"gen:assets": "node scripts/gen-assets/index.js"`)

`index.js` launches Playwright Chromium once and writes, in order:

| Output | From |
| --- | --- |
| `public/icon-base.svg` | `iconSvg({ size: 512, radius: 96, markHeight: 200 })` |
| `public/favicon.svg` | `iconSvg({ size: 32, radius: 5, markHeight: 20, dotRScale: 1.15 })` |
| `public/favicon-32.png` | raster of `favicon.svg` |
| `public/apple-touch-icon.png` | `iconSvg({ size: 180, radius: 0, markHeight: 70 })` |
| `public/pwa-192.png`, `public/pwa-512.png` | `icon-base.svg` geometry at each size |
| `public/pwa-maskable-512.png` | `iconSvg({ size: 512, radius: 0, markHeight: 200 })` |
| `public/social-preview.png` | `social-preview.html` at 1200×630 |

Rasterising is `page.setContent(svg)` + `element.screenshot({ omitBackground:
false })` at `deviceScaleFactor: 1` with the viewport set to the icon size, so
the PNG is exactly N×N with no resampling.

`social-preview.html` is loaded over `file://` so its relative `@font-face`
URLs resolve to `public/fonts/`. Palette and type roles per design §4.

**Delete** `docs/social-preview.html` and `docs/social-preview.png`.

## Task 3 — regenerate and eyeball

Run `npm run gen:assets`. Then **look at the output** before wiring anything:

- favicon at its real sizes (16, 32) — is the counter open, is the dot visible?
- `apple-touch-icon` at 180 and `pwa-512` at 512.
- `pwa-maskable-512` under a **circular mask**, which is the whole point of it.
- the social card at full size and at the ~500px width a chat client shows.

Tune `markHeight` / `dotRScale` and re-run until each reads. This step is
allowed to iterate; the numbers in the design are a starting point, and the
design is updated if they move.

## Task 4 — metadata + manifest

**Edit:** `index.html` — canonical, OG set, Twitter set, `rel="icon" sizes="32x32"`,
drop the `apple-touch-icon sizes="192x192"` line. Design §5.
**Edit:** `vite.config.js` — manifest icons become `pwa-192` (any),
`pwa-512` (any), `pwa-maskable-512` (maskable); `includeAssets` gains
`pwa-maskable-512.png`, `favicon-32.png` and `social-preview.png`.

Copy for the description is one sentence and matches the existing `<meta
name="description">` voice. No new product claims.

## Task 5 — the guard

**New:** `src/brandAssets.test.js`, the five assertions of design §7.

**Prove each has teeth before moving on.** Temporarily break the thing it
guards — put a `<text>` back in one SVG, point `og:image` at a relative path,
declare the wrong `og:image:width`, collapse the manifest back to one bitmap,
inflate `markHeight` past the safe circle — confirm the matching test goes red
and *only* that one, then revert. A guard that has never been seen to fail is a
guard that might be asserting nothing.

## Task 6 — browser verification

`npm run build`, serve `dist/`, and in the browser:

- read back every `og:*` / `twitter:*` meta from the built document;
- fetch `dist/manifest.webmanifest` and confirm three icon entries, one maskable,
  each resolving to a real file with a 200;
- fetch `/social-preview.png` and confirm 200 + `image/png` + 1200×630;
- screenshot the icon set at true sizes and the maskable under a circle mask.

No `src/components/` file changes, so the 375/320 populated-account pass does
not apply — and saying that explicitly is part of the report, not a thing to
skip silently.

## Task 7 — docs

**Edit:** `docs/BACKLOG.md`
- Remove **UI sub-project 3** from *Blocked*; add a *Recently shipped* entry
  stating precisely what landed and what did **not** (no logo lockup beyond the
  icon mark, no in-app illustration set, no favicon `.ico`).
- Add an owner action: upload `public/social-preview.png` to GitHub →
  Settings → Social preview. Nobody with repo access can do it through the API.

## Task 8 — gates

`npm test`, `npm run lint`, `npm run format:check`, `npm run build` — all four.
Note that `format:check` only covers `src/`, so `scripts/` is formatted by the
pre-commit `lint-staged` pass; run `npx prettier --write` on the new script
files rather than discovering it in the hook.

## Task 9 — land

Commit on `feat/ui3-brand-assets` through the husky hook (never `--no-verify`),
push, open a **draft** PR. Do not merge.
