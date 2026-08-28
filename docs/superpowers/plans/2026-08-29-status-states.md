# Status States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace six independently-invented empty/error surfaces with one
`StatusNote` primitive carrying two tones, a required icon, and optional recovery.

**Architecture:** `StatusNote` composes the sub-project 1b primitives (`Stack`,
`Body`, `Button`) and contributes only three things of its own: the arrangement,
the tone-to-ink mapping, and the live-region behaviour. It sets no font family,
size, line height or button styling. `tone.js` gains a fourth entry, `error`,
which needs no new contrast sweep because `c.error` is already verified as a
foreground against ground and surface-1/2/3 in both palettes.

**Tech Stack:** React 18, Vite 5, inline styles only, Vitest (`globals: false`),
React Testing Library, jsdom, `lucide-react`.

**Spec:** `docs/status-states-spec.md`

## Before you start

This plan lives on `claude/status-states-spec` alongside its spec. **Do not
implement on that branch.** Branch fresh from an up-to-date `main`:

```bash
git checkout main && git pull && git checkout -b claude/status-states
```

Tasks 1–6 each end in a commit on that branch; Task 7 pushes it and opens the PR.

## Global Constraints

- **Inline styles only.** No CSS files, no CSS-in-JS library. Global rules go in
  `src/lib/injectGlobalStyles.js` and nowhere else.
- **No hardcoded colours.** Every colour comes from `src/lib/theme.js`. No hex
  literals, no named CSS colours.
- **No raw numeric font sizes or spacing.** Use `FONT_SIZE.*` and `SPACE[*]`.
- **`src/components/ui/` may not import `themeTokens`, `applyTheme` or
  `themeMode`, and may not branch on the theme mode.** Enforced by
  `src/components/ui/tokenBoundary.test.js`.
- **Vitest runs with `globals: false`** — every test file imports
  `{ describe, it, expect }` from `vitest` explicitly.
- **Never bypass `.husky/pre-commit`.** `--no-verify` is forbidden.
- **Never commit to `main`.** All work lands on this branch via PR.
- **Copy is preserved verbatim** at every migrated call site. This change is
  structure, tone and recovery — not wording.

---

### Task 1: The `error` text tone

Prerequisite for everything else. Split from Task 2 because a reviewer can
reasonably reject a fourth tone while accepting the component that uses it.

**Files:**
- Modify: `src/components/ui/tone.js`
- Test: `src/components/ui/Text.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `TONE.error` (string, `'var(--c-error)'`), consumable as
  `<Body tone="error">`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('Body', …)` block in
`src/components/ui/Text.test.jsx`:

```jsx
  // Not an accent-as-foreground: c.error is already swept as a FOREGROUND
  // against ground and surface-1/2/3 in both palettes (contrast.test.js),
  // so this tone introduces no new contrast pair.
  it('applies the error tone ink', () => {
    render(
      <Body tone="error" data-testid="e">
        Kaputt.
      </Body>
    );
    expect(screen.getByTestId('e')).toHaveStyle({ color: 'var(--c-error)' });
  });
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/components/ui/Text.test.jsx -t "error tone ink"
```

Expected: FAIL. `TONE.error` is undefined, so `Body` falls back to
`TONE.default` and the colour is `var(--c-fg)`, not `var(--c-error)`.

- [ ] **Step 3: Add the tone**

In `src/components/ui/tone.js`, change the exported map to:

```js
export const TONE = {
  default: COLORS.ink,
  soft: COLORS.inkSoft,
  muted: COLORS.mute,
  error: COLORS.red,
};
```

- [ ] **Step 4: Correct the comment that now contradicts the code**

The docblock above `TONE` currently opens "Ink for the three text tones" and
says "Three tones, no more." Leaving that in place while shipping a fourth is a
worse defect than the drift this fixes. Replace those two claims with:

```js
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
```

- [ ] **Step 5: Run the tone tests and the contrast suite**

```bash
npx vitest run src/components/ui/Text.test.jsx src/lib/contrast.test.js
```

