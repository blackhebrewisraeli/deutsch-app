# Theme architecture — light/dark + per-pack accents

Date: 2026-08-01 · Base: `main` @ `eb47751`
Sub-project **1a** of the UI restructuring. Sequence: **1a theme architecture** → 1b component
structure → 2 visual redesign → 3 graphics assets.

## Why

Three things need the same foundation and none of them can be built without it:

1. **Light and dark modes.** The app has one hardcoded palette and no mode concept at all.
2. **Per-language accent palettes.** The chosen direction ties the accent to the language's flag —
   German gold/red now, Portuguese green/red and Brazilian green/yellow/blue later — with the same
   structure underneath. This is roadmap Phase 2 ("design tokens per language/brand").
3. **The visual redesign** (sub-project 2, direction "Nocturne"). Changing a token must propagate
   everywhere, which it currently does not: **17 hardcoded colour literals across 11 component
   files** bypass `theme.js`, and `AGENTS.md` already forbids exactly this.

## Decisions taken during brainstorming

Settled with the owner; not open for re-litigation without new information.

- **Direction: "Nocturne"** — dark ground, one saturated accent, soft-rounded cards.
- **Both light and dark**, built together rather than retrofitted.
- **Gold is the primary accent, red the secondary.**
- **Accents come from the language pack. Everything else is structural.**
- **Success/error stay structural.** German's brand red is also the natural error red, and
  Portugal's flag is green + red — precisely the success/error pair. If a pack owned semantic
  colour, a Portuguese learner would see *correct* and *incorrect* rendered in the brand palette.

## The rule that makes one accent serve both modes

Measured, not estimated (WCAG 2.1 relative luminance; the AA floor for body text is 4.5:1):

| foreground | background | ratio | verdict |
| --- | --- | ---: | --- |
| gold `#FFCE00` | dark ground `#0D0D0F` | **13.02:1** | pass |
| gold `#FFCE00` | white | **1.49:1** | **fail** |
| gold `#FFCE00` | paper `#FAF9F7` | **1.42:1** | **fail** |
| ink `#0D0D0F` | **on gold fill** | **13.02:1** | pass |
| `#8A6A00` | white | 5.07:1 | pass |
| `#A8801A` | white | 3.64:1 | large text only |
| red `#E03131` | dark ground | 4.30:1 | large text only |
| red `#E03131` | white | 4.51:1 | pass |

Two rules fall out:

- **The accent is a fill, with ink on top — never a foreground on the page ground.** Ink-on-gold is
  13.02:1 in *both* modes, so the selected-answer tile is byte-identical light and dark. This is
  what stops a per-language accent from requiring two separate designs.
- **Where the accent must be a foreground** (wordmark dot, border, icon), the pack supplies
  per-mode variants. Red needs the same treatment in reverse: `#E03131` fails on dark, so dark mode
  lightens it to `#FF6B6B`.

## Mechanism: CSS custom properties, set from JS

The project has **no CSS files**, and `AGENTS.md` mandates inline styles with tokens from
`src/lib/theme.js`. There is exactly one `<style>` element in the whole app — `src/App.jsx:511`,
which exists solely to `@import` Google Fonts. That constraint drives the design.

Tokens become CSS custom properties written onto `document.documentElement`; `theme.js` exports
`var(--…)` strings instead of hex literals.

```js
// theme.js — the export shape does not change
export const COLORS = {
  ink:     'var(--c-ink)',
  surface: 'var(--c-surface)',
  accent:  'var(--c-accent)',
  …
};
```

Why this over a React context:

- **Components need almost no edits.** `COLORS.ink` still resolves; call sites are untouched.
- **Mode switching costs no re-render** — flipping one attribute on `<html>` restyles the tree.
- **No CSS files**, honouring the existing convention.
- A context would mean threading a hook through all 5,808 lines of components and re-rendering the
  world on every toggle.

**The one thing it breaks:** colour values stop being readable in JS, so string concatenation on
hex breaks. There is exactly one such site — `stats/Heatmap.jsx:6-7` builds `#F5C51840` and
`#F5C51890` by appending alpha. Those become explicit tokens (`--c-heat-1`, `--c-heat-2`) rather
than computed values.

