# UI sub-project 3 — brand + sharing assets (design)

**Date:** 2026-09-20 · **Branch:** `feat/ui3-brand-assets`
**Closes:** `docs/BACKLOG.md` → "Blocked" → **UI sub-project 3 — graphics assets**
(the icon set and the OG image slices). The empty/error-state slice already
shipped as `StatusNote`; the font slice shipped as #103.

---

## 1. What is actually wrong today

Audited against `main` @ `8e2d4fd`. Every claim below was checked in the file,
not assumed.

### 1.1 The icons are rendered from a font that is not ours

`public/icon-base.svg` and `public/favicon.svg` both draw the `D` with an SVG
`<text>` element asking for `Georgia, 'Times New Roman', serif`. Neither face is
vendored, so the letterform is **whatever serif the rasterising machine had**.
`public/pwa-512.png` in the repo is a Times-flavoured D — nothing in the app's
type system, which is Fraunces at display scale.

That also makes `scripts/gen-icons.js` non-reproducible: the same input yields a
different glyph on a different machine, and nothing in CI would notice.

### 1.2 The icon palette is three dead literals

| Literal in the SVG | What it was | Status |
| --- | --- | --- |
| `#16110b` | light-mode `fg` used as a *plane* | never a plane token; the plane is `accent-black` `#1A1816` |
| `#FDF3C0` | the **parchment** light ground | retired when light mode moved to ivory `#FBF8F1` |
| `#D62828` | pre-theme-arc red | `DEFAULT_ACCENTS.light.accentAlt`, superseded by `accent-red` / `flag-red` |

None of the three is reachable from `src/lib/themeTokens.js` as a current token.

### 1.3 There is no maskable icon

`vite.config.js` lists `pwa-512.png` **twice** — once as `purpose` absent
(`any`) and once as `purpose: 'maskable'`. Declaring one bitmap for both is not
a maskable icon; it is a promise the artwork does not keep. The Android maskable
contract is a safe zone of the **central circle at 80% of the canvas**
(r = 204.8 on 512), and the current artwork puts the `D`'s left stem at x≈68 and
the red dot's right edge at x≈428 — both outside that circle. On a circle-masked
launcher the stem and the dot get cut.

### 1.4 `favicon-32.png` is orphaned

It exists in `public/` and `index.html` never references it. Only the SVG
favicon is linked, so any browser without SVG-favicon support falls back to a
`/favicon.ico` that does not exist.

### 1.5 The social preview predates two shipped decisions and is unreachable

`docs/social-preview.html`:

- `@import`s **Google Fonts over the network** — the app vendored all three
  families in #103 precisely to stop doing this.
- grounds on parchment `#FDF3C0`; light mode is ivory `#FBF8F1`.
- sets the tagline in **Fraunces italic**. Prose moved to Plus Jakarta Sans on
  2026-09-01 (AGENTS.md → Typography). Fraunces is display-only now.
- is **1280×640** (2:1). The Open Graph aspect is **1.91:1**.

And `docs/social-preview.png` is in `docs/`, which the app does not serve, so no
`og:image` could ever point at it.

### 1.6 `index.html` has no sharing metadata at all

No `og:*`, no `twitter:*`, no canonical. A link to the app in a chat client,
a DM or a post renders as a bare URL. For a beta whose only distribution is
someone pasting the link, that is the highest-leverage gap in this list.

---

## 2. The smallest coherent asset set

Three mask contracts exist, and they genuinely differ, so one bitmap cannot
serve all three:

| Consumer | Mask applied by the platform | Therefore |
| --- | --- | --- |
| PWA `purpose: any`, browser tab | none — shown as authored | the artwork supplies its own rounded plane |
| PWA `purpose: maskable` (Android) | arbitrary, up to a circle of 80% | full-bleed plane, mark inside r = 40% |
| `apple-touch-icon` (iOS) | Apple's squircle, always | full-bleed **square**, no baked corners (else double-rounded) |

So the shipped set is:

```
public/favicon.svg            32  served as-is, optically tuned for 16px
public/favicon-32.png         32  PNG fallback, now actually linked
public/apple-touch-icon.png  180  full-bleed square
public/pwa-192.png           192  rounded plane  (purpose any)
public/pwa-512.png           512  rounded plane  (purpose any)
public/pwa-maskable-512.png  512  full-bleed, safe-circle mark (purpose maskable)
public/social-preview.png   1200×630  served, referenced by og:image
public/icon-base.svg         512  the canonical human-readable mark
```

Eight files, one mark. Nothing here is decorative: every entry has exactly one
consumer that would otherwise be broken or absent.

**Deleted:** `docs/social-preview.html` and `docs/social-preview.png`. The
template moves into the generator; the render moves into `public/` where a URL
can reach it. A second copy at GitHub's recommended 1280×640 is *not* shipped —
GitHub's repo social preview crops to 1.91:1, which 1200×630 already is.

---

## 3. The mark

**A geometric `D` plus a red period, authored as SVG `<path>` data.**

The `D` is constructed, not set. It is not a Fraunces instance and does not try
to be: outlining a variable font would need a font-parsing dependency, and
embedding a subset in every icon would bloat the favicon. Constructing it means
the artwork is byte-identical on every machine forever, which is the property
§1.1 says we lack. Fraunces still carries the wordmark everywhere the wordmark
is *live text* — the pre-JS shell, the masthead, the social preview.

Geometry, on a 0–100 unit em box (`fill-rule="evenodd"`, outer + counter):

- stem width 26, bar thickness 22, bowl swelling to x = 88 — a heavy weight that
  survives a 16px favicon without the counter filling in.
- the period is a circle of r = 13 set 10 units right of the bowl, baseline-aligned.
- mark bounding box: **124 × 100** units.

### 3.1 Colour — all three tokens are mode-independent, on purpose

An app icon has no theme. It is rasterised once and shown on a launcher, a tab
strip and a share card that know nothing about `prefers-color-scheme`. So every
colour in the mark comes from a family that `themeTokens.js` documents as
*not* varying by mode:

| Role | Token | Value | Why this one |
| --- | --- | --- | --- |
| plane | `accent-black` | `#1A1816` | "the only stable dark plane in the system" — identical in `LIGHT` and `DARK`, and it is the masthead the app already wears |
| letterform | `accent-black-on` | `#FBF8F1` | ships *with* that plane; the comment in `themeTokens.js` calls the pairing "the contract" |
| period | `flag-red` | `#DD0000` | `FLAG_STRIPES` are "brand colours, not theme colours … a light-mode machine still gets black / red / gold". `accent-red` and `error` both flip by mode and cannot be used here |

This preserves the icon the app already has — charcoal plane, warm-light `D`,
red dot — while removing all three dead literals. It is a re-derivation, not a
redesign.

### 3.2 Mark scale per contract

| Artefact | plane | corner radius | mark height | check |
| --- | --- | --- | --- | --- |
| `icon-base` / `pwa-512` (any) | 512 | 96 | 256 (50%) | — |
| `pwa-192` (any) | 192 | 36 | 96 (50%) | — |
| `pwa-maskable-512` | 512 | 0 | 240 | half-diagonal of the 297.6×240 box = **191.2** ≤ 204.8 ✓ |
| `apple-touch-icon` | 180 | 0 | 92 (51%) | iOS squircle is far wider than the 80% circle |
| `favicon` | 32 | 5 | 20 (62%) | period r ×1.15 so it survives 16px |

**These numbers moved during the visual pass and this table is the corrected
version.** The first pass set the mark at 39% of the canvas; rendered at true
size beside the icon it replaces, that read as timid — the old artwork filled
~70%. 50% is the settled value, and the maskable takes 240 rather than 256
because 256 leaves only 5.7px of the safe circle, which is inside rounding
error for something a platform crops.

The maskable clearance is asserted arithmetically in the test suite from the
generator's own numbers, **and the generator refuses to emit a mark that fails
it**, so growing the mark fails the run rather than shipping a clipped launcher
icon.

