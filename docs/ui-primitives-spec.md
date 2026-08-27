# UI primitives — the design contract

**Status:** design, ready for a plan
**Date:** 2026-08-27
**Unblocks:** `docs/BACKLOG.md` → "Blocked" → **UI sub-project 1b — grow the UI primitive set**
**Branch target:** `main`

This document defines the API, behaviour and structural rules for the reusable UI primitives.
It writes **no component code**. Its job is to remove the reason 1b is listed as blocked:
"starting these without a written design means the implementing agent invents the architecture,
which is the expensive thing to undo."

---

## 1 · Scope

In scope — the contract for four families:

| Family     | Primitives                                                   |
| ---------- | ------------------------------------------------------------ |
| Typography | `Heading`, `Body`, `Meta`                                    |
| Buttons    | `Button` variants `primary` / `secondary` / `ghost` / `icon` |
| Surfaces   | `Surface` (base container), `InteractiveCard`                |
| Layout     | `Stack`, `Row`, `Grid`, `PageFrame`                          |

Plus the cross-cutting law they all obey: token sourcing, the no-hardcoded-colour policy,
light/dark behaviour, focus management, ARIA baselines, and the 320px floor.

Out of scope, deliberately:

- **UI sub-project 2** (Nocturne layout/rhythm redesign) and **3** (logo, icon set, empty states).
  This spec is the vocabulary those will be written in, not the redesign itself.
- Migrating the app's existing surfaces onto the primitives wholesale. §12 defines the
  migration policy; the migration is its own sequence of PRs.
- Any new colour. The palette is settled (`src/lib/themeTokens.js`); primitives consume it.

---

## 2 · Prior art — what already exists, measured

Counted on `main` @ `560e20d`, 63 non-test `.jsx` files under `src/components/`:

| Fact                                          | Number                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Primitives already in `src/components/ui/`    | 6 — `Button`, `Toast`, `DeckProgress`, `SegmentedPicker`, `LevelSwitcher`, `Confetti` |
| Files importing `ui/Button`                   | 8                                                                                     |
| Raw `<button` elements in components          | 81                                                                                    |
| Files importing the `CARD` token group        | 4                                                                                     |
| `TEXT.*` token usages                         | 6                                                                                     |
| Raw `fontSize: <number>` literals             | 30                                                                                    |
| Raw `<h1>`–`<h4>` tags                        | 7                                                                                     |
| Distinct hand-rolled `:focus-visible` recipes | 3                                                                                     |

**1b is not a greenfield.** The gap is not "there are no primitives" — it is that the
primitives that exist cover buttons and a few widgets, while typography, surfaces and layout
are re-derived inline at every call site. The 30 raw `fontSize` literals and the 3 divergent
focus rings are the measurable cost.

`src/components/UI.jsx` already holds three composites — `StatBlock`, `Hero`, `SectionLabel` —
used by 9 files. They are **compositions, not primitives**: `Hero` is a kicker + `<h1>` + subtitle
block. They stay where they are and are re-expressed in terms of the new primitives (§12), not
deleted.

---

## 3 · Facts that shape this — verified against current code

- **`src/lib/theme.js` is the token layer and it is complete enough.** `COLORS`, `FONTS`,
  `FONT_SIZE`, `FONT_WEIGHT`, `LETTER_SPACING`, `SPACE`, `BORDER`, `RADIUS`, `SHADOW`,
  `TRANSITION`, `Z`, plus component groups `BUTTON`, `CARD`, `TEXT`. **No new token group is
  needed for this work** except `FOCUS` (§10.1). Primitives read tokens; they do not restate them.
- **Every colour is already a CSS custom property.** `COLORS.ink` is `var(--c-fg)`, written onto
  `:root` by `applyTheme()` from `MODE_COLORS`. A primitive that only ever names `COLORS.*`
  therefore supports light/dark **inherently** — it does not branch on mode, and there is no
  correct reason for a primitive to import `themeMode`.
- **The no-hex rule is already enforced, with holes.** `src/components/noHardcodedHex.test.js`
  walks `src/components/**` and fails on `/#[0-9a-fA-F]{3,8}\b/`, but only in files ending
  `.jsx`. Five non-test `.js` files under `src/components/` are unscanned, and the regex does not
  match `rgb()` / `rgba()` / `hsl()` / `color-mix()` notation. Today there are zero such literals
  in components, so closing the hole is preventive and cheap (§4.2).
- **`SHADOW.card` is a fixed `rgba(22,17,11,0.08)`** — a light-mode shadow that is nearly
  invisible on dark surfaces. `BORDER.panel` exists precisely because of this, and `CARD.base`
  already carries both. Surfaces must not rely on shadow alone for separation (§8.1).
- **`BUTTON.ghost` has zero consumers and is defined wrong.** Its `color: COLORS.paper` is the
  _page ground_ colour, so ghost text is invisible on any ground-coloured surface; it renders only
  on a dark plane. Because nothing imports it, no test has ever caught this. §7.3 respecifies it.
- **`ui/Button` has no hover and no busy state.** It tracks `pressed` in React state because
  inline styles cannot express `:active`. There is no `:hover` handling at all and no
  loading affordance anywhere in the app.
- **Focus rings are ad-hoc in exactly three places**, each with its own recipe:
  `WelcomeGate.jsx:57` and `TrialWall.jsx:122` use `2px solid` at `outline-offset: 2px`;
  `stats/LeaderboardSection.jsx:24` uses `3px solid` at `outline-offset: -3px`. All three inject
  their own scoped `<style>` block. There is **no global focus style** — `injectGlobalStyles()`
  contains no `:focus` rule of any kind, so the other 78 raw buttons show only the UA default.