Expected: PASS. Contrast must stay green with no new pairs added — that is the
claim in the comment, and this run is what backs it.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/tone.js src/components/ui/Text.test.jsx
git commit -m "feat(ui): add the error text tone"
```

---

### Task 2: The `StatusNote` primitive

**Files:**
- Create: `src/components/ui/StatusNote.jsx`
- Create: `src/components/ui/StatusNote.test.jsx`

**Interfaces:**
- Consumes: `TONE.error` (Task 1); `Stack` from `./Layout`; `Body` from
  `./Text`; default export `Button` from `./Button`.
- Produces: default export
  `StatusNote({ tone, icon, action, as, style, children, ...rest })` where
  `tone` is `'empty' | 'error'` (default `'empty'`), `icon` is a component
  reference, and `action` is `{ label: string, onClick: () => void }` or
  undefined. Tasks 3–5 import it as
  `import StatusNote from '../ui/StatusNote';` (from `src/components/stats/`)
  and `'./ui/StatusNote'` (from `src/components/`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/StatusNote.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart3 } from 'lucide-react';
import StatusNote from './StatusNote';

describe('StatusNote', () => {
  it('renders the message', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.getByText('Nichts hier.')).toBeInTheDocument();
  });

  it('defaults to the empty tone: muted ink, italic', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    const msg = screen.getByText('Nichts hier.');
    expect(msg).toHaveStyle({ color: 'var(--c-fg-muted)' });
    expect(msg).toHaveStyle({ fontStyle: 'italic' });
  });

  // Upright, not italic: an error set in italic reads as an aside.
  it('uses error ink and no italic for the error tone', () => {
    render(
      <StatusNote tone="error" icon={BarChart3}>
        Kaputt.
      </StatusNote>
    );
    const msg = screen.getByText('Kaputt.');
    expect(msg).toHaveStyle({ color: 'var(--c-error)' });
    expect(msg).not.toHaveStyle({ fontStyle: 'italic' });
  });

  // The whole of finding F1. The three errors this replaces all appear AFTER an
  // async failure, swapping out loading content. Without a live region that
  // substitution is silent to a screen reader.
  it('announces an error and stays silent when empty', () => {
    const { unmount } = render(
      <StatusNote tone="error" icon={BarChart3}>
        Kaputt.
      </StatusNote>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Kaputt.');
    unmount();

    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the icon from assistive tech', () => {
    const { container } = render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no action button unless one is passed', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the action and calls it', async () => {
    const onClick = vi.fn();
    render(
      <StatusNote tone="error" icon={BarChart3} action={{ label: 'Retry', onClick }}>
        Kaputt.
      </StatusNote>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Finding F2: the one existing retry control in the app is a bare <button>
  // with an underline, so injectGlobalStyles' single [data-ui] focus ring never
  // matches it. Going through Button is what closes that.
  it('gives the action the app focus ring by routing through Button', () => {
    render(
      <StatusNote tone="error" icon={BarChart3} action={{ label: 'Retry', onClick: () => {} }}>
        Kaputt.
      </StatusNote>
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('data-ui', 'button');
  });

  it("lets the caller's style win", () => {
    render(
      <StatusNote icon={BarChart3} data-testid="n" style={{ padding: '1px' }}>
        Nichts hier.
      </StatusNote>
    );
    expect(screen.getByTestId('n')).toHaveStyle({ padding: '1px' });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
npx vitest run src/components/ui/StatusNote.test.jsx
```

Expected: FAIL — the module does not exist. Confirm the failure is the missing
import and not a typo in the test file.

- [ ] **Step 3: Write the component**

Create `src/components/ui/StatusNote.jsx`:

```jsx
import { SPACE } from '../../lib/theme';
import { Stack } from './Layout';
import { Body } from './Text';
import Button from './Button';
import { TONE } from './tone';

// A note about a region's status. Not "EmptyState": half its call sites are
// errors, and a name that covers half the uses is how the family drifted apart
// in the first place (docs/status-states-spec.md §2).
//
// This composes and does not re-derive. It sets no font family, no font size,
// no line height — Body owns those — and no button styling, which Button owns.
// Its entire contribution is the arrangement, the tone, and the live region.

// StatusNote tone -> text tone. Two vocabularies on purpose: "empty" describes
// the SITUATION, "muted" describes the INK, and they are not the same idea.
const TEXT_TONE = { empty: 'muted', error: 'error' };

// Block-level statement, not an inline glyph. The app's inline icons are 14-16;
// 32 has existing precedent here for standalone marks.
const ICON_SIZE = 32;

export default function StatusNote({
  tone = 'empty',
  icon: Icon,
  action,
  as = 'div',
  style,
  children,
  ...rest
}) {
  // A warning rather than a throw, matching Button's icon-without-label
  // precedent: crashing a production screen over a missing glyph makes the
  // defect worse, not better. The paired test is what stops one landing.
  if (!Icon) {
    console.error('StatusNote: `icon` is required — see docs/status-states-spec.md §4.4.');
  }

  const isError = tone === 'error';
  const textTone = TEXT_TONE[tone] ?? TEXT_TONE.empty;

  return (
    <Stack
      as={as}
      gap={3}
      align="center"
      data-ui="status-note"
      data-tone={tone}
      // Only errors announce. An empty state is present on first paint, so a
      // live region would interrupt for a non-event.
      role={isError ? 'alert' : undefined}
      style={{
        padding: SPACE[6],
        textAlign: 'center',
        // The ink lives on the root so the icon can inherit it via
        // currentColor. One decision, not two, and the glyph cannot drift out
        // of contrast independently of its text.
        color: TONE[textTone],
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={ICON_SIZE} aria-hidden="true" color="currentColor" />}
      <Body
        size="sm"
        tone={textTone}
        // Italic is the hush an absent-content note wants, and is what the two
        // existing empty states already ship. Errors stay upright.
        style={isError ? undefined : { fontStyle: 'italic' }}
      >
        {children}
      </Body>
      {/* No `size` prop: Button only honours size for variant="icon", so
          passing it here would read as meaningful and do nothing. */}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/components/ui/StatusNote.test.jsx src/components/ui/tokenBoundary.test.js
```

Expected: PASS, including `tokenBoundary` — the new file must not import a
palette module or branch on the mode.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatusNote.jsx src/components/ui/StatusNote.test.jsx
git commit -m "feat(ui): add the StatusNote primitive"
```

---

### Task 3: Migrate the three empty states (E1, E2, E3)

**Files:**
- Modify: `src/components/stats/PerTabBars.jsx:16-28`
- Modify: `src/components/stats/ReviewFeed.jsx:22-34`
- Modify: `src/components/stats/LeaderboardSection.jsx:66-72`
- Test: the existing suites for these three components

**Interfaces:**
- Consumes: `StatusNote` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Confirm the existing tests pass before you touch anything**

```bash
npx vitest run src/components/stats/
```

Expected: PASS. This is the baseline. These tests assert rendered text, so they
must still pass **untouched** after the migration — that is the check that the
migration preserved behaviour.

- [ ] **Step 2: Migrate E1**

In `src/components/stats/PerTabBars.jsx`, add to the imports:

```jsx
import { BarChart3 } from 'lucide-react';
import StatusNote from '../ui/StatusNote';
```

Replace the whole `if (total === 0) { … }` block with:

```jsx
  if (total === 0) {
    return <StatusNote icon={BarChart3}>No exercises recorded yet.</StatusNote>;
  }
```

Then delete any of `FONTS`, `FONT_SIZE`, `COLORS` from this file's `theme`
import that are no longer referenced anywhere in it. Check by grepping the file
for each name before removing it.

- [ ] **Step 3: Migrate E2**

In `src/components/stats/ReviewFeed.jsx`, add to the imports:

```jsx
import { BookOpen } from 'lucide-react';
import StatusNote from '../ui/StatusNote';
```

Replace the whole `if (items.length === 0) { … }` block with:

```jsx
  if (items.length === 0) {
    return <StatusNote icon={BookOpen}>Nothing to review — keep practicing.</StatusNote>;
  }
```

`COLORS` is still used further down this file (the `verdictColor` line) — do not
remove that import. Re-check `FONTS` and `FONT_SIZE` before removing either.

- [ ] **Step 4: Migrate E3**

In `src/components/stats/LeaderboardSection.jsx`, add to the imports:

```jsx
import { Users } from 'lucide-react';
import StatusNote from '../ui/StatusNote';
```

Replace the whole `if (!user) { … }` block with:

```jsx
  if (!user) {
    return <StatusNote icon={Users}>Sign in to join a league and compete this week.</StatusNote>;
  }
