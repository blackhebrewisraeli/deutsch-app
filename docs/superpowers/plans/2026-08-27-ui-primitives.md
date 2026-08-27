# UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typography, button, surface and layout primitives specified in the UI primitive design contract, and close the nine defects that spec found.

**Architecture:** Primitives live one-per-file in `src/components/ui/`, are pure functions of props plus the CSS custom properties `applyTheme()` writes onto `:root`, and read every value from `src/lib/theme.js`. Resting appearance is inline (the house rule); the three states inline styles cannot express — `:hover`, `:focus-visible`, and the hover media gate — move into the single existing stylesheet, `injectGlobalStyles()`, keyed off `data-ui` attributes. Four guard tests make the recurring structural defects (colour literals, bare `1fr` grid tracks, `outline: none`, nested buttons) unrepresentable rather than remembered.

**Tech Stack:** React 18, Vite 5, inline styles, Vitest (`globals: false`) + React Testing Library + `@testing-library/user-event`, jsdom, ESLint 10 flat config, Prettier, husky pre-commit running lint-staged **and** the full suite.

**Spec:** `docs/ui-primitives-spec.md` — read it alongside this plan. Section references below (§4.2, §7.6, …) point into it.

## Global Constraints

Every task's requirements implicitly include all of these. Values are copied verbatim from the spec.

- **Tokens only.** Every colour, radius, shadow, space, font, size, weight, letter-spacing, transition and z-index comes from `src/lib/theme.js`. No primitive names a raw value. (§4.1.1)
- **No colour literals, any notation.** No `#rgb` / `#rrggbb` / `#rrggbbaa`, no `rgb()` / `rgba()` / `hsl()` / `hsla()`, no `color-mix()` over literals, no CSS named colours. `transparent` and `currentColor` are permitted. (§4.2)
- **No palette imports in `src/components/ui/`.** Nothing under that directory may import `themeTokens.js`, `applyTheme.js` or `themeMode.js`. Those are the layer below; reading raw palette values re-introduces the mode branch CSS variables exist to delete. (§4.1.3)
- **Light/dark is inherent, never conditional.** No mode reads, no `mode === 'dark' ? … : …` in any style object. (§4.3)
- **Merge order is `{ ...recipe, ...stateStyles, ...style }`.** The caller's `style` wins over the resting recipe *and* over state styles. (§5.2)
- **`...rest` spreads onto the rendered DOM node**, after the primitive's own attributes. `ref` forwards to the outermost DOM node. (§5.3, §5.4)
- **No app state in a primitive.** No storage, no `activePack`, no network, no analytics. No German, no copy of any kind. (§5.6, §5.7)
- **Grid tracks are always `minmax(0, 1fr)`, never a bare `1fr`.** (`AGENTS.md`, §9.1)
- **Tests import from `'vitest'` explicitly** — the suite runs `globals: false`. Co-locate as `<Name>.test.jsx` beside the source.
- **Never bypass `.husky/pre-commit`.** `--no-verify` is forbidden. A green commit is the passing signal.
- **One branch per task, PR into `main`.** Never commit to `main` directly.
- **Targeted test run:** `npx vitest run <path>`. Full suite: `npm test`. Lint: `npm run lint`.

## Two rules that govern how the tests in this plan are written

Both were learned the hard way in this repo and both are load-bearing here, because five of the seven tasks are guard tests:

1. **A test that passes the first time you run it has proven nothing.** Every task below has an explicit "run it and watch it fail" step naming the expected failure message. If a step says a test should fail and it passes, **stop** — the test is not reaching the code you think it is. Do not proceed to the implementation step.
2. **A fixture that cannot express the failure cannot catch it.** Before asserting, ask what the fixture would have to contain for this test to fail. The colour guard needs an `rgba()` fixture, the `Grid` guard needs an `auto-fit` case, the 320px check needs a long rank name and a populated account.

---

## File Structure

**Created — 10 files (5 primitives + 5 tests):**

| File | Responsibility |
| ---- | -------------- |
| `src/components/ui/Heading.jsx` | Semantic heading with `level` (document structure) decoupled from `size` (visual) |
| `src/components/ui/Text.jsx` | `Body` and `Meta` — the two non-heading text recipes. **One file, two named exports**, because they share the identical `tone` map and splitting them would duplicate it |
| `src/components/ui/Surface.jsx` | Non-interactive container; the elevation ramp |
| `src/components/ui/InteractiveCard.jsx` | Activatable card; guarantees a native `<button>`/`<a>` |
| `src/components/ui/Layout.jsx` | `Stack`, `Row`, `Grid`, `PageFrame` — **one file, four named exports**. Each is 5–15 lines of flex/grid config over the same `SPACE` scale; four files would be four import lines for one idea |
| `src/components/ui/*.test.jsx` | Co-located test per source file above |

`Text.jsx` and `Layout.jsx` are deliberate multi-export exceptions to "one primitive per file" (§5.1). The rule exists so a caller can find a primitive by filename; a caller looking for `Stack` finds it in `Layout.jsx` on the first grep, and the alternative is four near-identical files sharing a gap scale that would drift.

**Modified — 8 files:**

| File | Change |
| ---- | ------ |
| `src/lib/theme.js` | Add `FOCUS` group; add `BUTTON.icon`; repair `BUTTON.ghost`; drop `flex: 1` from `BUTTON.secondary` |
| `src/lib/injectGlobalStyles.js` | Add the `:focus-visible` and `:hover` rules |
| `src/lib/injectGlobalStyles.test.js` | Assert those rules |
| `src/components/ui/Button.jsx` | `data-ui` attrs, `busy`, `size`, merge-order fix |
| `src/components/noHardcodedHex.test.js` | Widen file walk and pattern; print the denominator |
| `src/components/WelcomeGate.jsx`, `TrialWall.jsx`, `stats/LeaderboardSection.jsx` | Delete the three hand-rolled focus recipes |
| `src/components/UI.jsx` | Re-express `Hero` / `SectionLabel` / `StatBlock` over the primitives |
| `src/components/auth/GoogleButton.jsx` | `disabled={busy}` → `busy={busy}` |

**Task order and dependencies.** Tasks 1-7 are spec §14's build sequence verbatim. **Task 8 is an addition**: §14 has no PR for spec defect §11.8 (Escape restores focus in some dismissible surfaces and not others), which is a hole in §14 — the focus ring is only half of "focus survives Escape/modals", and a ring nobody can get back to is not focus management. Tasks 1, 2, 6 and 8 are independent of each other and may run in parallel:

```
1 (focus + hover CSS) ─┬─> 3 (typography) ─┬─> 7 (UI.jsx composites)
                       └─> 4 (Button) ──> 5 (Surface, InteractiveCard) ─┘
2 (guards)   [independent]                   6 (layout) ────────────────┘
8 (Escape restore)  [independent]
```

---

## Task 1: The focus ring and hover, defined once

Closes spec defects §11.2 (three divergent hand-rolled `:focus-visible` recipes, and no global rule at all — 78 raw `<button>` elements show only the UA default) and §11.3 (no hover state anywhere).

**Files:**
- Modify: `src/lib/theme.js` — add `FOCUS` after the `TRANSITION` group (~line 190)
- Modify: `src/lib/injectGlobalStyles.js:11-46` — the template string
- Modify: `src/lib/injectGlobalStyles.test.js`
- Modify: `src/components/WelcomeGate.jsx:55-70`
- Modify: `src/components/TrialWall.jsx:119-140`
- Modify: `src/components/stats/LeaderboardSection.jsx:17-28`

**Interfaces:**
- Produces: `FOCUS` exported from `src/lib/theme.js`, shape `{ ring: string, offset: number, inset: number }`. Tasks 4, 5 and 6 rely on the global CSS selector contract: **any element carrying a `data-ui` attribute gets the ring for free**, and adding `data-focus-inset` switches it to the inset offset.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test for the global focus rule**

Append to `src/lib/injectGlobalStyles.test.js`, inside the existing `describe('injectGlobalStyles', …)` block:

```jsx
  // Before this rule existed the app had three hand-rolled `:focus-visible`
  // recipes (WelcomeGate, TrialWall, LeaderboardSection) with three different
  // spellings, and the other 78 raw <button> elements had no ring at all.
  // Keying off [data-ui] means a primitive opts in by existing.
  it('gives every [data-ui] element a focus-visible ring', () => {
    injectGlobalStyles();
    expect(sheet()).toMatch(/\[data-ui\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('uses the theme ink for the ring, so it flips with the mode', () => {
    injectGlobalStyles();
    // var(--c-fg), not a literal — the ring must not be a light-mode colour.
    expect(sheet()).toMatch(/\[data-ui\]:focus-visible\s*\{[^}]*var\(--c-fg\)/);
  });

  it('offers an inset offset for full-bleed rows', () => {
    injectGlobalStyles();
    // League rows are flush to their container, so an outset ring is clipped
    // by the parent edge and overlaps the neighbouring row.
    expect(sheet()).toMatch(/\[data-focus-inset\]:focus-visible\s*\{[^}]*outline-offset:\s*-3px/);
  });

  it('gates button hover behind a fine pointer', () => {
    injectGlobalStyles();
    // Without the gate a touch device latches the hover style on tap and keeps
    // it until the next tap elsewhere. This app is phone-first, so that is the
    // common case, not the edge case.
    expect(sheet()).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
  });

  it('does not apply hover to a disabled or busy button', () => {
    injectGlobalStyles();
    const hoverRule = sheet().match(/\[data-ui="button"\][^{]*:hover/)?.[0] ?? '';
    expect(hoverRule).toContain(':not([disabled])');
    expect(hoverRule).toContain(':not([aria-busy="true"])');
  });
```

- [ ] **Step 2: Run it and watch all five fail**

Run: `npx vitest run src/lib/injectGlobalStyles.test.js`

Expected: **5 failed**, each because `sheet()` returns the current stylesheet, which contains no `:focus` or `:hover` rule of any kind. The failure text shows the received string with no match.

> These five fail at five *different* assertions, not one shared gate — each names a distinct missing rule. That is what makes them five proven assertions rather than one.

- [ ] **Step 3: Add the `FOCUS` token group**

In `src/lib/theme.js`, immediately after the `TRANSITION` block and before `// ── Z-index ──`:

```js
// ── Focus ────────────────────────────────────────────────────
// One ring for the whole app. `COLORS.ink` is var(--c-fg), the highest-contrast
// ink against every ground in both palettes, so the ring flips with the mode
// with no code. Two offsets, both earned: `offset` for controls with air around
// them, `inset` for elements flush to a container edge where an outset ring is
// clipped by the parent's overflow and overlaps its neighbour. A third value
// needs a reason.
//
// Consumed by injectGlobalStyles(), not by components: :focus-visible cannot be
// expressed inline, so the rule lives in the one global sheet and every element
// carrying a `data-ui` attribute picks it up.
export const FOCUS = {
  ring: `2px solid ${COLORS.ink}`,
  offset: 2,
  inset: -3,
};
```