- **Escape-and-restore is already the house pattern**, uncodified: `ThemeChip`, `AccountChip`,
  `StatusChip`, `FeedbackDialog`, `AuthSheet`, `ProfileCard` and `TutorialOverlay` each listen for
  `Escape`; `ThemeChip` additionally calls `buttonRef.current?.focus()`. Not all of them do.
- **`useFocusTrap` is for modal surfaces only.** Its own doc comment states the three header
  chips are non-modal popovers that must not adopt it, and a guard test enforces that. A primitive
  must not trap on the caller's behalf.
- **Breakpoints are settled and measured**: `bp.tiny = 414`, `mobile = 640`, `wide = 720`,
  `tablet = 900` (`src/lib/useWindowWidth.js`), each with a recorded measurement behind it.
  320px is the floor the app must survive, not a breakpoint.
- **Icon buttons in the header are 32×32** (`ThemeChip.jsx`). The header's spare width at 320px is
  ~10px, measured. A 44px minimum target is arithmetically unavailable there (§7.4).

---

## 4 · Foundations

### 4.1 Token law

1. **A primitive names tokens, never values.** Every colour, radius, shadow, space, font, size,
   weight, letter-spacing, transition and z-index comes from `src/lib/theme.js`.
2. **Numbers that are not in a scale are still suspect.** `padding: 6` is allowed only where no
   `SPACE` step fits and the deviation carries a comment saying why. `SPACE` is `4 · 8 · 12 · 16 ·
20 · 24 · 32 · 48 · 64`.
3. **A primitive never imports `themeTokens.js`, `applyTheme.js` or `themeMode.js`.** Those are the
   layer _below_ it. Reading raw palette values re-introduces the mode branch that CSS variables
   exist to delete. `src/components/ui/**` importing any of those three is a test failure.
4. **New tokens go in `theme.js` first, in their own PR.** A primitive PR that also adds a token is
   two changes wearing one coat; the token change is the one that needs contrast review.
5. **Accents are fills.** `COLORS.gold`, `accentBlack`, `accentRed` are backgrounds, each paired
   with its own ink (`accentOn`, `accentBlackOn`, `accentRedOn`). A primitive must never use an
   accent as a text colour, and must never use a tier's ink anywhere but on its own tier — the ink
   is invisible everywhere else, and `contrast.test.js` already asserts that trap.

### 4.2 No hardcoded colours — policy and enforcement