---

## 4. Social preview

**1200 × 630**, rendered from `scripts/gen-assets/social-preview.html`.

- Ground ivory `#FBF8F1`, surface `#FFFFFF`, ink `#16110b`, muted `#5C5142`,
  hairline `#E2DDD2`, the correct answer on `success` `#2F7D3A` — all read from
  today's `LIGHT` palette.
- The right edge keeps the three `FLAG_STRIPES` bands.
- **Type roles exactly as AGENTS.md states them:** Fraunces 900 for the
  `Deutsch.` wordmark and the `Hallo` headword (display), Plus Jakarta Sans for
  the tagline (prose — *this is the fix for §1.5*), JetBrains Mono for the
  uppercase labels and for the IPA `[ˈhalo]`.
- `@font-face` points at `public/fonts/**/*.woff2` over `file://`. **No network
  request at generation time and none at runtime** — the image is a PNG.

---

## 5. Metadata

`index.html` gains a canonical link, the Open Graph set (`type`, `site_name`,
`title`, `description`, `url`, `image`, `image:width`, `image:height`,
`image:alt`) and the Twitter set (`card: summary_large_image`, `title`,
`description`, `image`, `image:alt`).

`og:image` must be **absolute** — crawlers do not resolve relative URLs — so the
origin `https://deutsch-app-dusky.vercel.app` is written literally, as AGENTS.md
records it. The duplication is the reason the test asserts it.

Also in `index.html`: `<link rel="icon" sizes="32x32" href="/favicon-32.png">`
(closing §1.4), and the `apple-touch-icon sizes="192x192"` line pointing at
`pwa-192.png` is **removed** — that bitmap now carries a baked rounded plane and
iOS would round it a second time.

`vite.config.js` manifest gains the `pwa-maskable-512.png` entry and drops the
duplicate `pwa-512.png`/`maskable` pair.

---

## 6. Reproducibility

`npm run gen:assets` → `scripts/gen-assets/index.js`.

It uses **Playwright**, already a devDependency and already the engine behind
`audit:contrast` and `audit:layout`. `scripts/gen-icons.js` is deleted: it
depended on `sharp`, which its own header admits is not installed, so it could
not be run without a manual install — and it rendered the font-dependent `<text>`
of §1.1.

Determinism: the icons are pure geometry (no text, no fonts, no gradients) and
the social card sets only vendored faces, so Chromium produces the same bytes on
any machine. Nothing fetches a remote font or a remote image, at generation time
or at runtime.

---

## 7. The guard

One new test file, `src/brandAssets.test.js`. It is scoped to failures that are
**silent** — ones where the app still builds, still passes every other test, and
is simply wrong in a place no unit test looks:

1. **No SVG source contains a `<text>` element.** This is §1.1 as a rule. A
   `<text>` icon looks correct on the machine that made it and wrong everywhere
   else, which is the definition of a failure tests exist to catch.
2. **Every local asset `index.html` and the manifest reference exists**, and
   `og:image` / `twitter:image` are absolute URLs on the canonical origin.
3. **`og:image:width` / `:height` match the PNG's real dimensions**, parsed from
   the IHDR chunk. A stale declared size makes crawlers reserve the wrong box.
4. **The manifest declares a maskable icon that is a *different* file** from the
   `any` icons — §1.3 stated as an invariant.
5. **The maskable mark fits the 80% safe circle**, computed from the generator's
   exported geometry.

Deliberately *not* asserted: pixel content. A hash of a PNG is a test that fails
on a Chromium upgrade and tells you nothing, and the visual pass in the plan
covers what a human eye must judge.

---

## 8. Out of scope

No application UI changes — not one file under `src/components/`. No font
changes, no storage keys, no engine behaviour, no Supabase, no migrations, no
hosted auth or Google OAuth branding, no SMS auth, no redesign. German stays the
only pack.

Uploading the image to GitHub's repo-settings social preview is an **owner
action** and is recorded as one.