- [ ] **Step 4: Add the rules to the global stylesheet**

In `src/lib/injectGlobalStyles.js`, add the import at the top of the file:

```js
import { FOCUS } from './theme';
```

Then insert this block into the template string, immediately after the `button { font-family: inherit; cursor: pointer; }` line:

```js
    /* One focus ring for the whole app. Any element with a [data-ui] attribute
       gets it — that is how a primitive opts in. :focus-visible, not :focus, so
       a mouse click does not ring. */
    [data-ui]:focus-visible {
      outline: ${FOCUS.ring};
      outline-offset: ${FOCUS.offset}px;
    }
    /* Full-bleed rows and cards: an outset ring is clipped by the container. */
    [data-ui][data-focus-inset]:focus-visible { outline-offset: ${FOCUS.inset}px; }
    /* Hover is gated on a fine pointer: a touch device latches the hover style
       on tap and keeps it until the next tap elsewhere. brightness() rather than
       a hover token per variant — seven variants x two modes is fourteen palette
       entries to keep in contrast, to express "slightly lighter". A relative
       filter cannot drift out of contrast, because it moves plane and ink
       together. */
    @media (hover: hover) and (pointer: fine) {
      [data-ui="button"]:not([disabled]):not([aria-busy="true"]):hover { filter: brightness(1.04); }
    }
```

- [ ] **Step 5: Run the test and watch all five pass**

Run: `npx vitest run src/lib/injectGlobalStyles.test.js`

Expected: PASS, 9 tests (4 pre-existing + 5 new).

- [ ] **Step 6: Delete the WelcomeGate hand-rolled recipe**

In `src/components/WelcomeGate.jsx`, delete both the comment and the `<style>` line at 55-57:

```jsx
      {/* Inline styles can't express :focus-visible; a scoped rule gives the
          bare guest button a visible focus ring against the ground colour. */}
      <style>{`.welcome-guest:focus-visible { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; border-radius: 4px; }`}</style>
```

On the `<button className="welcome-guest">` below it, drop the `className` and add `data-ui="button"`. Add `borderRadius: SPACE[1]` to its inline style — the deleted rule set `border-radius: 4px` so the ring rounded, and an outline follows the element's own radius, so the radius has to move onto the element to preserve the appearance exactly:

```jsx
        <button
          data-ui="button"
          onClick={onGuest}
          style={{
            background: 'none',
            border: 'none',
            borderRadius: SPACE[1],
            color: COLORS.ink,
```

Leave the rest of that style block untouched. If `COLORS` is now unused in the file, remove it from the import — `npm run lint` will say so.

- [ ] **Step 7: Delete the TrialWall hand-rolled recipe**

In `src/components/TrialWall.jsx`, delete the comment and `<style>` at 119-122, then on `<button className="trial-tertiary">` drop the `className`, add `data-ui="button"`, and add `borderRadius: SPACE[1]` to its inline style — same reasoning as Step 6.

- [ ] **Step 8: Delete the LeaderboardSection hand-rolled recipe**

In `src/components/stats/LeaderboardSection.jsx`, delete the `ROW_FOCUS_CSS` constant (lines 17-28) and the `<style>{ROW_FOCUS_CSS}</style>` element that renders it. On each row element that carried `ROW_CLASS`, replace `className={ROW_CLASS}` with `data-ui="button" data-focus-inset=""`. Delete the now-unused `ROW_CLASS` constant.

> `data-focus-inset=""` — an empty string, not `{true}`. React omits a `data-*` attribute set to `false` but renders `data-focus-inset="true"` for `true`, and the CSS attribute selector `[data-focus-inset]` matches either. The empty string is the honest spelling of a valueless flag.

- [ ] **Step 9: Verify no hand-rolled recipe survives**

Run: `grep -rn "focus-visible" --include='*.jsx' src/components`

Expected: **no output.** Every `:focus-visible` now lives in `injectGlobalStyles.js`. If anything prints, it was missed.

- [ ] **Step 10: Run the affected suites and lint**

Run: `npx vitest run src/lib/injectGlobalStyles.test.js src/components/WelcomeGate.test.jsx src/components/TrialWall.test.jsx src/components/stats/`

Expected: PASS. Then `npm run lint` — expected clean, and it is what catches a now-unused `COLORS` import from Steps 6-8.

- [ ] **Step 11: Verify the ring in a real browser**

jsdom computes no layout and does not implement `:focus-visible`, so the assertions above prove the *rule exists*, not that it *renders*. Start the dev server via the preview tool, Tab to the guest button on the welcome screen, and screenshot. Expected: a 2px ink ring, offset 2px, rounded. Then switch to dark mode and Tab again — expected: the ring is now near-white, because `var(--c-fg)` flipped, with no code involved.

- [ ] **Step 12: Commit**

```bash
git add src/lib/theme.js src/lib/injectGlobalStyles.js src/lib/injectGlobalStyles.test.js src/components/WelcomeGate.jsx src/components/TrialWall.jsx src/components/stats/LeaderboardSection.jsx
git commit -m "feat(ui): one focus ring and one hover rule for the whole app"
```

---

## Task 2: Widen the guards

Closes spec defect §11.6. Two guards: the colour-literal guard gets its two holes closed, and a new guard keeps the palette layer out of `ui/`.

**Files:**
- Modify: `src/components/noHardcodedHex.test.js` (rename the file to `src/components/noHardcodedColors.test.js` — the guard is no longer hex-only)
- Create: `src/components/ui/tokenBoundary.test.js`

**Interfaces:**
- Consumes: nothing. Produces: nothing importable. Both are guards; later tasks are *constrained* by them, not built on them.

- [ ] **Step 1: Stage the red with a fixture that can actually fail**

Before touching the guard, prove the current one is blind to what we are about to add. Temporarily add this line to `src/components/ui/Confetti.jsx` (any component works; this one is small):

```jsx
const FIXTURE_DO_NOT_KEEP = { background: 'rgba(0, 0, 0, 0.5)', border: '1px solid white' };
```

Run: `npx vitest run src/components/noHardcodedHex.test.js`

Expected: **PASS.** That is the bug — a functional-notation colour literal and a CSS named colour both sail through a hex-only regex. Leave the fixture in place for Step 3.

- [ ] **Step 2: Rename the file and widen it**

```bash
git mv src/components/noHardcodedHex.test.js src/components/noHardcodedColors.test.js
```

Replace the file's contents with:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
const COMPONENTS_DIR = 'src/components';

// Hex in any length, plus the functional notations and the CSS named colours
// that actually turn up in real code. A hex-only guard let `rgba(0,0,0,.5)` and
// `white` through, and it skipped .js files entirely — both holes are why this
// file is no longer called noHardcodedHex.
//
// `transparent` and `currentColor` are deliberately absent: they are relative,
// not absolute, and follow the theme.
const COLOR = new RegExp(
  [
    '#[0-9a-fA-F]{3,8}\\b',
    '\\b(?:rgba?|hsla?)\\s*\\(',
    '\\b(?:white|black|red|green|blue|grey|gray)\\b\\s*[,;\'"`]',
  ].join('|')
);