## Token model

Three layers. **`structural` names the tokens, `mode` supplies their values, `pack` supplies the
accents.**

```
structural/                       ← the token NAMES. Never pack-supplied.
  colour:     ground, surface, surfaceAlt, border, borderStrong
              fg, fgMuted, fgSubtle
              success, successFill, error, errorFill, warning
  non-colour: space, radius, shadow, type scale, weight, tracking, motion, z
              (mode-independent — a 16px gap is 16px in both themes)

mode/                             ← the VALUES for every structural colour, per theme
  light: { ground: '#FAF9F7', surface: '#FFFFFF', fg: '#14140F', error: '#C92A2A', … }
  dark:  { ground: '#0D0D0F', surface: '#16161C', fg: '#EDEBE8', error: '#FF6B6B', … }

pack/                             ← the entire surface a new language fills
  accent.fill              '#FFCE00'   (mode-independent — always ink on top)
  accent.onFill            '#0D0D0F'
  accent.fg    { light: '#8A6A00', dark: '#FFCE00' }
  accentAlt.fill   { light: '#C92A2A', dark: '#FF6B6B' }
  accentAlt.onFill { light: '#FFFFFF', dark: '#0D0D0F' }
  progress                 [ground, accentAlt, accent]

  font.display   "'Fraunces', Georgia, serif"          ← the language's voice
  font.body      "'Fraunces', Georgia, serif"
  font.mono      "'JetBrains Mono', 'Courier New', monospace"
  font.families  [{ name:'Fraunces', weights:[…] }, …] ← what must be loaded
```

Thirteen values per language. Everything else is inherited.

**Semantic colours get mode variants too.** `error` is the clearest case: the same `#E03131` that
reads at 4.51:1 on white drops to **4.30:1** on the dark ground and fails body text. Success and
warning are re-tuned per mode for the same reason. *Structural* means "not supplied by the pack";
it does not mean a single value across both themes.

### Typography belongs to the pack

Fraunces-for-German is the app's distinguishing idea, but it is *German's* voice, not the
product's — a Portuguese pack may reasonably want a different display face. So `font.display`,
`font.body` and `font.mono` move into the pack alongside the accents.

`font.mono` is included even though it is arguably interface chrome. Excluding it would mean a
pack could restyle the word on the card but not the IPA beneath it, which is an arbitrary seam. A
pack that wants the house mono simply names it.

**Font *loading* has to move with the tokens, and it is currently in poor shape.** Measured
against production:

- Fonts are pulled from Google Fonts by an `@import` inside a `<style>` tag rendered by
  `App.jsx:511`. An `@import` nested in a stylesheet that React injects after mount is close to the
  slowest possible discovery path — the browser cannot start the download until the app has
  rendered.
- **Nothing font-related is in the service worker precache.** `globPatterns` covers local
  `woff2` files and the repo has none; `fonts.gstatic.com` is cross-origin and has no
  `runtimeCaching` rule. Offline, the fonts survive **only via the browser's HTTP cache** — I
  confirmed a genuinely offline reload still renders Fraunces, with the Google CSS served at
  `transferSize: 0`. That is the same fragile mechanism that made a stale lexicon chunk look
  cached in PR #76: it holds on a machine that has visited recently and evaporates on a cleared
  cache or a fresh install.

This spec therefore moves loading out of component render into the theme boot, driven by
`font.families` from the active pack. **Self-hosting the woff2 files** — which would fix both the
discovery path and durable offline typography — is the right end state but is deferred to
sub-project 3 (assets), where the font files and their OFL licences belong. Documented here so it
is a decision rather than an oversight.

### Pack wiring

`src/packs/de/theme.js` is new and exported from `src/packs/de/index.js`; `activePack.theme` is
read at boot. `validateLanguagePack` (`src/packs/validate.js`) gains a `theme` clause so a pack
missing or malforming these fields fails loudly at startup rather than rendering an invisible UI.

## Mode selection

Resolution order, highest first:

1. explicit user choice, persisted at `deutsch-theme-mode` (`light` | `dark`)
2. `prefers-color-scheme`
3. `dark` as the default when neither is available

A `system` setting is offered alongside `light`/`dark` so a user can return to following the OS.
`prefers-color-scheme` is watched live, so an OS switch is picked up without reload while on
`system`.

**Storage note.** `deutsch-theme-mode` is a *new* key, deliberately not folded into
`deutsch-app-state-v1`. That state object is synced to Supabase and merged across devices; theme is
a per-device preference and must not travel. `AGENTS.md` also freezes existing storage keys.

**First paint.** The variables are written before React mounts, in `main.jsx`, so there is no
flash of the wrong theme.

## Scope boundary — and why light mode keeps the current look here

This spec delivers the architecture, dark mode, and the migration off hardcoded values. It does
**not** restyle light mode.

The reasoning is verification, not timidity. There is **no existing dark mode**, so dark is a pure
addition — nothing to regress. Light mode *does* exist, so if this change also restyled it, a
refactor bug and an intended visual change would be indistinguishable in review. Keeping light
visually unchanged makes the whole refactor screenshot-verifiable: same pixels means the token
plumbing is correct.

Light mode moves to the Nocturne palette in sub-project 2, where a visual diff is the *expected*
outcome and can be judged on its merits.

Consequence to accept for one cycle: light mode is parchment while dark mode is Nocturne. The app
is briefly inconsistent between the two. It is a private repo with one user, and the alternative is
a large refactor with no reliable gate.

## Non-goals

- **Restyling light mode**, or any layout, spacing or hierarchy change — sub-project 2.
- **Splitting `VocabTab.jsx` (803 lines) or growing the primitive set** — sub-project 1b. Tempting
  to fold in, but it would make the screenshot gate meaningless.
- **A Portuguese or Brazilian pack.** This proves the contract; it does not populate it.
- **A language picker.** Roadmap Phase 4.
- **Theme-aware graphics** (logo, OG image, favicon) — sub-project 3.
- **Self-hosting the font files.** The typefaces stay on Google Fonts here; only *who decides which
  families* and *when they are requested* changes. Shipping woff2 and precaching it is
  sub-project 3, and it is what will make offline typography durable rather than dependent on the
  browser's HTTP cache.
- **Changing the typefaces themselves.** Fraunces and JetBrains Mono carry over unchanged; this
  moves the decision into the pack, it does not exercise it.

## Testing

- `src/lib/theme.test.js` — every exported token resolves to a `var(--…)` string; no raw hex
  remains in the exported surface.
- `src/lib/themeMode.test.js` — resolution order (explicit > `prefers-color-scheme` > dark);
  persistence round-trip; live response to a `prefers-color-scheme` change; unknown/corrupt stored
  values fall back rather than throw.
- `src/packs/validate.test.js` — a pack missing `theme`, or missing any of the thirteen fields,
  fails validation with a message naming the field.
- **A guard test that greps the component tree for raw hex literals and fails if any return.** This
  is the test that keeps the 17 from coming back; without it the rule is a comment in `AGENTS.md`
  that nothing enforces.
- Contrast is asserted, not assumed: a unit test computes WCAG ratios for every
  foreground/background pairing the token model permits and fails below 4.5:1 (3:1 for large text),
  in both modes. The table above becomes executable.

## Verification

- Full suite, lint, `format:check`; `.husky/pre-commit` never bypassed.
- **Light mode screenshots identical to `main`** at 1280×860 and 390×844 — the gate that proves the
  refactor changed nothing it should not have.
- Dark mode inspected at both viewports and at 320px.
- Zero raw hex literals under `src/components/` (currently 17 across 11 files:
  `AlphabetTab`, `VocabTab`, `ui/DeckProgress`, `chat/MessageBubble`, `chat/TaskPanel`,
  `chat/ChatInput`, `translate/TileExercise`, `auth/MagicLinkForm`, `gamification/LevelBadge`,
  `gamification/GoalRing`, `stats/Heatmap`).
- Mode toggle exercised in a real browser: switch persists across reload, `system` follows an OS
  change live, and no flash of the wrong theme on first paint.