**Policy.** No literal colour, in any notation, in any primitive or any component: no `#rgb`,
`#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `color-mix()` over literals, and no
CSS named colours (`white`, `red`, `rebeccapurple`). `transparent` and `currentColor` are
permitted — they are relative, not absolute, and follow the theme.

**Enforcement.** The plan extends `src/components/noHardcodedHex.test.js` to close the two holes
found in §3:

- widen the file walk from `.jsx` only to `.jsx` **and** `.js` (excluding `*.test.*`);
- widen the pattern from hex-only to hex **plus** functional colour notations and the CSS named
  colours that actually appear in real code (`white`, `black`, `red`, `green`, `blue`, `grey`,
  `gray`);
- keep the offender list printing `file:line: source` — it already does, and that is what makes a
  failure actionable.

**The test must be staged red.** Add a fixture line containing `rgba(0,0,0,.5)`, watch the widened
test fail on it and name it, then delete the fixture. A guard that has never failed is a guard
whose regex has never been proven.

### 4.3 Light / dark is inherent, never conditional

A primitive supports both modes **by containing no mode logic at all**. Because every `COLORS.*`
entry is a `var(--c-…)` resolved on `:root`, the browser re-paints on mode change with no React
involvement.

Forbidden in `src/components/ui/**`:

- reading, importing or prop-drilling the current mode;
- `mode === 'dark' ? … : …` in a style object;
- any value chosen to "look right in light mode".

The one legitimate mode-sensitivity is **contrast**, and it is handled at the token layer:
`contrast.test.js` sweeps every mode palette. When a primitive introduces a new ink-on-surface
pairing that the sweep does not already cover, the plan **adds that pair to the sweep** — it does
not eyeball it.

---

## 5 · Cross-cutting component API conventions

Every primitive in `src/components/ui/` obeys these, so a caller can predict an unfamiliar one.

1. **One primitive per file, default export**, named for the file. Test co-located as
   `<Name>.test.jsx`. This matches the six that already exist.
2. **`style` prop is merged, never replaced.** The merge order is fixed and is part of the contract:

   ```
   { ...recipe, ...stateStyles, ...style }
   ```

   The caller's `style` wins over the resting recipe **and over state styles**. Rationale: a caller
   that needs a one-off override must be able to get it without forking the primitive, and a
   primitive whose state styles silently outrank the caller produces "my override does nothing"
   bugs that are invisible in review.

   _Note this reverses today's `ui/Button`, which applies `pressStyle` after `style`. The change is
   deliberate and belongs in the plan's Button task, with a test asserting a caller override
   survives a press._

3. **`...rest` spreads onto the rendered DOM node**, after the primitive's own attributes, so a
   caller can pass `aria-*`, `data-*`, `id`, handlers and `ref` without a new prop. Consequence: a
   primitive must not invent a prop name that shadows a DOM attribute.
4. **`ref` forwards to the outermost DOM node.** Every interactive primitive needs this — Escape
   restore (`openerRef.current?.focus()`) and `useFocusTrap` both hold refs to real elements.
5. **`as` escape hatch for element identity**, on typographic and layout primitives only. Never on
   `Button` or `InteractiveCard`: those exist to guarantee a native interactive element, and an
   `as="div"` would hand back the exact defect the primitive prevents (§9.1).
6. **No primitive owns app state.** No storage reads, no `activePack`, no network, no analytics.
   A primitive is a pure function of props plus the CSS variables on `:root`.
7. **No German, no content.** The language-blind engine rule (`AGENTS.md`) applies fully:
   no German strings, no default labels, no copy of any kind baked into a primitive.
8. **Children over config.** Prefer `<Button><Icon/> Speichern</Button>` to an `icon=` prop.
   `Button` already has `gap: SPACE[2]` in `btnBase`, so icon+label composes for free.

---

## 6 · Typography primitives

Three primitives replace the 30 raw `fontSize` literals and the 7 loose heading tags.

### 6.1 `Heading`

```jsx
<Heading level={2}>Wortschatz</Heading>
<Heading level={2} size="lg">…</Heading>       // visual override, semantics unchanged
<Heading level={2} as="div">…</Heading>        // semantics override, visual unchanged
```

| Prop    | Type                                        | Default              | Meaning                                                                          |
| ------- | ------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| `level` | `1 \| 2 \| 3 \| 4`                          | `2`                  | **Document semantics.** Renders `<h1>`–`<h4>` and picks the default size.        |
| `size`  | `'display' \| 'xl' \| 'lg' \| 'md' \| 'sm'` | derived from `level` | **Visual size only.** Never changes the tag.                                     |
| `as`    | element type                                | derived from `level` | Escape hatch for when the visual heading must not be a heading in the a11y tree. |
| `tone`  | `'default' \| 'soft' \| 'muted'`            | `'default'`          | §6.4                                                                             |
| `style` | object                                      | —                    | §5.2                                                                             |

Default size ramp, all from `FONT_SIZE`:

| `level` | tag  | `size`      | px source               |
| ------- | ---- | ----------- | ----------------------- |
| 1       | `h1` | `'display'` | responsive, §6.5        |
| 2       | `h2` | `'xl'`      | `FONT_SIZE['3xl']` = 24 |
| 3       | `h3` | `'lg'`      | `FONT_SIZE['2xl']` = 20 |
| 4       | `h4` | `'md'`      | `FONT_SIZE.xl` = 18     |

Shared recipe: `FONTS.display`, `FONT_WEIGHT.black`, `LETTER_SPACING.tight`, `lineHeight: 1`,
`margin: 0` — i.e. `TEXT.display`, which already exists and is exactly this. `Heading` **uses
`TEXT.display`**; it does not restate it.

**Why `level` and `size` are separate props.** Heading order is an a11y contract — a screen-reader
user navigating by heading needs `h1 → h2 → h3` to reflect document structure, not visual weight.
Every design system that lets one prop drive both eventually ships an `<h4>` styled as a page title
or an `<h1>` in a card. Splitting them costs one prop and makes the wrong thing require typing.

`margin: 0` is not negotiable: spacing between blocks is the caller's job, expressed with `Stack`
(§9.1). A heading that carries its own margin makes vertical rhythm unpredictable in a flex column.

### 6.2 `Body`

```jsx
<Body>Text.</Body>
<Body size="sm" tone="soft">Kleingedrucktes.</Body>
```

| Prop   | Type                             | Default     |
| ------ | -------------------------------- | ----------- |
| `size` | `'md' \| 'sm'`                   | `'md'`      |
| `tone` | `'default' \| 'soft' \| 'muted'` | `'default'` |
| `as`   | `'p' \| 'span' \| 'div'`         | `'p'`       |

`FONTS.body`; `md` → `FONT_SIZE.md` (15), `sm` → `FONT_SIZE.base` (13); `lineHeight: 1.5`;
`margin: 0`. `1.5` is the WCAG 1.4.12 minimum for body text and is what `Hero`'s subtitle already
uses.

### 6.3 `Meta`

The uppercase mono label that carries every caption, count, kicker and section marker.

| Prop   | Type                             | Default   |
| ------ | -------------------------------- | --------- |
| `tone` | `'default' \| 'soft' \| 'muted'` | `'muted'` |
| `as`   | `'span' \| 'div'`                | `'span'`  |

Recipe is `TEXT.label` verbatim — `FONTS.mono`, `FONT_SIZE.tag` (10), `LETTER_SPACING.caps`,
`textTransform: 'uppercase'`, `COLORS.mute`.

**`Meta` is presentational, and that is a hazard.** Uppercasing via CSS keeps the accessible name
in its authored case, which is right. But a 10px muted mono string is not a substitute for a label:
when `Meta` captions a control, the control still needs its own `aria-label` or an
`aria-labelledby` pointing at the `Meta` node. The plan states this in the primitive's doc comment,
because "the label is right there on screen" is exactly the reasoning that produced the 52
`aria-label` attributes the app needed to add after the fact.

### 6.4 Tone → token map (all three primitives)

| `tone`    | token            | var             |
| --------- | ---------------- | --------------- |
| `default` | `COLORS.ink`     | `--c-fg`        |
| `soft`    | `COLORS.inkSoft` | `--c-fg-subtle` |
| `muted`   | `COLORS.mute`    | `--c-fg-muted`  |

Three tones, no more. There is no `tone="accent"`: accents are fills (§4.1.5), and a fourth tone is
how a palette starts drifting. A caller needing accent text on an accent fill passes the paired ink
through `style` and takes responsibility for the pairing.

**Contrast obligation.** These three inks are audited against the page grounds today. Any tone used
on a `Surface` elevation the sweep does not already cover gets added to `contrast.test.js` in the
same PR. `tone="muted"` on `surface3` is the pairing most likely to be new — check it explicitly
rather than assuming the ramp inherits.

### 6.5 The `display` size and the jsdom trap

`Hero` sizes its title `fontSize: 'min(72px, 13vw)'` — correct in a browser, and **unassertable in
jsdom**, which reads that value back mangled (`min(400px * , * calc(…))` for the analogous case).
A test cannot verify a CSS-computed clamp here.

`Heading size="display"` therefore **computes its size in JS**:

```
useWindowWidth() → fontSize = Math.min(72, width * 0.13)
```

Same rendered result, an assertable number, and it composes with the rest of the responsive story
(§9.4) instead of being a second mechanism. `Hero` migrates onto this and its inline `min()`
disappears (§12).

---

## 7 · Button

One component, `src/components/ui/Button.jsx`, keyed by `variant`. It already exists with 8
consumers; this section specifies what it becomes.

### 7.1 API

| Prop         | Type                                                                          | Default                                |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------- |
| `variant`    | `'primary' \| 'secondary' \| 'ghost' \| 'icon' \| 'go' \| 'danger' \| 'tile'` | `'primary'`                            |
| `size`       | `'md' \| 'sm'`                                                                | `'md'`                                 |
| `disabled`   | boolean                                                                       | `false`                                |
| `busy`       | boolean                                                                       | `false`                                |
| `type`       | `'button' \| 'submit'`                                                        | `'button'`                             |
| `aria-label` | string                                                                        | — (**required when `variant="icon"`**) |

`go`, `danger` and `tile` are **retained, not deprecated**: `go` is the drill's affirmative action,
`danger` is destructive, `tile` is the grid cell. They are semantic variants the app uses, and
folding them into `primary` would delete meaning. This spec adds `icon`, repairs `ghost`, and
defines the state matrix all seven share.

### 7.2 The state matrix

| State        | Trigger                     | Treatment                                              | Mechanism           |
| ------------ | --------------------------- | ------------------------------------------------------ | ------------------- |
| **rest**     | —                           | `BUTTON[variant]` from `theme.js`                      | inline              |
| **hover**    | `:hover`, fine pointer only | `filter: brightness(1.04)`, lip unchanged              | global CSS (§7.5)   |
| **active**   | pointer down                | `translateY(3px)`, lip `0 4px 0` → `0 1px 0`           | inline, React state |
| **focus**    | `:focus-visible`            | the ring, §10.1                                        | global CSS          |
| **disabled** | `disabled` prop             | `opacity: .45`, `cursor: not-allowed`, no hover/active | inline + attribute  |
| **busy**     | `busy` prop                 | §7.6                                                   | inline + ARIA       |

Hover is gated on `@media (hover: hover) and (pointer: fine)`. Without that gate a touch device
latches the hover style on tap and it stays until the next tap elsewhere — the app is
phone-first, so this is the common case, not the edge case.

`brightness()` rather than a second token per variant: seven variants × two modes × a hover token
is fourteen new palette entries to keep in contrast, to express "slightly lighter". A relative
filter costs nothing and cannot drift out of contrast, because it moves both plane and ink.

### 7.3 Variant specifications

- **`primary`** — `COLORS.ink` plane, `COLORS.paper` ink, `SHADOW.press(COLORS.press)`. Unchanged.
- **`secondary`** — `COLORS.card` plane, `COLORS.ink` ink, `SHADOW.press(COLORS.lip)`. **The
  existing token carries `flex: 1`, which is a layout decision hiding in a colour recipe.** The
  plan removes it from the token and callers get it from `Row`/`Stack` (§9). Every current
  consumer must be checked in the same PR — this is a visible change, not a refactor.
- **`ghost`** — respecified. Transparent plane, **`COLORS.ink` ink** (was `COLORS.paper`), border
  `BORDER.panel` (`1px solid COLORS.border`), no shadow, no uppercase. Today's recipe paints the
  label in the page-ground colour, which is invisible on any ground-coloured surface; it survived
  only because nothing imports it. A caller placing a ghost button on a dark plane
  (`accentBlack`, `CARD.dark`) passes the paired ink via `style` — that is the accent-tier rule
  (§4.1.5), not a variant.
- **`icon`** — square, `RADIUS.pill`, `COLORS.surface` plane, `BORDER.panel`, no shadow, no text.
  32×32 at `size="md"`, 28×28 at `size="sm"`, matching `ThemeChip`'s measured header fit.

### 7.4 Icon-only buttons: label and target size

**`aria-label` is mandatory.** An icon-only button with no accessible name is an unnamed control;
the icon inside carries `aria-hidden="true"` because it duplicates nothing. The plan asserts both:
a test that renders `variant="icon"` without a label and fails, and a test that the icon child is
hidden from the a11y tree.

**Target size: 24×24 CSS px minimum (WCAG 2.2 SC 2.5.8, AA), 32×32 house default.** The 44px AAA
figure (SC 2.5.5) is **not** adopted, and the reason is arithmetic, not preference: the header's
functional cluster measures a constant 287px and the spare width at 320px is ~10px. Three 32px
chips cannot become three 44px chips inside that budget. 32×32 clears AA with margin.

Outside the header there is no such constraint, and a primary action in body content should be
comfortably larger — `md` buttons already run `SPACE[4]`/`SPACE[6]` padding (~49px tall).

### 7.5 Where interaction styles live — a narrow amendment to "inline styles only"

`AGENTS.md` mandates inline styles. **Pseudo-classes cannot be expressed inline**, and the codebase
has already conceded this three times, each with its own scoped `<style>` block and its own recipe
(§3). Continuing that way means every new primitive ships a fourth, fifth and sixth spelling of the
same ring.

The amendment, stated so it does not creep:

> Resting appearance is inline. `:hover`, `:focus-visible` and `@media (hover:…)` — the states
> inline styles cannot reach — live in **one** stylesheet, `injectGlobalStyles()`, keyed off
> `data-ui` attributes the primitives set. Nothing else moves to CSS. No primitive injects a
> `<style>` of its own.

Concretely: `Button` renders `data-ui="button"` and `data-variant="primary"`; the global sheet
carries `[data-ui="button"]:focus-visible { … }` and the hover block. This deletes three
duplicated recipes, gives the 78 raw `<button>` elements a ring the moment they migrate, and keeps
"where is this style defined" answerable with one grep.

### 7.6 The busy state

```jsx
<Button busy={saving} onClick={save}>
  Speichern
</Button>
```

Contract:

1. `aria-busy="true"` on the button.
2. **`disabled` is NOT set.** A `disabled` element is removed from the tab order, and a button that
   drops out of the tab order at the moment it is activated takes the user's focus position with
   it — focus falls to `<body>` and keyboard context is lost. This is the same class of defect as a
   dialog that fails to restore focus on Escape (§10.2). Instead: `onClick` returns early while
   busy, and `pointer-events` stay live so focus is never disturbed.
3. **Width does not change.** The label stays rendered; the spinner is an overlay, or the label is
   swapped for one of equal measure. A button that narrows mid-press moves the controls beside it.
4. **The spinner respects `prefers-reduced-motion`.** `injectGlobalStyles()` already has a
   `@media (prefers-reduced-motion: reduce)` block that stops `pop`, `wiggle`, `slide-up` and
   confetti; the busy animation joins it, degrading to a static indicator rather than nothing —
   `aria-busy` alone is not a visible affordance.
5. `busy` and `disabled` are independent. `disabled` wins visually; both may be true.

---

## 8 · Surfaces

### 8.1 `Surface` — the base container

| Prop        | Type               | Default | Meaning                             |
| ----------- | ------------------ | ------- | ----------------------------------- |
| `elevation` | `0 \| 1 \| 2`      | `1`     | plane in the ramp                   |
| `padding`   | `SPACE` key or `0` | `4`     | uniform inner padding               |
| `radius`    | `RADIUS` key       | `'xl'`  | corner                              |
| `as`        | element type       | `'div'` | `'section'`, `'article'`, `'li'`, … |

| `elevation` | plane                    | recipe basis             |
| ----------- | ------------------------ | ------------------------ |
| 0           | `COLORS.paperDeep`       | `CARD.soft`              |
| 1           | `COLORS.surface`         | `CARD.base`              |
| 2           | `COLORS.surfaceElevated` | `CARD.base` + `surface3` |

**Every elevation carries `BORDER.panel` as well as `SHADOW.card`.** The shadow is a fixed
light-mode `rgba` and is nearly invisible on dark planes; the hairline is what actually separates
the card from its ground in dark mode. Shadow alone is not separation. This is why `CARD.base`
already has both, and the primitive must not "clean up" the apparent redundancy.

`CARD.dark` and `CARD.alert` are **not** elevations. They are inverted planes with their own paired
ink and belong to their call sites; making them elevation `3` and `4` would imply they sit higher
in the same ramp, which is how a card ends up with unreadable body text.

`Surface` is **not interactive** and takes no `onClick`. A clickable surface is §8.2 — a rule with
teeth, not a style preference (§9.1).

### 8.2 `InteractiveCard`

A card the user can activate: a deck tile, a league row, a scenario picker entry.

| Prop        | Type              | Default    |
| ----------- | ----------------- | ---------- |
| `as`        | `'button' \| 'a'` | `'button'` |
| `selected`  | boolean           | `false`    |
| `disabled`  | boolean           | `false`    |
| `elevation` | `0 \| 1 \| 2`     | `1`        |

**It renders a native `<button>` or `<a href>`. There is no third option, and `as` accepts nothing
else.** This is the primitive's entire reason to exist. Fourteen league rows shipped as
`<li onClick>` — unreachable by Tab, invisible to a screen reader as controls — and stayed that way
through a green 1,600-test suite, because nothing about a click handler on a list item is
detectable from the DOM assertions the tests were making. `role="button"` + `tabIndex={0}` +
`onKeyDown` is the wrong repair: it hand-rolls Enter/Space activation, the disabled state, form
participation and the focus ring that the native element gives for free.

Behaviour:

- Resting appearance = `Surface` at the same elevation, plus `cursor: pointer` and
  `SHADOW.press(COLORS.lip)`. Press mirrors `Button` (§7.2) so the whole app has one press feel.
- `selected` → `aria-pressed="true"` (button) or `aria-current="true"` (link), and a
  `BORDER` upgrade to `COLORS.borderStrong`. **Selection is never signalled by colour alone**
  (WCAG 1.4.1) — the border weight change is the non-colour channel.
- `disabled` → the native attribute on `<button>`; on `<a>`, the primitive drops `href` and sets
  `aria-disabled="true"`, because a disabled attribute does not exist for links.
- Text alignment resets: a `<button>` centres its content and inherits none of the page font, so
  the recipe sets `textAlign: 'left'`, `font: inherit`, `background`/`border` from the token, and
  `width: '100%'` where the card fills its track.

### 8.3 Nesting

A `<button>` may not contain a `<button>` — the HTML content model forbids it and browsers repair
it by un-nesting, which silently changes the DOM the tests assert against. An `InteractiveCard`
with its own affordance inside (a row with a "remove" control) is **two siblings in a `Row`**, not
a nest. The plan adds a guard test asserting no `InteractiveCard` descendant is a `Button`.

---

## 9 · Layout primitives and the 320px floor

Four primitives. Their purpose is not brevity — it is to make the four failure modes below
**unrepresentable**, each of which has already cost this project a bug.

### 9.1 The primitives

**`Stack`** — vertical flow. Props: `gap` (`SPACE` key, default `4`), `align`, `as`.
`display: flex; flexDirection: column`. This is where inter-block spacing lives, which is why
typography carries `margin: 0` (§6.1).

**`Row`** — horizontal flow. Props: `gap` (default `3`), `align` (default `'center'`),
`justify`, `wrap` (default `true`).
`wrap` defaults **true**: at 320px a non-wrapping row is the app's most common overflow source.
A caller that genuinely must not wrap passes `wrap={false}` and thereby writes down that it
accepted the risk.

**`Grid`** — Props: `columns` (number or `'auto-fit'`), `min` (px, for `auto-fit`), `gap`.
Emits `gridTemplateColumns` as `repeat(n, minmax(0, 1fr))` — **always**. A bare `1fr` keeps
`min-width: auto`, so the track refuses to shrink below its content and pushes the page wider than
the viewport. That defect shipped four separate times (`docs/DEMO_READINESS.md` #15–#17) and is
already a written rule in `AGENTS.md`; `Grid` is what makes it structural rather than remembered.
**`Grid` must never emit a bare `1fr`, and a test must assert the emitted string.**

**`PageFrame`** — the outermost per-tab wrapper. `maxWidth`, horizontal gutter from `SPACE`,
`marginInline: 'auto'`, and `paddingBottom: env(safe-area-inset-bottom, 0px)`. Not a `Stack` with
different defaults: it is the one place the safe-area inset and the max measure are decided, and
today those are re-derived per tab.

### 9.2 `minWidth: 0` — necessary, and not sufficient

`minWidth: 0` on a flex child is required for text to shrink below its intrinsic width. But it is
**not a fix on its own**, and believing it is has already burned this project:

> With `minWidth: 0`, overflow stops widening the container. It renders as text drawn on top of
> text instead. `scrollWidth` never exceeds `clientWidth`, so **no overflow assertion can catch it**
> — the layout is broken and every width test passes.

The rule, therefore:

> A flex child that can hold variable-length text sets `minWidth: 0` **and** declares what happens
> when it does not fit: it wraps (`Row`'s default), it truncates
> (`overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap`), or it scrolls in its own
> container. `minWidth: 0` with no stated overflow behaviour is an incomplete style, and reviewers
> should treat it as one.

`Row` and `Stack` apply `minWidth: 0` to themselves. They cannot apply it to children they do not
own, so the truncation decision stays with the caller — which is correct, because it is a content
decision, not a layout one.

### 9.3 320px is a floor, not a breakpoint

`bp.tiny` (414) is where decoration gives way. 320px is where the app must still function: every
control reachable, no horizontal page scroll, no overlapping text.

**Verification protocol** for any primitive PR touching layout:

1. Render at **320px and 375px**, in a real browser — not jsdom.
2. Measure `document.documentElement.scrollWidth - clientWidth`. **Not `window.innerWidth`**:
   in the in-app browser tools that value _grows with the overflow_, so it reports no overflow
   exactly when there is one.
3. Because of §9.2, a zero result is **necessary but not sufficient**. Also check each child's
   right edge against its parent's — overlapping text produces no overflow at all.
4. Test with a **populated account**. A fresh one hides the freeze chip, high levels and long rank
   names — the content that actually causes the overflow.

### 9.4 Responsive values are computed in JS

Where a responsive value must be **testable**, compute it with `useWindowWidth()` and the `bp`
helpers rather than a CSS `min()` / `calc()` / `clamp()`. jsdom reads those back mangled, so a
CSS-only clamp has no assertable form and the test that "covers" it is asserting a garbled string.

CSS clamps remain fine for purely decorative values no test needs to pin. `Heading size="display"`
(§6.5) is the worked example.

---

## 10 · Accessibility baseline

### 10.1 One focus ring

A new token group in `theme.js`:

```
FOCUS = {
  ring:  `2px solid ${COLORS.ink}`,
  offset: 2,      // outside — buttons, chips, standalone controls
  inset: -3,      // inside — full-bleed rows and cards, where an outside ring is clipped
}
```

Rules:

1. **The ring is `COLORS.ink`** — `var(--c-fg)`, the highest-contrast ink against every ground in
   both palettes. It flips with the mode automatically, so "the ring survives dark mode" needs no
   code.
2. **Two offsets, both justified.** `+2` for controls with air around them. `-3` for elements
   flush to a container edge, where an outside ring is clipped by the parent's `overflow` — the
   case `LeaderboardSection` already solved by hand. Any third value needs a reason in the PR.
3. **It lives in `injectGlobalStyles()`** on `[data-ui]:focus-visible`, once (§7.5). Not injected
   per component. Not `:focus` — `:focus-visible` so a mouse click does not ring.
4. **`outline: 'none'` is banned** unless the same rule provides an equivalent visible indicator.
   The plan adds a guard test over `src/components/**` for `outline: none` / `outline: 0`,
   allow-listed only alongside a replacement.
5. **The ring is never the only channel.** Focus and selection are different signals:
   `aria-pressed`/`aria-current` plus the `borderStrong` upgrade (§8.2) carry selection; the ring
   carries focus.

### 10.2 Focus management — the ring must survive Escape and modals

The app has seven Escape handlers and inconsistent restore. Codified:

1. **Any surface that opens over content restores focus to its opener on close** — Escape,
   outside-click, or an explicit close control, all three paths. Pattern:
   `openerRef.current?.focus()`, exactly what `ThemeChip` does today. Without it, dismissing
   drops focus to `<body>` and the keyboard user restarts from the top of the page.
2. **Modal vs non-modal is a real distinction and it decides the trap.**

   |                | modal                                         | non-modal popover                          |
   | -------------- | --------------------------------------------- | ------------------------------------------ |
   | examples       | `AuthSheet`, `FeedbackDialog`, `ProfileCard`  | the three header chips                     |
   | markup         | `role="dialog"` + `aria-modal="true"` + scrim | `aria-haspopup="dialog"` + `aria-expanded` |
   | `useFocusTrap` | **yes**                                       | **never**                                  |
   | Escape         | closes + restores                             | closes + restores                          |

   Trapping a non-modal popover strands the user inside a transient surface; a guard test already
   enforces this for the three chips and must not be weakened by a primitive that traps for its
   caller.

3. **A primitive never traps.** `useFocusTrap` is invoked by the dialog component, which owns the
   policy — which surfaces move focus in, which restore, which dismiss. Its doc comment already
   explains why folding that policy into a shared component trades three honest copies for one
   component with a policy matrix.
4. **Focus moves into a modal on open**, to the container (`tabIndex={-1}`) or the first control.
   Note the ordering hazard: React runs `autoFocus` during **commit**, before effects, so an effect
   that captures `document.activeElement` to remember the opener records the wrong element when the
   opened surface autofocuses something. Capture the opener in the **event handler that opens the
   surface**, not in an effect.

### 10.3 Minimum ARIA per primitive

| Primitive                           | Required                                                                    | Forbidden                                                  |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Heading`                           | native `<h1>`–`<h4>`; `as` used only with an intentional structure decision | `role="heading"` + `aria-level` when a native tag would do |
| `Body`, `Meta`                      | none (presentational)                                                       | using `Meta` as a control's only label (§6.3)              |
| `Button` all variants               | native `<button>`, explicit `type`                                          | `role="button"` on a non-button                            |
| `Button variant="icon"`             | `aria-label`; icon child `aria-hidden="true"`                               | an unnamed control                                         |
| `Button busy`                       | `aria-busy="true"`                                                          | the `disabled` attribute (§7.6)                            |
| toggle buttons                      | `aria-pressed`                                                              | colour-only pressed state                                  |
| disclosure buttons                  | `aria-expanded`, `aria-haspopup`                                            | omitting `aria-expanded` when a surface opens              |
| `Surface`                           | none; `as` for landmarks (`section`, `article`)                             | `onClick`                                                  |
| `InteractiveCard`                   | native `button`/`a`; `aria-pressed`/`aria-current` for `selected`           | `div` + `role` + `tabIndex` + `onKeyDown`                  |
| `Stack`, `Row`, `Grid`, `PageFrame` | none                                                                        | any role — layout is not semantics                         |

Lists keep their semantics: a list of `InteractiveCard`s is `<ul>` with `<li>` wrappers, each `<li>`
containing the native button. `Stack as="ul"` supports this without a wrapper div.

---

## 11 · Defects this spec fixes

Each is verified in §3 and each needs a **staged red** test — one that fails on today's code for
the stated reason before the fix lands. Five tests failing at one shared gate is one proven
assertion, not five.

| #   | Defect                                                                                                                             | Where                                            | Fix         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| 1   | `BUTTON.ghost` paints its label in the page-ground colour; invisible on a ground-coloured surface. Zero consumers, so never caught | `theme.js` `BUTTON.ghost`                        | §7.3        |
| 2   | Three divergent hand-rolled `:focus-visible` recipes; 78 raw buttons have none                                                     | `WelcomeGate`, `TrialWall`, `LeaderboardSection` | §7.5, §10.1 |
| 3   | No hover state anywhere                                                                                                            | `ui/Button`                                      | §7.2        |
| 4   | No busy/loading affordance anywhere                                                                                                | —                                                | §7.6        |
| 5   | `BUTTON.secondary` carries `flex: 1` — layout inside a colour token                                                                | `theme.js`                                       | §7.3        |
| 6   | Hex guard skips `.js` files and misses `rgb()`/`hsl()` notation                                                                    | `noHardcodedHex.test.js`                         | §4.2        |
| 7   | `Hero`'s `min(72px, 13vw)` is unassertable in jsdom                                                                                | `UI.jsx`                                         | §6.5        |
| 8   | Escape restores focus in some dismissible surfaces and not others                                                                  | seven components                                 | §10.2       |
| 9   | Caller `style` is outranked by `Button`'s press styles                                                                             | `ui/Button`                                      | §5.2        |

---

## 12 · Migration policy

**No big-bang migration.** 81 raw `<button>` elements and 30 raw `fontSize` literals are not one
PR, and a mass rewrite is reviewable only as a diff-shaped blur.

1. **New code uses primitives.** Non-negotiable from the first primitive PR.
2. **Migrate a surface when you are already editing it**, in that PR, and check it at 320px per
   §9.3. Opportunistic, not scheduled.
3. **Two exceptions get migrated deliberately**, because they are the ones that pay:
   - `UI.jsx`'s `Hero` / `SectionLabel` / `StatBlock` re-expressed over `Heading` / `Meta` /
     `Surface` / `Row` — 9 consumers change nothing, and this is where §11.7 lands.
   - The three hand-rolled focus rings deleted once the global rule is live — otherwise the app
     has four recipes instead of three.
4. **`ui/` stays flat.** Six files today, ~fourteen after this work. Sub-foldering at that size
   costs more in import churn than it returns.
5. **A primitive earns its place by a second consumer.** `Confetti` and `LevelSwitcher` sit in
   `ui/` with one consumer each; that is the drift this rule prevents. Anything one surface needs
   stays in that surface's folder until a second one asks.

---

## 13 · Test contract — what the plan must prove

Per primitive: renders, forwards `ref`, spreads `...rest` to the DOM node, respects the §5.2 merge
order, and carries its §10.3 ARIA baseline. Beyond that:

1. **Guard: no colour literals** — §4.2, widened and staged red against a fixture.
2. **Guard: no palette imports in `ui/`** — nothing under `src/components/ui/` imports
   `themeTokens`, `applyTheme` or `themeMode` (§4.1.3).
3. **Guard: `Grid` never emits a bare `1fr`** — assert the emitted `gridTemplateColumns` string.
4. **Guard: `outline: none` without a replacement** — §10.1.4.
5. **Guard: no `Button` inside an `InteractiveCard`** — §8.3.
6. **`variant="icon"` without `aria-label` fails**, and the icon child is `aria-hidden`.
7. **`busy` sets `aria-busy` and does NOT set `disabled`**, and the button stays focusable — assert
   `document.activeElement` is still the button after `busy` flips true.
8. **Heading semantics are independent of size** — `level={2} size="display"` renders `<h2>`.
9. **Contrast** — every new ink × surface pairing added to `contrast.test.js`, not eyeballed.
10. **320px** — the §9.3 protocol, in a real browser, with a populated account.

Two rules govern how these are written, both learned here the hard way:

- **A test that passes the first time you run it has proven nothing.** Break the thing it guards,
  watch it fail _for the stated reason_, restore. Two probes in this repo went green against
  broken code, each short-circuited by a different second defect.
- **A fixture that cannot express the failure cannot catch it.** Before asserting, ask what the
  fixture would have to contain for this test to fail — then put that in it. Four bugs survived one
  session because the fixture was too thin to fail. For these guards specifically: the colour-guard
  fixture needs a `rgba()` literal, the `Grid` fixture needs an `auto-fit` case, and the 320px
  fixture needs the long rank name and the freeze chip.
- **An audit must print its denominator.** "0 offenders" and "0 files scanned" print identically.
  Every guard test reports how many files it walked.

---

## 14 · Build sequence

Each step is a PR, each is independently green, each is reviewable on its own.

| #   | PR                                                                                                                                         | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | `FOCUS` token group + the global `[data-ui]:focus-visible` and hover rules in `injectGlobalStyles()`; delete the three hand-rolled recipes | —          |
| 2   | Widen the colour guard (§4.2); add the `ui/`-imports guard (§13.2)                                                                         | —          |
| 3   | `Heading`, `Body`, `Meta` + contrast pairs                                                                                                 | 1          |
| 4   | `Button`: `icon` variant, repaired `ghost`, hover, `busy`, merge-order fix, `flex:1` removed from `secondary`                              | 1          |
| 5   | `Surface`, `InteractiveCard` + the nesting guard                                                                                           | 1, 4       |
| 6   | `Stack`, `Row`, `Grid`, `PageFrame` + the `1fr` guard                                                                                      | —          |
| 7   | `UI.jsx` composites re-expressed over the primitives; `Hero`'s CSS clamp → JS                                                              | 3, 5, 6    |

PRs 1, 2 and 6 have no dependency on each other and can run in parallel. **PR 4 is the only one
with visible behaviour changes** (`secondary` loses `flex: 1`, `ghost` changes colour) — every
consumer gets checked in that PR, not after it.

---

## 15 · Open questions for the product owner

1. **Does `ghost` have a real use?** It has zero consumers today. §7.3 repairs it, but the honest
   alternative is deleting it and adding it back when a surface asks. Repairing an unused variant
   means shipping a recipe no screen has ever shown.
2. **Is there a use for `COLORS.accentAlt`?** It has sat unused since the theme arc began and is
   noted as such in `themeTokens.js`. If nothing claims it during 1b, it should be retired rather
   than carried.
3. **`size="sm"` on `Button` — is it needed?** The app currently has one button scale. Adding a
   second before a surface asks for it is speculative; it is in §7.1 because `icon` plausibly needs
   28px in the header, and that is the only evidence for it.