```

Leave the `status === 'error'` and loading branches alone — they are Task 5 and
out of scope respectively.

- [ ] **Step 5: Run the stats suite and the linter**

```bash
npx vitest run src/components/stats/ && npx eslint src/components/stats/
```

Expected: PASS, with **no edits to any test file**. If a test needed changing,
stop: the migration altered behaviour and needs explaining before it lands.

- [ ] **Step 6: Commit**

```bash
git add src/components/stats/PerTabBars.jsx src/components/stats/ReviewFeed.jsx src/components/stats/LeaderboardSection.jsx
git commit -m "refactor(stats): move the three empty states onto StatusNote"
```

---

### Task 4: Migrate X1 — the deck-load error

Separate from Task 5 because X1 already has a working `retry` and needs no
behaviour change, while Task 5 introduces one.

**Files:**
- Modify: `src/components/VocabTab.jsx:300-314`
- Test: the existing `VocabTab` suite

**Interfaces:**
- Consumes: `StatusNote` (Task 2). `retry` and `deckError` already exist,
  destructured at `src/components/VocabTab.jsx:51-52`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

The current markup has no live region, so an assertion for one fails today. Add
to the existing `VocabTab` test file, inside whichever `describe` covers deck
loading (match the file's existing setup for forcing a deck error — do not
invent a new harness):

```jsx
  // Finding F1: this error replaces loading content asynchronously. Without a
  // live region the swap is silent to a screen reader.
  it('announces a deck-load failure', async () => {
    // …existing arrangement that forces deckError…
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this deck.');
  });
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/components/VocabTab.test.jsx -t "announces a deck-load failure"
```

Expected: FAIL — no element has `role="alert"`.

- [ ] **Step 3: Migrate X1**

In `src/components/VocabTab.jsx`, extend the existing lucide import and add the
primitive:

```jsx
import { Volume2, AlertTriangle } from 'lucide-react';
import StatusNote from './ui/StatusNote';
```

Replace the whole `{isAuto && deckError && ( … )}` block with:

```jsx
          {isAuto && deckError && (
            <StatusNote
              tone="error"
              icon={AlertTriangle}
              action={{ label: 'Retry', onClick: retry }}
            >
              Could not load this deck.
            </StatusNote>
          )}
```

This drops the mono family (no other error in the app uses it) and replaces the
underlined bare `<button>` with a real `Button`, which is what gives it the
global focus ring.

- [ ] **Step 4: Run the test and the suite**

```bash
npx vitest run src/components/VocabTab.test.jsx
```

Expected: PASS, including the new test and every pre-existing one unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/VocabTab.jsx src/components/VocabTab.test.jsx
git commit -m "refactor(vocab): move the deck-load error onto StatusNote"
```

---

### Task 5: Migrate X2 and X3, and give both a way back

**Files:**
- Modify: `src/components/stats/LeaderboardSection.jsx:74-76` and its `useEffect`
- Modify: `src/components/stats/ProfileCard.jsx:137` and its `useEffect`
- Test: the existing suites for both

**Interfaces:**
- Consumes: `StatusNote` (Task 2); `AlertTriangle` (already added to
  `VocabTab` in Task 4, imported fresh here).
- Produces: nothing new.

- [ ] **Step 1: Verify the retry assumption before relying on it**

`LeaderboardSection`'s effect calls `joinLeague()`, and its existing comment
warns against re-firing because a double-create is possible. Read
`joinLeague`'s implementation now and answer one question: **is re-running the
effect on an explicit retry equivalent to leaving the tab and coming back?**
Switching tabs already unmounts and remounts this component, re-running the same
effect — so if that is safe, retry is safe.

If the equivalence holds, continue. If it does not, X2 ships **without** an
action, record why in the commit message, and do X3 only. Do not invent a
guard or a de-duplication mechanism — that is a different change.

- [ ] **Step 2: Write the failing tests**

In the `LeaderboardSection` suite, using the file's existing mocking setup for
forcing the fetch to reject:

```jsx
  it('announces a league load failure and offers a way back', async () => {
    // …existing arrangement that makes the league fetch reject…
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your league.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('refetches when Retry is pressed', async () => {
    // …arrangement that rejects once, then resolves…
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    // Assert on the recovered UI, not on a call count: the count is an
    // implementation detail and would pass even if the retry re-rendered the
    // same error.
    expect(await screen.findByRole('heading', { name: /League/ })).toBeInTheDocument();
  });
```

And the matching pair in the `ProfileCard` suite:

```jsx
  it('announces a profile load failure and offers a way back', async () => {
    // …existing arrangement that makes the profile fetch reject…
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load profile.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run them and confirm they fail**

```bash
npx vitest run src/components/stats/LeaderboardSection.test.jsx src/components/stats/ProfileCard.test.jsx
```

Expected: FAIL — no `role="alert"`, no Retry button.

- [ ] **Step 4: Add recovery to `LeaderboardSection`**

Add the nonce beside the existing `state`:

```jsx
  const [nonce, setNonce] = useState(0);
```

Add it to the effect's dependency array, changing only that line:

```jsx
  }, [userId, nonce]);
```

Replace the error branch:

```jsx
  if (state.status === 'error') {
    return (
      <StatusNote
        tone="error"
        icon={AlertTriangle}
        action={{ label: 'Retry', onClick: () => setNonce((n) => n + 1) }}
      >
        Couldn&apos;t load your league.
      </StatusNote>
    );
  }
```

Extend the lucide import added in Task 3 to `import { Users, AlertTriangle } from 'lucide-react';`.

- [ ] **Step 5: Add recovery to `ProfileCard`**

Same shape. Add the imports:

```jsx
import { AlertTriangle } from 'lucide-react';
import StatusNote from '../ui/StatusNote';
```

Add the nonce, append it to the existing effect's dependency array, and replace
the error line:

```jsx
        {error && (
          <StatusNote
            tone="error"
            icon={AlertTriangle}
            action={{ label: 'Retry', onClick: () => setNonce((n) => n + 1) }}
          >
            Couldn&apos;t load profile.
          </StatusNote>
        )}
```

Leave the `Loading…` line beneath it alone — loading is out of scope (spec §6).

**One thing to check while here:** `setError` must be reset to `false` when the
effect re-runs, or the retry renders the error again over fresh data. If the
effect does not already clear it, clear it at the top of the effect body.

- [ ] **Step 6: Run both suites and the linter**

```bash
npx vitest run src/components/stats/ && npx eslint src/components/stats/
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/stats/LeaderboardSection.jsx src/components/stats/ProfileCard.jsx src/components/stats/LeaderboardSection.test.jsx src/components/stats/ProfileCard.test.jsx
git commit -m "feat(stats): give the league and profile errors a way back"
```

---

### Task 6: The guard against re-drift

**Files:**
- Create: `src/components/ui/statusNoteAdoption.test.js`

**Interfaces:**
- Consumes: nothing at runtime — this is a source-text scan, in the same style
  as `src/components/ui/tokenBoundary.test.js`.
- Produces: nothing.

- [ ] **Step 1: Write the guard**

Create `src/components/ui/statusNoteAdoption.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const STATS_DIR = 'src/components/stats';

// The recipe the three empty states each invented independently: body-italic in
// muted ink. Once StatusNote exists, a NEW occurrence of it means someone
// hand-rolled a status state again.
const RECIPE = /fontStyle:\s*'italic'/;
const MUTED = /COLORS\.mute\b/;

// One entry, and it is not a convenience. TodaySnapshot uses this exact recipe
// for the "exercise(s)" unit label under a count — it is always rendered and is
// not a status state at all (docs/status-states-spec.md §2.3). A naive scan
// fires on it, and a guard that fires on correct code gets deleted by the next
// person to hit it. Any SECOND appearance fails.
const ALLOWED = new Set(['TodaySnapshot.jsx']);

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sources(full, out);
      continue;
    }
    if (/\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(full);
  }
  return out;
}

// A file "hand-rolls" a status state if it contains both halves of the recipe.
function handRolls(text) {
  return RECIPE.test(text) && MUTED.test(text);
}