function walkSources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkSources(full, out);
      continue;
    }
    // Component sources only — tests may assert resolved values. Both .jsx and
    // .js: five non-test .js files under src/components were unscanned before.
    if (/\.(jsx|js)$/.test(name) && !/\.test\.(jsx|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('no hardcoded colours in components', () => {
  it('fails if any non-test source under src/components contains a colour literal', () => {
    const files = walkSources(COMPONENTS_DIR);
    // Print the denominator: "0 offenders" and "0 files scanned" otherwise
    // print identically, and a guard that walks nothing passes forever.
    expect(files.length).toBeGreaterThan(50);

    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (COLOR.test(line)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `scanned ${files.length} files; hardcoded colour literals:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch the fixture get caught**

Run: `npx vitest run src/components/noHardcodedColors.test.js`

Expected: **FAIL**, naming `ui/Confetti.jsx:<n>` with the `rgba(0, 0, 0, 0.5)` line, and the message beginning `scanned 63 files;`. Both halves matter: the offender proves the regex reaches, the count proves the walk reaches.

- [ ] **Step 4: Delete the fixture and confirm green**

Remove the `FIXTURE_DO_NOT_KEEP` line from `src/components/ui/Confetti.jsx`.

Run: `npx vitest run src/components/noHardcodedColors.test.js`

Expected: PASS. If it fails, the widened regex has found a **real** pre-existing offender in a `.js` file that was never scanned before — read it and fix it with a token before continuing.

- [ ] **Step 5: Write the failing token-boundary guard**

Create `src/components/ui/tokenBoundary.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const UI_DIR = 'src/components/ui';

// The layer below theme.js. A primitive that reads these is reading raw palette
// values, which re-introduces the light/dark branch that CSS custom properties
// exist to delete — every COLORS.* entry is already a var(--c-…) resolved on
// :root, so a correct primitive contains no mode logic at all.
const FORBIDDEN = ['themeTokens', 'applyTheme', 'themeMode'];

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sources(full, out);
      continue;
    }
    if (/\.(jsx|js)$/.test(name) && !/\.test\.(jsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

describe('ui primitives stay above the palette layer', () => {
  it('imports no palette module, and reads no theme mode', () => {
    const files = sources(UI_DIR);
    expect(files.length).toBeGreaterThan(5);

    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const isImport = /^\s*import\b/.test(line);
        if (isImport && FORBIDDEN.some((m) => line.includes(m))) {
          offenders.push(`${relative(UI_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `scanned ${files.length} files; palette-layer imports in ui/:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
```

- [ ] **Step 6: Stage its red too**

Temporarily add to `src/components/ui/Confetti.jsx`:

```jsx
import { MODE_COLORS } from '../../lib/themeTokens';
```

Run: `npx vitest run src/components/ui/tokenBoundary.test.js`

Expected: **FAIL**, naming `Confetti.jsx:1` and the import line, with `scanned 6 files;`.

- [ ] **Step 7: Delete the fixture, confirm green, lint, commit**

Remove the import. Run `npx vitest run src/components/ui/tokenBoundary.test.js` → PASS. Run `npm run lint` → clean.

```bash
git add src/components/noHardcodedColors.test.js src/components/ui/tokenBoundary.test.js
git commit -m "test(ui): widen the colour guard and fence the palette layer out of ui/"
```

---

## Task 3: Typography — `Heading`, `Body`, `Meta`

Replaces the 30 raw `fontSize` literals and the 7 loose `<h1>`–`<h4>` tags with three primitives. Depends on Task 1 only for the `data-ui` convention (typography is not interactive, so it carries no ring).

**Contrast is already discharged — do not add pairs.** `src/lib/contrast.test.js:100-110` already sweeps all three tone inks (`fg`, `fg-muted`, `fg-subtle` — i.e. `default` / `muted` / `soft`) against all three surface steps in both mode palettes, at AA. The spec's §6.4 obligation flagged `tone="muted"` on `surface3` as the pairing most likely to be new; it is named in that sweep as `light fg-muted on surface-3` / `dark fg-muted on surface-3`. Verify by running `npx vitest run src/lib/contrast.test.js -t "on surface-3"` and reading the test names. **Adding duplicate pairs would be noise, not coverage.**

**Files:**
- Create: `src/components/ui/Heading.jsx`, `src/components/ui/Heading.test.jsx`
- Create: `src/components/ui/Text.jsx`, `src/components/ui/Text.test.jsx`

**Interfaces:**
- Consumes: `TEXT`, `FONTS`, `FONT_SIZE`, `COLORS` from `src/lib/theme`; `useWindowWidth` from `src/lib/useWindowWidth`.
- Produces:
  - `Heading` (default export of `Heading.jsx`) — props `{ level?: 1|2|3|4, size?: 'display'|'xl'|'lg'|'md'|'sm', as?: ElementType, tone?: 'default'|'soft'|'muted', style?, children, ...rest }`
  - `Body`, `Meta` (named exports of `Text.jsx`) — `Body` props `{ size?: 'md'|'sm', tone?, as?: 'p'|'span'|'div', style?, children, ...rest }`; `Meta` props `{ tone?, as?: 'span'|'div', style?, children, ...rest }`
  - `TONE` (named export of `Text.jsx`) — `{ default: COLORS.ink, soft: COLORS.inkSoft, muted: COLORS.mute }`, imported by `Heading.jsx` so the map is defined once.

Task 7 relies on all four names.

- [ ] **Step 1: Write the failing tests for `Heading`**

Create `src/components/ui/Heading.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Heading from './Heading';

describe('Heading', () => {
  it('renders the tag its level names', () => {
    render(<Heading level={3}>Vokabeln</Heading>);
    expect(screen.getByRole('heading', { level: 3, name: 'Vokabeln' })).toBeInTheDocument();
  });

  it('defaults to level 2', () => {
    render(<Heading>Vokabeln</Heading>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  // The whole reason level and size are separate props. A system where one prop
  // drives both eventually ships an <h4> styled as a page title, and heading
  // order is what a screen-reader user navigates by.
  it('keeps semantics when only the visual size changes', () => {
    render(
      <Heading level={2} size="sm">
        Vokabeln
      </Heading>
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('keeps the visual size when only the element changes', () => {
    const { container } = render(
      <Heading level={2} as="div">
        Vokabeln
      </Heading>
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('carries no margin, so Stack owns vertical rhythm', () => {
    render(<Heading>Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ margin: '0px' });
  });

  it('applies the tone ink', () => {
    render(<Heading tone="muted">Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ color: 'var(--c-fg-muted)' });
  });

  it("lets the caller's style win over the recipe", () => {
    render(<Heading style={{ letterSpacing: '1px' }}>Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ letterSpacing: '1px' });
  });

  it('spreads rest props onto the DOM node', () => {
    render(<Heading data-testid="h">Vokabeln</Heading>);
    expect(screen.getByTestId('h')).toBeInTheDocument();
  });

  // jsdom reads `min(72px, 13vw)` back mangled, so a CSS clamp here has no
  // assertable form. Computing it in JS gives the same rendered result and a
  // number a test can pin.
  it('computes the display size in JS, not CSS', () => {
    window.innerWidth = 320;
    render(<Heading level={1} size="display">Wortschatz</Heading>);
    // min(72, 320 * 0.13) = 41.6
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '41.6px' });
  });

  it('caps the display size at 72px on wide viewports', () => {
    window.innerWidth = 1200;
    render(<Heading level={1} size="display">Wortschatz</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '72px' });
  });
});
```

- [ ] **Step 2: Run and watch every test fail**

Run: `npx vitest run src/components/ui/Heading.test.jsx`

Expected: **FAIL** at collection — `Failed to resolve import "./Heading"`. That is one shared gate, so it proves only that the file is missing. The per-assertion proof comes in Step 5, after the file exists.

- [ ] **Step 3: Write `Heading`**

Create `src/components/ui/Heading.jsx`:

```jsx
import { TEXT, FONT_SIZE } from '../../lib/theme';
import { useWindowWidth } from '../../lib/useWindowWidth';
import { TONE } from './Text';

// `level` is document semantics, `size` is appearance, and they are separate
// props on purpose. Heading order is an a11y contract — a screen-reader user
// navigating by heading needs h1 → h2 → h3 to reflect structure, not visual
// weight. One prop driving both is how a design system ends up with an <h4>
// styled as a page title.
const SIZE = {
  xl: FONT_SIZE['3xl'], // 24
  lg: FONT_SIZE['2xl'], // 20
  md: FONT_SIZE.xl, // 18
  sm: FONT_SIZE.lg, // 16
};

const LEVEL_SIZE = { 1: 'display', 2: 'xl', 3: 'lg', 4: 'md' };

// The display size is computed in JS rather than as `min(72px, 13vw)`, because
// jsdom reads CSS min()/calc() back mangled and a clamp written that way has no
// assertable form — the test that "covers" it is asserting a garbled string.
// 13vw reaches 72px at ~554px, so desktop is unchanged and only small viewports
// scale down. This is the same curve Hero shipped, in a form a test can pin.
const DISPLAY_MAX = 72;
const DISPLAY_VW = 0.13;

export default function Heading({
  level = 2,
  size,
  as,
  tone = 'default',
  style,
  children,
  ...rest
}) {
  const width = useWindowWidth();
  const Tag = as ?? `h${level}`;
  const key = size ?? LEVEL_SIZE[level] ?? 'xl';
  const fontSize = key === 'display' ? Math.min(DISPLAY_MAX, width * DISPLAY_VW) : SIZE[key];

  return (
    <Tag
      style={{
        ...TEXT.display,
        fontSize,
        color: TONE[tone] ?? TONE.default,
        // Spacing between blocks belongs to Stack. A heading that carries its
        // own margin makes vertical rhythm unpredictable in a flex column.
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Write the failing tests for `Body` and `Meta`**

Create `src/components/ui/Text.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Body, Meta } from './Text';

describe('Body', () => {
  it('renders a paragraph by default', () => {
    const { container } = render(<Body>Ein Satz.</Body>);
    expect(container.firstChild.tagName).toBe('P');
  });

  it('renders the element `as` names', () => {
    const { container } = render(<Body as="span">Ein Satz.</Body>);
    expect(container.firstChild.tagName).toBe('SPAN');
  });

  // WCAG 1.4.12 minimum for body text, and what Hero's subtitle already uses.
  it('sets a 1.5 line height', () => {
    render(<Body data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ lineHeight: '1.5' });
  });

  it('carries no margin', () => {
    render(<Body data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ margin: '0px' });
  });

  it('applies the tone ink', () => {
    render(<Body tone="soft" data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ color: 'var(--c-fg-subtle)' });
  });

  it("lets the caller's style win", () => {
    render(<Body style={{ lineHeight: '2' }} data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ lineHeight: '2' });
  });
});

describe('Meta', () => {
  it('renders a span by default', () => {
    const { container } = render(<Meta>Streak</Meta>);
    expect(container.firstChild.tagName).toBe('SPAN');
  });

  it('defaults to the muted tone', () => {
    render(<Meta data-testid="m">Streak</Meta>);
    expect(screen.getByTestId('m')).toHaveStyle({ color: 'var(--c-fg-muted)' });
  });

  // Uppercasing via CSS, never in the string: the accessible name stays in its
  // authored case, which is what a screen reader should read out.
  it('uppercases with CSS, leaving the text node in its authored case', () => {
    render(<Meta data-testid="m">Streak</Meta>);
    const el = screen.getByTestId('m');
    expect(el).toHaveStyle({ textTransform: 'uppercase' });
    expect(el.textContent).toBe('Streak');
  });
});
```

- [ ] **Step 5: Write `Text.jsx`, then run both suites and watch each assertion earn its pass**

Create `src/components/ui/Text.jsx`:

```jsx
import { TEXT, FONTS, FONT_SIZE, COLORS } from '../../lib/theme';

// Three tones, no more. There is deliberately no `accent` tone: accents in this
// system are FILLS, each paired with its own ink, and an accent used as a
// foreground is the drift that contrast.test.js exists to catch. A caller who
// needs accent ink on an accent fill passes the paired ink through `style` and
// owns the pairing.
//
// All three inks are already swept against ground and all three surface steps,
// in both mode palettes — see contrast.test.js:100-110.
export const TONE = {
  default: COLORS.ink,
  soft: COLORS.inkSoft,
  muted: COLORS.mute,
};

const BODY_SIZE = { md: FONT_SIZE.md, sm: FONT_SIZE.base };

export function Body({ size = 'md', tone = 'default', as: Tag = 'p', style, children, ...rest }) {
  return (
    <Tag
      style={{
        fontFamily: FONTS.body,
        fontSize: BODY_SIZE[size] ?? BODY_SIZE.md,
        color: TONE[tone] ?? TONE.default,
        lineHeight: 1.5,
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// The uppercase mono label: captions, counts, kickers, section markers.
//
// Meta is PRESENTATIONAL, and that is a hazard worth stating. A 10px muted mono
// string beside a control is not that control's label — the control still needs
// its own aria-label, or an aria-labelledby pointing at this node. "The label is
// right there on screen" is the reasoning that made 52 aria-label attributes
// necessary after the fact.
export function Meta({ tone = 'muted', as: Tag = 'span', style, children, ...rest }) {
  return (
    <Tag style={{ ...TEXT.label, color: TONE[tone] ?? TONE.muted, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
```

Run: `npx vitest run src/components/ui/Heading.test.jsx src/components/ui/Text.test.jsx`

Expected: PASS, 17 tests.

- [ ] **Step 6: Prove the two tests most likely to pass for the wrong reason**

Two assertions here could go green against broken code, so break each and watch it fail *for its own reason*:

1. **Semantics independent of size.** In `Heading.jsx`, temporarily change `const Tag = as ?? \`h${level}\`` to `const Tag = as ?? (key === 'display' ? 'h1' : \`h${level}\`)`. Run the Heading suite. Expected: *"keeps semantics when only the visual size changes"* still passes (it uses `size="sm"`), but a `level={2} size="display"` case would not — so **add that case** and confirm it fails before restoring:

```jsx
  it('keeps semantics at the display size too', () => {
    render(<Heading level={2} size="display">Wortschatz</Heading>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
```

2. **The JS-computed clamp.** Temporarily replace the computed `fontSize` with the literal `'min(72px, 13vw)'`. Run the Heading suite. Expected: both display tests **fail**, and the failure output shows the mangled string jsdom reads back — which is the whole argument for computing it in JS. Restore.

- [ ] **Step 7: Lint and commit**

Run: `npm run lint` → clean.

```bash
git add src/components/ui/Heading.jsx src/components/ui/Heading.test.jsx src/components/ui/Text.jsx src/components/ui/Text.test.jsx
git commit -m "feat(ui): Heading, Body and Meta primitives"
```

---

## Task 4: `Button` — icon variant, repaired ghost, hover, busy, merge order

The only task in this plan with **visible behaviour changes**, so every consumer gets checked here, not after. Closes spec defects §11.1 (`ghost` invisible), §11.4 (no busy state), §11.5 (`flex: 1` inside a colour token) and §11.9 (caller `style` outranked by press styles).

**Files:**
- Modify: `src/lib/theme.js` — the `BUTTON` group (~lines 205-250)
- Modify: `src/components/ui/Button.jsx` (whole file)
- Modify: `src/components/ui/Button.test.jsx`
- Modify: `src/components/auth/GoogleButton.jsx:29-31`
- Check (and fix if the removal of `flex: 1` moved anything): the 7 `variant="secondary"` call sites — `FeedbackDialog.jsx:253`, `WelcomeGate.jsx:63`, `TrialWall.jsx:144`, `stats/AccountSection.jsx:84,90,146,239`

**Interfaces:**
- Consumes: the `data-ui="button"` CSS contract from Task 1.
- Produces: `Button` (default export) — props `{ variant?: 'primary'|'secondary'|'ghost'|'icon'|'go'|'danger'|'tile', size?: 'md'|'sm', disabled?: boolean, busy?: boolean, type?: 'button'|'submit', style?, children, ...rest }`. Task 5's `InteractiveCard` mirrors its press mechanism; Task 7 uses it in `UI.jsx`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/ui/Button.test.jsx` (keep the six existing tests):

```jsx
  it('marks itself for the global focus and hover rules', () => {
    render(<Button variant="go">GO</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-ui', 'button');
    expect(btn).toHaveAttribute('data-variant', 'go');
  });

  // The old recipe painted the label COLORS.paper — the PAGE GROUND colour — so
  // ghost text was invisible on any ground-coloured surface. It had zero
  // consumers, which is exactly why no test ever caught it.
  it('paints the ghost variant in ink, not in the page ground colour', () => {
    render(<Button variant="ghost">SKIP</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({ color: 'var(--c-fg)' });
    expect(btn).not.toHaveStyle({ color: 'var(--c-ground)' });
  });

  it('makes the icon variant square', () => {
    render(<Button variant="icon" aria-label="Appearance">*</Button>);
    const btn = screen.getByRole('button', { name: 'Appearance' });
    // 32x32 — the measured header fit. Not 44: the header's functional cluster
    // is a constant 287px and the spare width at 320px is ~10px, so three 32px
    // chips cannot become three 44px chips. 32 clears WCAG 2.2 SC 2.5.8 (24px).
    expect(btn).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('shrinks the icon variant at size="sm"', () => {
    render(<Button variant="icon" size="sm" aria-label="Close">x</Button>);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveStyle({
      width: '28px',
      height: '28px',
    });
  });

  // An icon-only button with no accessible name is an unnamed control. This
  // cannot be a runtime throw — that would crash a production screen over a
  // copy mistake — so it is a development-time warning plus this test, which is
  // what actually stops one landing.
  it('warns in development when the icon variant has no accessible name', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Button variant="icon">*</Button>);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aria-label'));
    warn.mockRestore();
  });

  it('does not warn when the icon variant is labelled', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Button variant="icon" aria-label="Appearance">*</Button>);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sets aria-busy when busy', () => {
    render(<Button busy>SAVE</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  // The defect this prevents: a disabled element leaves the tab order, so a
  // button that disables itself at the moment it is activated takes the user's
  // focus position with it — focus falls to <body> and keyboard context is lost.
  // GoogleButton did exactly this via `disabled={busy}`.
  it('stays focusable and enabled while busy', () => {
    render(<Button busy>SAVE</Button>);
    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('does not fire onClick while busy', async () => {
    const onClick = vi.fn();
    render(
      <Button busy onClick={onClick}>
        SAVE
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its children rendered while busy, so the width does not jump', () => {
    render(<Button busy>SAVE</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('SAVE');
  });

  // aria-busy alone is not a visible affordance — a sighted user watching a
  // button that looks unchanged taps it again.
  it('shows a visible spinner while busy, hidden from the a11y tree', () => {
    render(<Button busy>SAVE</Button>);
    const spinner = screen.getByRole('button').querySelector('[data-ui="spinner"]');
    expect(spinner).not.toBeNull();
    // aria-busy on the button is the announcement; the glyph must not be read.
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no spinner when not busy', () => {
    render(<Button>SAVE</Button>);
    expect(screen.getByRole('button').querySelector('[data-ui="spinner"]')).toBeNull();
  });

  // Merge order: { ...recipe, ...stateStyles, ...style }. The old order applied
  // press styles AFTER the caller's style, so an override silently lost.
  it("lets the caller's style win over the resting recipe", () => {
    render(<Button style={{ borderRadius: 3 }}>GO</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ borderRadius: '3px' });
  });

  it("lets the caller's style win over the press state", async () => {
    render(<Button style={{ transform: 'rotate(45deg)' }}>GO</Button>);
    const btn = screen.getByRole('button');
    await userEvent.pointer({ target: btn, keys: '[MouseLeft>]' });
    expect(btn).toHaveStyle({ transform: 'rotate(45deg)' });
  });
```

- [ ] **Step 2: Run and watch the new tests fail**

Run: `npx vitest run src/components/ui/Button.test.jsx`

Expected: **14 failed, 6 passed.** Confirm the failure *reasons* differ rather than all landing on one shared gate — `data-ui` absent; ghost colour received as `var(--c-ground)`; no `icon` key in `BUTTON`, so it falls back to primary and has no width; no dev warning; `aria-busy` absent; `onClick` fired while busy; no spinner node; and the transform assertion receiving `translateY(3px)`. Eight distinct reasons across fourteen failures. If they all fail identically, the test file is not reaching the component.

> One of the fourteen fails for a reason worth noticing: *"does not warn when the icon variant is labelled"* passes trivially today, because nothing warns at all. It only becomes a real assertion once the warning exists — which is why it is paired with the test above it rather than standing alone.

- [ ] **Step 3: Fix the `BUTTON` token group**

In `src/lib/theme.js`, make three changes inside `export const BUTTON = { … }`.

**a.** `secondary` loses `flex: 1`:

```js
  secondary: {
    ...btnBase,
    background: COLORS.card,
    color: COLORS.ink,
    boxShadow: SHADOW.press(COLORS.lip),
  },
```

> `flex: 1` was a layout decision hiding inside a colour recipe. Note two of the seven consumers (`WelcomeGate`, `TrialWall`) render it inside a `flexDirection: 'column'` container, where `flex: 1` made the button grow *vertically* — a latent bug the removal also fixes. Step 7 checks all seven.

**b.** `ghost` is respecified — ink instead of the page ground, and a hairline so it reads as a control:

```js
  // Ink, NOT COLORS.paper. `paper` is the page ground: the old recipe painted
  // the label in the ground colour, so ghost text was invisible on any
  // ground-coloured surface and legible only on a dark plane. It had zero
  // consumers, so nothing ever rendered it. A caller placing a ghost button on
  // a dark plane (accentBlack, CARD.dark) passes the paired ink via `style` —
  // that is the accent-tier rule, not a variant.
  ghost: {
    ...btnBase,
    background: 'transparent',
    color: COLORS.ink,
    border: BORDER.panel,
    boxShadow: 'none',
    textTransform: 'none',
    fontSize: FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.wider,
    padding: `${SPACE[1]}px ${SPACE[3]}px`,
  },
```

**c.** `icon` is new — add it after `ghost`:

```js
  // Square, label-free, header-sized. 32x32 at md and 28x28 at sm, matching the
  // measured fit of the existing header chips. `aria-label` is mandatory on this
  // variant; Button asserts it in development.
  icon: {
    ...btnBase,
    background: COLORS.surface,
    color: COLORS.ink,
    border: BORDER.panel,
    borderRadius: RADIUS.pill,
    boxShadow: 'none',
    padding: 0,
    letterSpacing: LETTER_SPACING.normal,
    flexShrink: 0,
  },
```

- [ ] **Step 4: Rewrite `Button.jsx`**

Replace `src/components/ui/Button.jsx` entirely:

```jsx
import { useState } from 'react';
import { BUTTON } from '../../lib/theme';

// Square sizes for the icon variant. Everything else takes its size from the
// btnBase padding in theme.js.
const ICON_SIZE = { md: 32, sm: 28 };

/**
 * Chunky 3D-press button. Reads its resting styles from BUTTON[variant] and adds
 * the states inline styles cannot express.
 *
 * Division of labour, so it stays predictable:
 *   - resting appearance ....... inline, from BUTTON[variant]
 *   - :hover and :focus-visible  the global sheet (injectGlobalStyles), matched
 *                                on the data-ui / data-variant attributes below
 *   - :active .................. React state, because pointer-down needs a
 *                                boxShadow rewrite the sheet cannot express
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  style,
  children,
  onClick,
  disabled = false,
  busy = false,
  type = 'button',
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const base = BUTTON[variant] ?? BUTTON.primary;
  const inert = disabled || busy;

  // An icon-only button with no accessible name is an unnamed control. A warning
  // rather than a throw: crashing a production screen over a missing label makes
  // the a11y defect worse, not better. The paired test is what actually stops
  // one landing.
  if (variant === 'icon' && !rest['aria-label'] && !rest['aria-labelledby']) {
    console.error('Button: variant="icon" needs an aria-label — an icon-only button has no name.');
  }

  // Shrink the 4px lip to 1px and sink the button 3px while pressed.
  const pressStyle =
    pressed && !inert && typeof base.boxShadow === 'string'
      ? { transform: 'translateY(3px)', boxShadow: base.boxShadow.replace('0 4px 0', '0 1px 0') }
      : null;

  const squared =
    variant === 'icon' ? { width: ICON_SIZE[size] ?? ICON_SIZE.md, height: ICON_SIZE[size] ?? ICON_SIZE.md } : null;

  return (
    <button
      type={type}
      // The two attributes the global stylesheet matches on. A primitive opts
      // into the app's one focus ring by carrying data-ui.
      data-ui="button"
      data-variant={variant}
      // busy does NOT set `disabled`. A disabled element leaves the tab order,
      // so a button that disables itself at the moment it is activated takes
      // the user's focus position with it and drops them at <body>. Guarding
      // onClick keeps the button focusable and the keyboard context intact.
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={busy ? undefined : onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...base,
        ...squared,
        // Anchors the busy spinner. Harmless when not busy.
        position: 'relative',
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
        ...(busy && !disabled ? { cursor: 'progress' } : null),
        // Merge order is the contract: state styles, THEN the caller's style.
        // The old order put `style` before pressStyle, so a caller override
        // silently lost the moment the button was pressed.
        ...pressStyle,
        ...style,
      }}
      {...rest}
    >
      {/* The label stays rendered and only fades. Swapping it out would let the
          button narrow mid-press, which moves every control beside it. */}
      <span style={busy ? { opacity: 0.25 } : undefined}>{children}</span>
      {busy && (
        <span
          data-ui="spinner"
          aria-hidden="true"
          className="ui-spinner"
          style={{
            position: 'absolute',
            // currentColor, so the spinner is whatever ink this variant already
            // uses — no per-variant spinner colour, and nothing to keep in
            // contrast.
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: RADIUS.pill,
            width: 14,
            height: 14,
          }}
        />
      )}
    </button>
  );
}
```

Add `RADIUS` to the import at the top of the file: `import { BUTTON, RADIUS } from '../../lib/theme';`

- [ ] **Step 5: Animate the spinner in the one global sheet**

The spinner needs a keyframe, and it must degrade rather than vanish under reduced motion. In `src/lib/injectGlobalStyles.js`, add alongside the existing keyframes:

```css
    @keyframes ui-spin { to { transform: rotate(360deg); } }
    .ui-spinner { animation: ui-spin 0.7s linear infinite; }
```

and extend the **existing** `@media (prefers-reduced-motion: reduce)` block — it currently lists `.pop, .wiggle, .slide-up` — so the spinner stops turning but stays visible:

```css
    @media (prefers-reduced-motion: reduce) {
      .pop, .wiggle, .slide-up { animation: none !important; }
      /* Stops turning, stays visible: aria-busy alone is not a visible
         affordance, so removing the glyph would leave nothing to see. */
      .ui-spinner { animation: none !important; }
      .confetti-layer { display: none !important; }
    }
```

Add to `src/lib/injectGlobalStyles.test.js`:

```jsx
  it('keeps the busy spinner visible under reduced motion, just still', () => {
    injectGlobalStyles();
    const reduced = sheet().match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(reduced).toContain('.ui-spinner');
    // display:none would remove the only visible sign that anything is happening.
    expect(reduced).not.toMatch(/\.ui-spinner[^;]*display:\s*none/);
  });
```

- [ ] **Step 6: Run and watch all twenty pass**

Run: `npx vitest run src/components/ui/Button.test.jsx src/lib/injectGlobalStyles.test.js`

Expected: PASS — 20 Button tests (6 pre-existing + 14 new) and 10 stylesheet tests.

- [ ] **Step 7: Migrate `GoogleButton` off `disabled={busy}`**

`src/components/auth/GoogleButton.jsx` currently implements busy as `disabled={busy}` — the exact defect §7.6 forbids, and on a component that also takes `autoFocus`. Change:

```jsx
      onClick={onClick}
      // A redirect takes a beat; a double-tap must not start two round trips.
      // `busy`, not `disabled`: a disabled button leaves the tab order, and
      // dropping out of the tab order at the moment the user acts sends focus
      // to <body>.
      busy={busy}
      autoFocus={autoFocus}
```

Then add to `src/components/auth/GoogleButton.test.jsx` (create it if absent, matching the Button test idiom):

```jsx
  it('stays focusable while the redirect is in flight', () => {
    render(<GoogleButton onClick={() => {}} busy />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).not.toBeDisabled();
  });
```

> If `isGoogleAuthConfigured()` returns false in the test environment, `GoogleButton` renders `null` and this test cannot run. Mock `../../lib/auth.js` with `vi.mock` and stub `isGoogleAuthConfigured` to `true` — **do not** rely on env: `isAuthConfigured()` is true in local tests and false in CI, because Vitest loads `.env` locally, so an unmocked test asserts the opposite branch on each machine.

- [ ] **Step 8: Check all seven `secondary` call sites at 320px**

`flex: 1` is gone from the token, so any consumer that depended on it must now ask for it. Open each and decide:

| Call site | Container | Action |
| --- | --- | --- |
| `FeedbackDialog.jsx:253` | row, already passes `flexShrink: 0` | add `flex: 1` to its `style` if the button should still fill |
| `WelcomeGate.jsx:63` | `flexDirection: 'column'`, fixed `width: 260` | none — `flex: 1` was stretching it vertically |
| `TrialWall.jsx:144` | column | none — same |
| `AccountSection.jsx:84,90,146,239` | inspect each | add `flex: 1` only where the button shared a row |

Then render the app and compare each surface **at 320px and 375px** against `main`. Screenshot both.

- [ ] **Step 9: Verify hover, focus and busy in a real browser**

jsdom implements neither `:hover` nor `:focus-visible`, so Steps 1-5 prove the attributes and inline styles, not the rendered states. In the browser preview:

1. Hover a primary button with a mouse → it lightens slightly.
2. Tab to it → the ink ring appears; the ring did **not** appear on the mouse click.
3. Trigger a busy state → the spinner turns, the button **keeps its width** (measure `getBoundingClientRect().width` before and after — they must be equal), and focus stays on it (check `document.activeElement` via the JS tool).
4. Emulate reduced motion (`resize_window` with the devtools emulation, or the OS setting) → the spinner is still visible and no longer turning.
5. Emulate a touch device and reload → tapping a button does **not** leave it latched in the hover style.
6. Switch to dark mode and repeat 1, 2 and 3. The spinner is `currentColor`, so it should follow the variant's ink with no separate check needed — confirm it did.

- [ ] **Step 10: Full suite, lint, commit**

Run: `npm test` — the full suite, because this task changed a shared token that 13 files import. Then `npm run lint`.

```bash
git add src/lib/theme.js src/lib/injectGlobalStyles.js src/lib/injectGlobalStyles.test.js src/components/ui/Button.jsx src/components/ui/Button.test.jsx src/components/auth/GoogleButton.jsx src/components/auth/GoogleButton.test.jsx src/components/FeedbackDialog.jsx src/components/WelcomeGate.jsx src/components/TrialWall.jsx src/components/stats/AccountSection.jsx
git commit -m "feat(ui): Button icon variant, repaired ghost, hover, busy and merge order"
```

---

## Task 5: Surfaces — `Surface` and `InteractiveCard`

**Files:**
- Create: `src/components/ui/Surface.jsx`, `src/components/ui/Surface.test.jsx`
- Create: `src/components/ui/InteractiveCard.jsx`, `src/components/ui/InteractiveCard.test.jsx`
- Create: `src/components/ui/noNestedButtons.test.js`

**Interfaces:**
- Consumes: `CARD`, `COLORS`, `BORDER`, `RADIUS`, `SHADOW`, `SPACE` from `src/lib/theme`; the `data-ui` / `data-focus-inset` CSS contract from Task 1; `Button`'s press mechanism from Task 4 (mirrored, not imported).
- Produces:
  - `Surface` (default export) — props `{ elevation?: 0|1|2, padding?: keyof SPACE | 0, radius?: keyof RADIUS, as?: ElementType, style?, children, ...rest }`
  - `InteractiveCard` (default export) — props `{ as?: 'button'|'a', selected?: boolean, disabled?: boolean, elevation?: 0|1|2, href?: string, style?, children, ...rest }`

Task 7 uses `Surface` in `StatBlock`.

- [ ] **Step 1: Write the failing `Surface` tests**

Create `src/components/ui/Surface.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Surface from './Surface';

describe('Surface', () => {
  it('renders a div by default with elevation 1', () => {
    render(<Surface data-testid="s">card</Surface>);
    expect(screen.getByTestId('s')).toHaveStyle({ background: 'var(--c-surface)' });
  });

  it('walks the elevation ramp', () => {
    render(
      <>
        <Surface elevation={0} data-testid="e0" />
        <Surface elevation={1} data-testid="e1" />
        <Surface elevation={2} data-testid="e2" />
      </>
    );
    expect(screen.getByTestId('e0')).toHaveStyle({ background: 'var(--c-surface-alt)' });
    expect(screen.getByTestId('e1')).toHaveStyle({ background: 'var(--c-surface)' });
    expect(screen.getByTestId('e2')).toHaveStyle({ background: 'var(--c-surface-3)' });
  });

  // SHADOW.card is a fixed light-mode rgba and is nearly invisible on a dark
  // plane. The hairline is what actually separates the card from its ground in
  // dark mode, which is why CARD.base already carries both. A primitive that
  // "cleans up" the apparent redundancy breaks dark mode and no unit test that
  // only checks the background would notice.
  it('carries a hairline at every elevation, not just a shadow', () => {
    for (const e of [0, 1, 2]) {
      const { getByTestId, unmount } = render(<Surface elevation={e} data-testid="s" />);
      expect(getByTestId('s')).toHaveStyle({ border: '1px solid var(--c-border)' });
      unmount();
    }
  });

  it('renders the element `as` names, for landmarks', () => {
    const { container } = render(<Surface as="section" aria-label="Stats" />);
    expect(container.firstChild.tagName).toBe('SECTION');
  });

  it('takes padding from the SPACE scale', () => {
    render(<Surface padding={6} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ padding: '24px' });
  });

  it('accepts zero padding', () => {
    render(<Surface padding={0} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ padding: '0px' });
  });

  it("lets the caller's style win", () => {
    render(<Surface style={{ background: 'transparent' }} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ background: 'transparent' });
  });
});
```

- [ ] **Step 2: Run it, confirm the import gate, then write `Surface`**

Run: `npx vitest run src/components/ui/Surface.test.jsx` → **FAIL**, `Failed to resolve import "./Surface"`.

Create `src/components/ui/Surface.jsx`:

```jsx
import { COLORS, BORDER, RADIUS, SHADOW, SPACE } from '../../lib/theme';

// The elevation ramp: ground → surface-1 → surface-2 → surface-3.
//
// CARD.dark and CARD.alert are deliberately NOT elevations 3 and 4. They are
// inverted planes carrying their own paired ink, and numbering them into this
// ramp would imply they sit higher in the same stack — which is how a card ends
// up with unreadable body text.
const PLANE = {
  0: COLORS.paperDeep,
  1: COLORS.surface,
  2: COLORS.surfaceElevated,
};

/**
 * Non-interactive container.
 *
 * There is no `onClick`, on purpose. A clickable surface is InteractiveCard,
 * which guarantees a native button or link — fourteen league rows once shipped
 * as `<li onClick>`, unreachable by Tab and invisible to a screen reader as
 * controls, and stayed that way through a green 1,600-test suite.
 */
export default function Surface({
  elevation = 1,
  padding = 4,
  radius = 'xl',
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        background: PLANE[elevation] ?? PLANE[1],
        // Both, always. The shadow is a light-mode rgba that all but disappears
        // on a dark plane; the hairline is what separates the card there.
        border: BORDER.panel,
        boxShadow: SHADOW.card,
        borderRadius: RADIUS[radius] ?? RADIUS.xl,
        padding: SPACE[padding] ?? 0,
        color: COLORS.ink,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

Run the suite again → PASS, 7 tests.

- [ ] **Step 3: Write the failing `InteractiveCard` tests**

Create `src/components/ui/InteractiveCard.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InteractiveCard from './InteractiveCard';

describe('InteractiveCard', () => {
  // This assertion is the primitive's entire reason to exist.
  it('renders a native button, so it is in the tab order', async () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    const card = screen.getByRole('button', { name: 'Deck A' });
    expect(card.tagName).toBe('BUTTON');
    await userEvent.tab();
    expect(document.activeElement).toBe(card);
  });

  it('activates on Enter and on Space without hand-rolled key handling', async () => {
    const onClick = vi.fn();
    render(<InteractiveCard onClick={onClick}>Deck A</InteractiveCard>);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('renders a link when asked, and keeps the href', () => {
    render(
      <InteractiveCard as="a" href="/stats">
        Stats
      </InteractiveCard>
    );
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats');
  });

  // `as` accepts nothing else. A div with role+tabIndex+onKeyDown hand-rolls
  // activation, the disabled state, form participation and the focus ring that
  // the native element gives for free.
  it('refuses any element that is not a button or a link', () => {
    render(<InteractiveCard as="div">Deck A</InteractiveCard>);
    expect(screen.getByRole('button', { name: 'Deck A' }).tagName).toBe('BUTTON');
  });

  it('signals selection to assistive tech, not by colour alone', () => {
    render(<InteractiveCard selected>Deck A</InteractiveCard>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    // The non-colour channel required by WCAG 1.4.1.
    expect(card).toHaveStyle({ border: '1px solid var(--c-border-strong)' });
  });

  it('uses aria-current for a selected link', () => {
    render(
      <InteractiveCard as="a" href="/stats" selected>
        Stats
      </InteractiveCard>
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'true');
  });

  it('disables a button natively', () => {
    render(<InteractiveCard disabled>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // There is no disabled attribute for links, so the href has to go — a link
  // that keeps its href while claiming to be disabled is still navigable.
  it('drops the href and marks aria-disabled on a disabled link', () => {
    render(
      <InteractiveCard as="a" href="/stats" disabled>
        Stats
      </InteractiveCard>
    );
    const el = screen.getByText('Stats');
    expect(el).not.toHaveAttribute('href');
    expect(el).toHaveAttribute('aria-disabled', 'true');
  });

  // A <button> centres its content and inherits none of the page font.
  it('resets the native button typography and alignment', () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toHaveStyle({ textAlign: 'left' });
  });

  it('opts into the inset focus ring, being full-bleed in a list', () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('data-ui', 'button');
    expect(card).toHaveAttribute('data-focus-inset');
  });
});
```

- [ ] **Step 4: Write `InteractiveCard`**

Create `src/components/ui/InteractiveCard.jsx`:

```jsx
import { useState } from 'react';
import { COLORS, BORDER, RADIUS, SHADOW, SPACE } from '../../lib/theme';

const PLANE = {
  0: COLORS.paperDeep,
  1: COLORS.surface,
  2: COLORS.surfaceElevated,
};

/**
 * A card the user can activate: a deck tile, a league row, a scenario entry.
 *
 * It renders a native <button> or <a href>. There is no third option and `as`
 * accepts nothing else — that is the whole point. Fourteen league rows shipped
 * as `<li onClick>`: dead to Tab, invisible to a screen reader as controls, and
 * green across a 1,600-test suite, because nothing about a click handler on a
 * list item is detectable from the DOM assertions those tests were making.
 *
 * `role="button"` + tabIndex + onKeyDown is the wrong repair: it hand-rolls
 * Enter/Space activation, the disabled state, form participation and the focus
 * ring the native element already has.
 *
 * A list of these keeps its semantics: <Stack as="ul"> with <li> wrappers, each
 * <li> containing one card. The <li> is the list item; the card is the control.
 */
export default function InteractiveCard({
  as = 'button',
  selected = false,
  disabled = false,
  elevation = 1,
  href,
  style,
  children,
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const isLink = as === 'a';
  const Tag = isLink ? 'a' : 'button';

  const pressStyle =
    pressed && !disabled ? { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${COLORS.lip}` } : null;

  // Selection is never signalled by colour alone (WCAG 1.4.1). The border
  // weight change is the non-colour channel.
  const edge = selected ? `1px solid ${COLORS.borderStrong}` : BORDER.panel;

  const semantics = isLink
    ? {
        // No disabled attribute exists for links, so the href has to go —
        // otherwise a "disabled" link is still navigable.
        href: disabled ? undefined : href,
        'aria-disabled': disabled || undefined,
        'aria-current': selected || undefined,
      }
    : {
        type: 'button',
        disabled,
        'aria-pressed': selected || undefined,
      };

  return (
    <Tag
      data-ui="button"
      // Full-bleed inside a list: an outset ring is clipped by the container
      // edge and overlaps the neighbouring row.
      data-focus-inset=""
      {...semantics}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: PLANE[elevation] ?? PLANE[1],
        border: edge,
        boxShadow: SHADOW.press(COLORS.lip),
        borderRadius: RADIUS.xl,
        padding: SPACE[4],
        color: COLORS.ink,
        // A <button> centres its content and inherits none of the page font.
        textAlign: 'left',
        font: 'inherit',
        width: '100%',
        display: 'block',
        textDecoration: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(disabled ? { opacity: 0.45 } : null),
        ...pressStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

Run: `npx vitest run src/components/ui/InteractiveCard.test.jsx` → PASS, 10 tests.

- [ ] **Step 5: Prove the tab-order test has teeth**

The first test is the one that must not be able to pass against broken code. Temporarily change `const Tag = isLink ? 'a' : 'button'` to `const Tag = isLink ? 'a' : 'div'` and add `role="button"` to the non-link `semantics`.

Run: `npx vitest run src/components/ui/InteractiveCard.test.jsx`

Expected: **FAIL** on `expect(card.tagName).toBe('BUTTON')` *and* on the `userEvent.tab()` assertion — the div is not in the tab order. This is the exact defect the primitive exists to prevent, and watching it fail is the proof the assertion works. Also confirm the Enter/Space test fails.

Restore.

- [ ] **Step 6: Write the nested-button guard**

Create `src/components/ui/noNestedButtons.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMPONENTS_DIR = 'src/components';

// A <button> may not contain a <button>: the HTML content model forbids it and
// browsers repair it by un-nesting, which silently changes the DOM the tests
// assert against. A card with its own affordance inside (a row with a "remove"
// control) is two siblings in a Row, not a nest.
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sources(full, out);
      continue;
    }
    if (name.endsWith('.jsx') && !name.endsWith('.test.jsx')) out.push(full);
  }
  return out;
}

// Matches an <InteractiveCard …> opening tag through to its closing tag, across
// lines, non-greedily.
const CARD_BLOCK = /<InteractiveCard\b[\s\S]*?<\/InteractiveCard>/g;
const NESTED = /<(Button|button)\b/;

describe('no interactive element nested inside an InteractiveCard', () => {
  it('finds no Button or <button> inside an InteractiveCard block', () => {
    const files = sources(COMPONENTS_DIR);
    expect(files.length).toBeGreaterThan(50);

    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const block of src.match(CARD_BLOCK) ?? []) {
        if (NESTED.test(block)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}: ${block.slice(0, 80)}…`);
        }
      }
    }
    expect(
      offenders,
      `scanned ${files.length} files; nested interactive elements:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
```

- [ ] **Step 7: Stage its red — the fixture must be able to express the failure**

This guard scans for a pattern that does not exist anywhere yet, so with no fixture it would pass vacuously and prove nothing. Temporarily add to `src/components/ui/Confetti.jsx`:

```jsx
export function FIXTURE_DO_NOT_KEEP() {
  return (
    <InteractiveCard>
      Deck A
      <Button>Remove</Button>
    </InteractiveCard>
  );
}
```

Run: `npx vitest run src/components/ui/noNestedButtons.test.js`

Expected: **FAIL**, naming `ui/Confetti.jsx` and echoing the block, with `scanned 63 files;`. Delete the fixture, re-run → PASS.

- [ ] **Step 8: Verify in a real browser at 320px**

Render a list of three `InteractiveCard`s with a long label. At 320px: no horizontal page scroll (`document.documentElement.scrollWidth - clientWidth === 0`), the focus ring sits **inside** each row rather than overlapping its neighbour, and Tab reaches every row in order. Screenshot light and dark.

- [ ] **Step 9: Lint and commit**

```bash
git add src/components/ui/Surface.jsx src/components/ui/Surface.test.jsx src/components/ui/InteractiveCard.jsx src/components/ui/InteractiveCard.test.jsx src/components/ui/noNestedButtons.test.js
git commit -m "feat(ui): Surface and InteractiveCard primitives"
```

---

## Task 6: Layout — `Stack`, `Row`, `Grid`, `PageFrame`

Independent of Tasks 1, 3, 4 and 5 — it may run in parallel with Tasks 1 and 2. These four exist to make four failure modes unrepresentable, each of which has already cost this project a bug.

**Files:**
- Create: `src/components/ui/Layout.jsx`, `src/components/ui/Layout.test.jsx`

**Interfaces:**
- Consumes: `SPACE` from `src/lib/theme`.
- Produces, all named exports of `Layout.jsx`:
  - `Stack` — `{ gap?: keyof SPACE, align?: string, as?: ElementType, style?, children, ...rest }`
  - `Row` — `{ gap?: keyof SPACE, align?: string, justify?: string, wrap?: boolean, as?: ElementType, style?, children, ...rest }`
  - `Grid` — `{ columns?: number | 'auto-fit', min?: number, gap?: keyof SPACE, as?: ElementType, style?, children, ...rest }`
  - `PageFrame` — `{ maxWidth?: number, gutter?: keyof SPACE, as?: ElementType, style?, children, ...rest }`

Task 7 uses `Stack` and `Row` in `UI.jsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/Layout.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stack, Row, Grid, PageFrame } from './Layout';

describe('Stack', () => {
  it('stacks vertically with a gap from the SPACE scale', () => {
    render(<Stack gap={6} data-testid="s">x</Stack>);
    expect(screen.getByTestId('s')).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    });
  });

  it('renders as a list when asked, so a list of cards keeps its semantics', () => {
    render(
      <Stack as="ul" data-testid="s">
        <li>a</li>
      </Stack>
    );
    expect(screen.getByTestId('s').tagName).toBe('UL');
  });
});

describe('Row', () => {
  // At 320px a non-wrapping row is this app's most common overflow source, so
  // wrapping is the default and opting out is something you have to write down.
  it('wraps by default', () => {
    render(<Row data-testid="r">x</Row>);
    expect(screen.getByTestId('r')).toHaveStyle({ flexWrap: 'wrap' });
  });

  it('lets a caller opt out of wrapping explicitly', () => {
    render(<Row wrap={false} data-testid="r">x</Row>);
    expect(screen.getByTestId('r')).toHaveStyle({ flexWrap: 'nowrap' });
  });

  // Necessary but NOT sufficient — see the Row/Stack doc comment. It is here so
  // text can shrink at all; what happens when it does not fit is the caller's
  // declaration.
  it('sets minWidth 0 on itself so it can shrink below its content', () => {
    render(<Row data-testid="r">x</Row>);
    expect(screen.getByTestId('r')).toHaveStyle({ minWidth: '0px' });
  });
});

describe('Grid', () => {
  // A bare `1fr` keeps min-width:auto, so the track refuses to shrink below its
  // content and pushes the page wider than the viewport. That defect shipped
  // four separate times (docs/DEMO_READINESS.md #15-#17).
  it('emits minmax(0, 1fr), never a bare 1fr', () => {
    render(<Grid columns={3} data-testid="g">x</Grid>);
    expect(screen.getByTestId('g')).toHaveStyle({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    });
  });

  it('emits minmax on the auto-fit path too', () => {
    render(<Grid columns="auto-fit" min={140} data-testid="g">x</Grid>);
    expect(screen.getByTestId('g')).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    });
  });

  it('never produces the substring "1fr" without a minmax around it', () => {
    for (const props of [{ columns: 1 }, { columns: 4 }, { columns: 'auto-fit', min: 90 }]) {
      const { getByTestId, unmount } = render(<Grid {...props} data-testid="g">x</Grid>);
      const tracks = getByTestId('g').style.gridTemplateColumns;
      expect(tracks).toContain('minmax(');
      expect(tracks).not.toMatch(/[(,]\s*1fr/);
      unmount();
    }
  });
});

describe('PageFrame', () => {
  it('centres within a max measure and pads clear of the home indicator', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el).toHaveStyle({ marginInline: 'auto' });
    expect(el.style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('takes its gutter from the SPACE scale', () => {
    render(<PageFrame gutter={3} data-testid="p">x</PageFrame>);
    expect(screen.getByTestId('p')).toHaveStyle({ paddingInline: '12px' });
  });
});
```

- [ ] **Step 2: Run and confirm the import gate**

Run: `npx vitest run src/components/ui/Layout.test.jsx` → **FAIL**, `Failed to resolve import "./Layout"`.

- [ ] **Step 3: Write `Layout.jsx`**

Create `src/components/ui/Layout.jsx`:

```jsx
import { SPACE } from '../../lib/theme';

// Four layout primitives in one file. Each is a few lines of flex/grid config
// over the same SPACE scale; four files would be four import lines for one idea,
// and a caller looking for Stack finds it here on the first grep.
//
// Their purpose is not brevity. It is to make four failure modes
// unrepresentable, each of which has already cost this project a bug:
//   - a bare `1fr` track that refuses to shrink        (Grid)
//   - a non-wrapping row at 320px                      (Row)
//   - a flex child that cannot shrink below its text   (minWidth: 0)
//   - a per-tab re-derivation of the safe-area inset   (PageFrame)

// ── minWidth: 0 — necessary, and NOT sufficient ──────────────────────────────
//
// A flex child needs `minWidth: 0` for text to shrink below its intrinsic width.
// But on its own it does not fix overflow — it HIDES it: the overflow stops
// widening the container and renders as text drawn on top of text instead.
// scrollWidth never exceeds clientWidth, so no overflow assertion can catch it.
// The layout is broken and every width test passes.
//
// So: a flex child holding variable-length text sets minWidth: 0 AND declares
// what happens when it does not fit — it wraps (Row's default), it truncates
// (overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap), or it scrolls
// in its own container. minWidth: 0 with no stated overflow behaviour is an
// incomplete style.
//
// Row and Stack apply it to themselves. They cannot apply it to children they do
// not own, and the truncation decision belongs to the caller anyway — it is a
// content decision, not a layout one.
const SHRINKABLE = { minWidth: 0 };

export function Stack({ gap = 4, align, as: Tag = 'div', style, children, ...rest }) {
  return (
    <Tag
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[gap] ?? SPACE[4],
        alignItems: align,
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Row({
  gap = 3,
  align = 'center',
  justify,
  // Wrapping is the default: at 320px a non-wrapping row is the most common
  // overflow source in this app. A caller who genuinely must not wrap passes
  // wrap={false} and thereby writes down that they accepted the risk.
  wrap = true,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: SPACE[gap] ?? SPACE[3],
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Grid({ columns = 2, min = 120, gap = 3, as: Tag = 'div', style, children, ...rest }) {
  // ALWAYS minmax(0, 1fr). A bare 1fr keeps min-width:auto, so the track refuses
  // to shrink below its content and pushes the page wider than the viewport.
  // Four separate mobile-overflow bugs came from this (docs/DEMO_READINESS.md
  // #15-#17), which is why it is structural here rather than remembered.
  const tracks =
    columns === 'auto-fit'
      ? `repeat(auto-fit, minmax(${min}px, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <Tag
      style={{ display: 'grid', gridTemplateColumns: tracks, gap: SPACE[gap] ?? SPACE[3], ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// The outermost per-tab wrapper. Not a Stack with different defaults: it is the
// one place the max measure and the safe-area inset are decided, and today both
// are re-derived per tab.
export function PageFrame({
  maxWidth = 900,
  gutter = 4,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        maxWidth,
        marginInline: 'auto',
        paddingInline: SPACE[gutter] ?? SPACE[4],
        // Keeps content clear of the home indicator on iOS.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        width: '100%',
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

Run: `npx vitest run src/components/ui/Layout.test.jsx` → PASS, 10 tests.

- [ ] **Step 4: Prove the `1fr` guard has teeth**

Temporarily change the `Grid` non-auto-fit branch to `` `repeat(${columns}, 1fr)` ``.

Run: `npx vitest run src/components/ui/Layout.test.jsx`

Expected: **FAIL** on two tests — the explicit `minmax(0, 1fr)` assertion and the `never produces the substring "1fr" without a minmax` sweep. The second is the one that matters: it covers the `auto-fit` path and every column count, so a future edit cannot reintroduce a bare track on a path the first test does not exercise. Restore.

- [ ] **Step 5: Verify the 320px story in a real browser**

Unit tests cannot prove this — jsdom computes no layout. Build a throwaway page with a `PageFrame > Stack > Row` holding a long unbroken string and a `Grid columns={3}`, and at 320px:

1. `document.documentElement.scrollWidth - document.documentElement.clientWidth` → expect `0`. **Not `window.innerWidth`**: in the in-app browser tools that value *grows with the overflow*, so it reports no overflow exactly when there is one.
2. Because of the `minWidth: 0` hazard, a zero result is necessary but not sufficient. Also compare each child's `getBoundingClientRect().right` against its parent's — overlapping text produces no overflow at all.
3. Repeat at 375px and with the long rank name / freeze chip content that only a populated account produces.

Screenshot both widths.

- [ ] **Step 6: Lint and commit**

```bash
git add src/components/ui/Layout.jsx src/components/ui/Layout.test.jsx
git commit -m "feat(ui): Stack, Row, Grid and PageFrame layout primitives"
```

---

## Task 7: Re-express the `UI.jsx` composites over the primitives

The payoff task: `Hero`, `SectionLabel` and `StatBlock` have 9 consumers between them, and none of those consumers change. Closes spec defect §11.7 (`Hero`'s unassertable CSS clamp).

Depends on Tasks 3, 5 and 6.

**Files:**
- Modify: `src/components/UI.jsx` (whole file)
- Modify: `src/components/UI.test.jsx`

**Interfaces:**
- Consumes: `Heading` (Task 3), `Body`, `Meta` (Task 3), `Surface` (Task 5), `Row` (Task 6).
- Produces: no API change. `StatBlock`, `SectionLabel` and `Hero` keep their exact current props — `{ label, value, icon, accent, pulsing }`, `{ num, text }`, `{ kicker, title, sub }`.

- [ ] **Step 1: Pin the current behaviour before changing anything**

`UI.test.jsx` already exists. Read it, then add the assertions that lock the contract this task must not break:

```jsx
  it('renders the hero title as an h1', () => {
    render(<Hero kicker="A" title="Wortschatz" sub="Sub" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Wortschatz' })).toBeInTheDocument();
  });

  it('sizes the hero title from the viewport, in JS', () => {
    window.innerWidth = 320;
    render(<Hero kicker="A" title="Wortschatz" />);
    // min(72, 320 * 0.13) = 41.6 — a number, not a mangled CSS min() string.
    expect(screen.getByRole('heading', { level: 1 })).toHaveStyle({ fontSize: '41.6px' });
  });

  it('drops the StatBlock caption when the caller passes an empty label', () => {
    render(<StatBlock label="" value="7" icon={<span />} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run and watch the size assertion fail**

Run: `npx vitest run src/components/UI.test.jsx`

Expected: the two structural tests **pass** (they describe today's behaviour), and *"sizes the hero title from the viewport, in JS"* **fails** — jsdom reads today's `min(72px, 13vw)` back mangled, so the received value is not `41.6px`. That single failure is the task's red.

- [ ] **Step 3: Rewrite `UI.jsx` over the primitives**

Replace `src/components/UI.jsx`:

```jsx
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, BORDER, RADIUS, TEXT } from '../lib/theme';
import Surface from './ui/Surface';
import Heading from './ui/Heading';
import { Body, Meta } from './ui/Text';
import { Row } from './ui/Layout';

// ── StatBlock ─────────────────────────────────────────────────
// Header stat pill: streak counter, learned word count.
export function StatBlock({ label, value, icon, accent, pulsing }) {
  return (
    <Surface
      as={Row}
      elevation={1}
      radius="lg"
      padding={0}
      gap={2}
      wrap={false}
      style={{ padding: '6px 14px 6px 6px' }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: RADIUS.pill,
          background: accent ? COLORS.gold : COLORS.ink,
          // Gold is a fill — ink flips per mode and fails on gold in dark (1.25:1).
          color: accent ? COLORS.accentOn : COLORS.card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: pulsing ? 'pulse-gold 2s infinite' : 'none',
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        {/* Callers pass an empty label to drop the caption where width is tight
            (the mobile header): the icon and value still carry the signal. */}
        {label && (
          <Meta as="div" style={{ letterSpacing: LETTER_SPACING.widest }}>
            {label}
          </Meta>
        )}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            fontWeight: FONT_WEIGHT.bold,
            lineHeight: 1,
            color: COLORS.ink,
          }}
        >
          {value}
        </div>
      </div>
    </Surface>
  );
}

// ── SectionLabel ──────────────────────────────────────────────
// Small labelled section header: [A] SCENARIO, [B] CORRECTION, etc.
export function SectionLabel({ num, text }) {
  return (
    <Row align="baseline" gap={2} style={{ marginBottom: SPACE[3] }}>
      <span style={{ ...TEXT.tag }}>{num}</span>
      <Meta style={{ letterSpacing: LETTER_SPACING.ultra }}>{text}</Meta>
    </Row>
  );
}

// ── Hero ──────────────────────────────────────────────────────
// Full-width section title block: kicker + big heading + subtitle.
export function Hero({ kicker, title, sub }) {
  return (
    <div style={{ borderBottom: BORDER.standard, paddingBottom: SPACE[6] }}>
      <Meta style={{ ...TEXT.kicker, marginBottom: SPACE[3], display: 'block' }}>{kicker}</Meta>
      {/* The 72px / 13vw curve now lives in Heading size="display", computed in
          JS. As `min(72px, 13vw)` it rendered correctly but had no assertable
          form — jsdom reads CSS min() back mangled. */}
      <Heading level={1} size="display" style={{ lineHeight: 0.95 }}>
        {title}
      </Heading>
      {sub && (
        <Body
          tone="soft"
          style={{
            fontSize: FONT_SIZE.md + 2,
            fontStyle: 'italic',
            maxWidth: 600,
            marginTop: SPACE[4],
          }}
        >
          {sub}
        </Body>
      )}
    </div>
  );
}
```

> `<Surface as={Row}>` composes the two primitives: `Surface` supplies the plane, hairline and radius, and passes `gap` / `wrap` through `...rest` to `Row`. If that composition proves awkward in review, the honest alternative is `<Surface><Row>…</Row></Surface>` with `padding={0}` — take the nested form rather than adding a `direction` prop to `Surface`.

- [ ] **Step 4: Run the UI suite and all nine consumers**

Run: `npx vitest run src/components/UI.test.jsx src/components/StatsTab.test.jsx src/components/HomeTab.test.jsx src/components/VocabTab.test.jsx src/components/AlphabetTab.test.jsx src/components/TranslateTab.test.jsx`

Expected: PASS, including the previously-failing size assertion. **The nine consumers were not edited** — they pass untouched because they assert DOM, not internals, which is what makes this refactor safe.

- [ ] **Step 5: Confirm the guards still hold**

Run: `npx vitest run src/components/noHardcodedColors.test.js src/components/ui/`

Expected: PASS. This is the moment the Task 2 guards earn their keep — a rewrite of a shared file is exactly when a colour literal or a stray palette import creeps in.

- [ ] **Step 6: Compare against `main` in a real browser**

`Hero` appears on five tabs. For each, screenshot at **320px and 375px**, light and dark, and diff against the same view on `main`. Expected: pixel-identical titles — the `min(72px, 13vw)` curve and the JS computation produce the same number at every width. Any difference means the constants drifted.

- [ ] **Step 7: Full suite, lint, commit**

Run: `npm test` then `npm run lint`.

```bash
git add src/components/UI.jsx src/components/UI.test.jsx
git commit -m "refactor(ui): re-express Hero, SectionLabel and StatBlock over the primitives"
```

---

---

## Task 8: Escape returns focus everywhere — closing §11.8

**Spec §14 has no PR for this, and that is a hole in §14, not a reason to skip it.** §11.8 lists "Escape restores focus in some dismissible surfaces and not others" as a defect, §10.2 codifies the rule, and the ring is only half of "focus survives Escape/modals" — a ring nobody can get back to is not focus management. This task closes it.

**The audit, done — seven dismissible surfaces, five already correct:**

| Surface | Modal? | Traps | Restores focus on close |
| --- | --- | --- | --- |
| `ThemeChip` | no (popover) | no ✓ | **yes** — `buttonRef.current?.focus()` in the Escape handler |
| `AccountChip` | no (popover) | no ✓ | **yes** — same |
| `StatusChip` | no (popover) | no ✓ | **yes** — same |
| `AuthSheet` | yes | yes | **yes** — `openerRef` captured on the open transition, restored in cleanup |
| `ProfileCard` | yes | yes | **yes** — `openerRef` captured in an effect, restored in cleanup |
| `FeedbackDialog` | yes | yes | **no** — Escape calls `onClose()` and focus falls to `<body>` |
| `TutorialOverlay` | yes | yes | **no** — Escape calls `dismiss()` and focus falls to `<body>` |

Two to fix. The modal/non-modal split is already correct everywhere and is not touched.

**Files:**
- Modify: `src/components/FeedbackDialog.jsx:40-62`
- Modify: `src/components/TutorialOverlay.jsx:96-116`
- Modify: `src/components/FeedbackDialog.test.jsx`, `src/components/TutorialOverlay.test.jsx`

**Interfaces:** consumes nothing, produces nothing. This is a behaviour fix inside two components.

- [ ] **Step 1: Write the failing test for `FeedbackDialog`**

```jsx
  it('returns focus to whatever opened it when Escape dismisses', async () => {
    render(
      <>
        <button type="button" data-testid="opener">Feedback</button>
        <FeedbackDialog context={{}} onClose={() => {}} />
      </>
    );
    // The dialog captures the opener during its first render, so focus has to
    // be there before it mounts in the real app. Simulate that ordering.
    screen.getByTestId('opener').focus();
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByTestId('opener'));
  });
```

> This test needs the opener focused **before** the dialog first renders, which the single-`render` form above cannot express. Use `rerender`: render the opener alone, focus it, then rerender with the dialog. Write it that way — a fixture that cannot express the ordering cannot catch the bug.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/FeedbackDialog.test.jsx`

Expected: **FAIL** — `document.activeElement` is `<body>`, because nothing restores. That is the defect, reproduced.

- [ ] **Step 3: Fix `FeedbackDialog`**

Add the opener capture and restore, following `AuthSheet`'s proven shape. The capture happens **during render, not in an effect** — React runs `autoFocus` during commit, before effects, so an effect that reads `document.activeElement` records whatever the surface just focused rather than the opener:

```jsx
  const openerRef = useRef(null);
  // Captured during the first render — before commit, and therefore before any
  // autoFocus inside this dialog moves focus. An effect would be too late.
  if (openerRef.current === null) openerRef.current = document.activeElement;

  useEffect(() => {
    // Restore on unmount: the parent renders this conditionally, so unmount IS
    // close, for Escape, the close button and outside-click alike.
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      // The opener can be gone — a trigger inside a surface this dialog's own
      // success unmounts — in which case there is nothing to go back to.
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);
```

Run the suite → PASS.

- [ ] **Step 4: Repeat for `TutorialOverlay`**

Write the same failing test against `TutorialOverlay`, watch it fail for the same reason, then fix it. `TutorialOverlay` does **not** unmount on close — it returns `null` from `if (!ready || !step) return null`, so an unmount cleanup never runs. Mirror `AuthSheet`'s open-transition form instead:

```jsx
  const openerRef = useRef(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current) openerRef.current = document.activeElement;
  wasOpenRef.current = open;

  useEffect(() => {
    if (!open) return undefined;
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open]);
```

- [ ] **Step 5: Prove the restore is not accidental**

Both tests could pass for the wrong reason: if focus never left the opener in the first place, `activeElement` is trivially correct. Add an assertion **before** the Escape that focus actually moved into the dialog:

```jsx
    expect(document.activeElement).not.toBe(screen.getByTestId('opener'));
```

Run both suites. If that line fails, the dialog is not moving focus in on open — a *different* defect, and one the restore test would have hidden.

- [ ] **Step 6: Verify by keyboard in a real browser**

Open each dialog with the keyboard only (Tab to the trigger, Enter), Tab once inside to confirm the trap holds, press Escape, then press Tab again. Expected: the next Tab moves to the element **after the trigger**, not from the top of the page. Repeat for the three header chips to confirm this task did not disturb the five that already worked.

- [ ] **Step 7: Full suite, lint, commit**

```bash
git add src/components/FeedbackDialog.jsx src/components/FeedbackDialog.test.jsx src/components/TutorialOverlay.jsx src/components/TutorialOverlay.test.jsx
git commit -m "fix(a11y): return focus to the opener when Escape dismisses"
```

---

## Definition of done

- [ ] All eight tasks committed, each as its own PR into `main`, each green through `.husky/pre-commit` unbypassed.
- [ ] `grep -rn "focus-visible" --include='*.jsx' src/components` returns nothing — every ring comes from the one global sheet.
- [ ] Four guards live, and **each has been watched to fail against a fixture that could express the failure**: colour literals (§4.2), palette imports in `ui/` (§13.2), bare `1fr` (§13.3), nested buttons (§13.5). The fifth, `outline: none` (§13.4), is deferred with a reason — see below.
- [ ] All seven dismissible surfaces return focus to their opener on Escape; the three non-modal header chips are still untrapped.
- [ ] Every new primitive verified at **320px and 375px** in a real browser, with a populated account, in both modes — measuring `scrollWidth - clientWidth`, never `window.innerWidth`, and checking child edges as well because `minWidth: 0` hides overflow from that measurement.
- [ ] `docs/BACKLOG.md`'s 1b row moved out of **Blocked**.

## Known gap in this plan

**Spec §10.1.4 and §13.4 require a guard against `outline: none` / `outline: 0` without a replacement indicator. This plan does not build it**, and the reason is that there is nothing to guard yet: `grep -rn "outline" src/components src/lib` finds only the three hand-rolled recipes Task 1 deletes, so the guard would pass vacuously on an empty fixture — the failure mode §13's own rules forbid. Add it in the first PR that has a real reason to suppress an outline, with that suppression as its fixture. Recorded here so it is a deferral, not an omission.

## Spec requirements deliberately not implemented

- **§7.1 `size="sm"` for non-icon variants.** Only the `icon` variant reads `size` (Task 4, Step 4). The spec's own §15.3 flags the general `sm` scale as speculative — no surface has asked for it. `ICON_SIZE` is the whole map; widening it is a one-line change when a caller appears.
- **§12.3's opportunistic migration** of the remaining raw `<button>` elements and `fontSize` literals. That is the ongoing policy, not a task with an end state.