describe('status states go through StatusNote', () => {
  it('no stats component hand-rolls the italic-muted recipe', () => {
    const files = sources(STATS_DIR);
    // Denominator: an empty walk and a clean walk both report zero offenders.
    expect(files.length).toBeGreaterThan(3);

    const offenders = files
      .filter((f) => !ALLOWED.has(relative(STATS_DIR, f)))
      .filter((f) => handRolls(readFileSync(f, 'utf8')))
      .map((f) => relative(STATS_DIR, f));

    expect(
      offenders,
      `scanned ${files.length} files; hand-rolled status states:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  // Both controls. A matcher that stopped matching reports the same clean run
  // as a clean tree.
  it('fires on the recipe and not on a migrated call site', () => {
    expect(
      handRolls("style={{ fontStyle: 'italic', color: COLORS.mute, fontSize: FONT_SIZE.base }}")
    ).toBe(true);

    // A migrated call site: no recipe at all.
    expect(handRolls('return <StatusNote icon={BarChart3}>No exercises recorded yet.</StatusNote>;'))
      .toBe(false);

    // Half the recipe is not the recipe — muted text on its own is everywhere
    // in this app and is not a status state.
    expect(handRolls('<span style={{ color: COLORS.mute }}>{count}</span>')).toBe(false);
  });

  // The allowlist must name a file that actually exists and actually matches,
  // or it is silently excusing nothing while looking like it excuses something.
  it('keeps the allowlist honest', () => {
    for (const name of ALLOWED) {
      const text = readFileSync(join(STATS_DIR, name), 'utf8');
      expect(handRolls(text), `${name} is allowlisted but no longer matches — remove it`).toBe(
        true
      );
    }
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx vitest run src/components/ui/statusNoteAdoption.test.js
```

Expected: PASS on all three. If the first fails, a call site was missed in Tasks
3–5; fix the call site, not the guard.

- [ ] **Step 3: Prove the guard has teeth**

Temporarily reintroduce the recipe into a migrated file — add
`style={{ fontStyle: 'italic', color: COLORS.mute }}` to any element in
`PerTabBars.jsx` — and re-run. It must FAIL and must name `PerTabBars.jsx`.
Then revert the edit and confirm it passes again.

A guard that has only ever been seen to pass is not known to be a guard.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/statusNoteAdoption.test.js
git commit -m "test(ui): guard against hand-rolled status states"
```

---

### Task 7: Full verification

**Files:** none — this task only runs things.

- [ ] **Step 1: Run the whole suite**

```bash
npm test
```

Expected: PASS. Note the total count and compare against `main`'s. It should
rise by roughly the number of tests added in Tasks 1–6 — a *fall* means a file
stopped being collected and must be investigated before this lands.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Look at it in a browser at 320px**

Start the dev server and check all six surfaces at 320px wide in both light and
dark. jsdom computes no layout, so this is the only thing that can tell you the
32px icon and the Retry button do not overflow the narrowest supported viewport.

Specifically confirm: the icon is centred, the message wraps rather than
overflowing, and the Retry button sits below the message rather than beside it.

- [ ] **Step 4: Push and open the PR**

Push the implementation branch created at the start of execution (see *Before
you start*, above — **not** `claude/status-states-spec`, which carries only this
plan and its spec):

```bash
git push -u origin <implementation-branch>
```

`main` has branch protection. Do not merge until Lint, Test, RLS, Contrast and
SonarCloud are all green. Never merge locally, and never use `--no-verify`.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4.1 API | 2 |
| §4.2 Structure | 2 |
| §4.3 Tone, `TONE.error`, comment fix | 1, 2 |
| §4.4 Icon (32px, aria-hidden, currentColor, component ref) | 2 |
| §4.5 A11y (`role="alert"`, focus ring via Button) | 2, 4, 5 |
| §5 Call-site migration E1–E3 | 3 |
| §5 Call-site migration X1 | 4 |
| §5.1 Recovery for X2, X3 | 5 |
| §6 Out of scope (ErrorBoundary, form errors, loading) | untouched by every task; stated in 5 |
| §7 Unit tests | 1, 2, 4, 5 |
| §7 Guard with denominator + both controls | 6 |
| §7 No browser probe; §8 visible change | 7 (manual 320px check) |

No gaps.

**Placeholder scan:** The only deliberately non-literal steps are Task 4 Step 1
and Task 5 Step 2, where the test arrangement says "existing arrangement that
forces …". This is intentional: those suites already have mocking setups for
their fetches, and inventing a second harness alongside one that works is worse
than reusing it. The assertions themselves are written out in full.

**Type consistency:** `StatusNote` takes `tone`, `icon`, `action`, `as`,
`style`, `children` in Task 2 and is called with exactly those in Tasks 3, 4 and
5. `action` is `{ label, onClick }` at every call site. `TONE.error` is defined
in Task 1 and consumed in Task 2 via `TEXT_TONE`.
