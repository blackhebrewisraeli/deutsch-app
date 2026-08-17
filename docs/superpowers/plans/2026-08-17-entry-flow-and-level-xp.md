# Entry flow, level in settings, and XP by level — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Welcome gate a function of whether an account session exists rather than a once-per-device flag, give signed-in users a Level control in settings, and pay more XP at harder levels for account holders.

**Architecture:** Three PRs. PR A (Tasks 1–2) rewrites the two entry-screen gates in `App.jsx` and stops the screens inverting the theme. PR B (Tasks 3–5) extracts the level-write path into one helper and adds a `LevelPicker` to the Stats tab. PR C (Tasks 6–7) adds `LEVEL_MULTIPLIERS` and an in-memory entitlement flag that `recordEvent` folds into the bonus it already computes.

**Tech Stack:** React 18, Vite 5, Vitest + React Testing Library (`globals: false`), inline styles from `src/lib/theme.js`, localStorage.

**Spec:** `docs/superpowers/specs/2026-08-17-entry-flow-and-level-xp-design.md`

## Global Constraints

- **Every test file imports its helpers**: `import { describe, it, expect, vi } from 'vitest'`. Vitest runs with `globals: false`.
- **Inline styles only**, tokens from `src/lib/theme.js`. Never hardcode a colour, radius or shadow.
- **Grid tracks are `minmax(0, 1fr)`**, never a bare `1fr`.
- **Never bypass `.husky/pre-commit`.** `--no-verify` is forbidden. The hook runs lint-staged *and* the full suite (~30s); a green commit is the passing signal.
- **Never rename or migrate a localStorage key.** `deutsch-onboarded` keeps being written even though nothing reads it after Task 2.
- **`isAuthConfigured()` is `true` in a local test run and `false` in CI** — it reads `import.meta.env.VITE_SUPABASE_*` and Vitest loads `.env`. Any test whose outcome depends on it MUST mock `src/lib/auth.js` explicitly. This is spec F7 and it is the single easiest way to ship a green-locally / red-in-CI test in this codebase.
- **Mock `lib/auth.js` by spreading the real module**, never with a bare factory: `App.jsx` imports six names from it and `StatsTab`/`WelcomeGate`/`GoogleButton` import more. A partial factory breaks unrelated imports.
- **Baseline:** `main` at `d6f96e0`, 1417 tests passing.
- **Verification for every task:** `npm test`, `npm run lint`, `npm run format:check`.

---

### Task 1: Entry screens follow the theme instead of inverting it

`COLORS.ink` is `var(--c-fg)` (foreground) and `COLORS.paper` is `var(--c-ground)` (background). Both entry screens paint their background with `COLORS.ink`, so they render as the photographic negative of the resolved theme: a light-mode machine gets a dark gate. Swap the pair.

Scope is exactly the ink/paper inversion. The red and gold stripes are untouched — `COLORS.red` is `var(--c-error)` and `COLORS.gold` is `var(--c-accent)`, and re-pairing those with their correct on-fill inks is a separate question (see Out of Scope).

**Files:**
- Modify: `src/components/WelcomeGate.jsx:16-17`, `:45`
- Modify: `src/components/SplashScreen.jsx:49`, `:60`
- Test: `src/components/WelcomeGate.test.jsx`, `src/components/SplashScreen.test.jsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on. Props and exports are unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/WelcomeGate.test.jsx`, inside the top-level `describe('WelcomeGate', ...)`:

```jsx
  // The bug this guards: background painted with COLORS.ink (var(--c-fg)) makes
  // the gate the exact inverse of the app — a light-mode machine gets a dark
  // gate. Asserted negatively, because "background is some token" passes
  // against the broken version too.
  it('takes its background from the ground token, not the foreground one', () => {
    const { container } = render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} />);
    const screenEl = container.firstChild;
    expect(screenEl.style.background).toBe('var(--c-ground)');
    expect(screenEl.style.background).not.toBe('var(--c-fg)');
    expect(screenEl.style.color).toBe('var(--c-fg)');
  });
```

Append to `src/components/SplashScreen.test.jsx`, inside `describe('SplashScreen', ...)`:

```jsx
  it('paints the wordmark stripe with the ground token, not the foreground one', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    const stripe = container.firstChild.firstChild;
    expect(stripe.style.background).toBe('var(--c-ground)');
    expect(stripe.style.background).not.toBe('var(--c-fg)');
  });

  it('renders the wordmark in the foreground token', () => {
    render(<SplashScreen onComplete={() => {}} />);
    const wordmark = screen.getByText('Sprachschule').previousSibling;
    expect(wordmark.style.color).toBe('var(--c-fg)');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/components/WelcomeGate.test.jsx src/components/SplashScreen.test.jsx
```

Expected: 3 failures, each reporting `var(--c-fg)` received where `var(--c-ground)` was expected.

- [ ] **Step 3: Swap the pair in WelcomeGate**

In `src/components/WelcomeGate.jsx`, the outer `div`'s style: change `background: COLORS.ink` to `background: COLORS.paper`, and `color: COLORS.paper` to `color: COLORS.ink`.

Then the focus-ring rule on line 45 — it outlines in `COLORS.paper` because it sat on a dark slab, and on a ground-coloured background that ring is now invisible:

```jsx
      <style>{`.welcome-guest:focus-visible { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; border-radius: 4px; }`}</style>
```

And the guest button's own `color: COLORS.paper` becomes `color: COLORS.ink`.

- [ ] **Step 4: Swap the pair in SplashScreen**

In `src/components/SplashScreen.jsx`, the first (wordmark) stripe: `background: COLORS.ink` becomes `background: COLORS.paper`, and the wordmark div's `color: COLORS.paper` becomes `color: COLORS.ink`. Leave the red and gold stripes exactly as they are.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/components/WelcomeGate.test.jsx src/components/SplashScreen.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Verify in a real browser, both modes**

```bash
npm run dev
```

Clear `deutsch-onboarded` and `deutsch-level` in devtools, reload, and confirm the gate and splash now match the OS colour scheme. Toggle the OS between light and dark and reload for each. Check at 375px and 320px widths — this is the project's narrow-viewport rule and the splash's three level buttons are the widest row on the screen.

- [ ] **Step 7: Commit**

```bash
git add src/components/WelcomeGate.jsx src/components/WelcomeGate.test.jsx src/components/SplashScreen.jsx src/components/SplashScreen.test.jsx
git commit -m "fix(entry): stop the welcome and splash screens inverting the theme"
```

---

### Task 2: Gate on account session, not on a device flag

**Files:**
- Modify: `src/App.jsx:297-305` (gate state and handlers), `:406-419` (splash state), `:516-530` (render gates)
- Modify: `src/App.jsx:44-51` (add `mayHaveSession` to the auth import)
- Test: `src/App.test.jsx` — retarget four fixtures, add one new `describe`

**Interfaces:**
- Consumes: `mayHaveSession()` from `src/lib/auth.js` (existing, `auth.js:131`) — returns `boolean`, `false` when auth is unconfigured, fails open to `true` when it cannot tell.
- Produces: nothing other tasks import. Task 5 will read the same `level` state this task leaves in place.

- [ ] **Step 1: Retarget the four existing fixtures**

In `src/App.test.jsx`, lines 43, 90, 235 and 307 each read:

```js
    localStorage.setItem('deutsch-onboarded', '1');
```

Change every one to:

```js
    localStorage.setItem('deutsch-level', 'a1');
```

After Task 2 nothing reads `deutsch-onboarded`, so those lines would silently stop skipping onboarding and every test in those four blocks would start asserting against the splash screen.

- [ ] **Step 2: Write the failing tests**

Add a new top-level `describe` at the end of `src/App.test.jsx`. It needs its own module mock; put the `vi.mock` call at the top of the file, next to the existing `@vercel/analytics` mock, because `vi.mock` is hoisted to the top of the module regardless of where it is written.

At the top of the file, after the `@vercel/analytics` mock:

```jsx
const authMock = vi.hoisted(() => ({
  configured: true,
  status: 'anonymous',
  mayHaveSession: false,
}));

// Spread the real module: App imports six names from it and StatsTab,
// WelcomeGate and GoogleButton import more. A bare factory breaks them.
// Mocked rather than inherited because isAuthConfigured() reads
// import.meta.env.VITE_SUPABASE_*, which Vitest loads from .env — true on a
// developer's machine, false in CI. See spec F7.
vi.mock('./lib/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  isAuthConfigured: () => authMock.configured,
  isGoogleAuthConfigured: () => false,
  mayHaveSession: () => authMock.mayHaveSession,
  useAuth: () => ({
    session: null,
    user: authMock.status === 'authenticated' ? { id: 'u1', email: 'a@b.co' } : null,
    status: authMock.status,
  }),
}));
```

Then the new block at the end of the file:

```jsx
describe('entry gate', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    authMock.configured = true;
    authMock.status = 'anonymous';
    authMock.mayHaveSession = false;
    setViewportWidth(1280);
  });

  const gate = () => screen.queryByRole('button', { name: 'Try it first — free →' });
  const levelPicker = () => screen.queryByRole('button', { name: /Beginner \(A1\)/ });

  it('shows the gate to a guest who has already onboarded once', () => {
    // The whole point of the change: a device flag must not hide the gate.
    localStorage.setItem('deutsch-onboarded', '1');
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeInTheDocument();
  });

  it('shows the level picker after the guest continues', async () => {
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    await userEvent.click(gate());
    expect(levelPicker()).toBeInTheDocument();
  });

  it('lets a signed-in user straight through to the app', () => {
    authMock.status = 'authenticated';
    authMock.mayHaveSession = true;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeNull();
    expect(levelPicker()).toBeNull();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('does not flash the gate while a session is still resolving', () => {
    // A device holding an auth token is probably signed in. Rendering the gate
    // during 'loading' would blink it in their face on every single load.
    authMock.status = 'loading';
    authMock.mayHaveSession = true;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeNull();
  });

  it('shows the gate during loading when the device holds no token', () => {
    authMock.status = 'loading';
    authMock.mayHaveSession = false;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeInTheDocument();
  });

  it('skips the gate entirely when no auth backend is configured', () => {
    // A gate whose only affordance is "continue" is the dead-affordance bug
    // PR #79 already fixed once.
    authMock.configured = false;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeNull();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows the level picker to anyone who has never chosen a level', () => {
    authMock.configured = false;
    render(<App />);
    expect(levelPicker()).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run src/App.test.jsx
```

Expected: the four "guest sees the gate again" / loading-branch cases fail, because `showGate` is still keyed on `deutsch-onboarded`.

- [ ] **Step 4: Add `mayHaveSession` to the auth import**

In `src/App.jsx`, extend the existing import block at lines 44-51:

```js
import {
  useAuth,
  signOut,
  getAccessToken,
  isAuthConfigured,
  mayHaveSession,
  signInWithGoogle,
  humanAuthError,
} from './lib/auth';
```

`mayHaveSession` is the only addition — the other six are what `App.jsx` imports today. Adding an unused seventh fails lint.

The OAuth return path needs no change: `AuthCallbackLanding` already calls `onSignedIn={handleAuthDone}` (`App.jsx:332`), so rewriting `handleAuthDone` in Step 5 covers a Google redirect as well as the in-place sheet.

- [ ] **Step 5: Replace the gate state and handlers**

In `src/App.jsx`, replace line 297:

```js
  const [showGate, setShowGate] = useState(() => !localStorage.getItem('deutsch-onboarded'));
```

with:

```js
  // Dismissal is component state, not storage: the gate is a property of "is
  // there a session", so it comes back on the next load for anyone without one.
  const [gateDismissed, setGateDismissed] = useState(false);
  // Seeded from `deutsch-level`, not from isAuthConfigured(): env-independent
  // (spec F7), and it states the real precondition — someone who has never
  // picked a level needs the picker however they arrived.
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem('deutsch-level'));
```

Then update the two handlers at lines 300-305:

```js
  const handleGuest = () => {
    setGateDismissed(true);
    setShowSplash(true);
  };
  const handleAuthDone = () => {
    setAuthModal(null);
    setGateDismissed(true);
    setShowSplash(true);
    // Nothing reads this key any more; kept because AGENTS.md forbids removing
    // or migrating a storage key.
    localStorage.setItem('deutsch-onboarded', '1');
  };
```

- [ ] **Step 6: Delete the old splash state**

Delete line 407 entirely — the `showSplash` declaration moved to Step 5 and two `useState` calls with the same name will not compile:

```js
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem('deutsch-onboarded'));
```

Leave the `level` state (line 408) and `handleSplashComplete` (line 416) exactly as they are.

- [ ] **Step 7: Replace the render gate**

In `src/App.jsx`, replace the condition at line 516:

```js
  if (showGate && !user) {
```

with:

```js
  // `loading` is the first render for everyone, and useAuth settles in an
  // effect — i.e. after paint. Without the mayHaveSession() clause a guest sees
  // one frame of the app before the gate; with it, a device holding no token
  // gets the gate on the first paint and a device that might have a session
  // renders the app and never blinks.
  const sessionUnresolved = authStatus === 'loading' && !mayHaveSession();
  const showGate =
    !gateDismissed && isAuthConfigured() && (authStatus === 'anonymous' || sessionUnresolved);

  if (showGate) {
```

`&& !user` is dropped: `authStatus === 'anonymous'` already implies no user, and keeping both invites them to disagree.

The declaration must sit above the `if`, alongside the existing `trialWallUp` computation (line 508) — not up with the `useState` calls, because it reads `authStatus`.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npx vitest run src/App.test.jsx
```

Expected: PASS, including the four retargeted fixture blocks.

- [ ] **Step 9: Run the full suite and lint**

```bash
npm test && npm run lint && npm run format:check
```

Expected: all green, 1417 + the new cases.

- [ ] **Step 10: Verify signing out returns you to the gate**

```bash
npm run dev
```

With a real account: sign in, reach the app, then sign out from Stats → Account & sync. The gate must appear immediately — `authStatus` flips to `anonymous` and `gateDismissed` is still false for a user who arrived signed in. Then reload as a guest and confirm the gate appears again, which is the regression this whole task exists to prevent.

- [ ] **Step 11: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "fix(entry): gate on account session instead of a device flag"
```

---

### Task 3: One helper for the level-write path

Three places will write the level after Task 5 (splash, settings picker, the Translate review handler at `App.jsx:449`). Each currently repeats "set localStorage, stamp settings". Extract before adding the third.

**Files:**
- Create: `src/lib/levelPref.js`
- Create: `src/lib/levelPref.test.js`
- Modify: `src/components/SplashScreen.jsx:13-18`
- Modify: `src/App.jsx:449-457`

**Interfaces:**
- Produces:
  - `LEVELS: readonly ['a1', 'a2', 'b1']`
  - `readLevel(): 'a1' | 'a2' | 'b1'` — reads `deutsch-level`, maps the legacy `'beginner'`/`'intermediate'` values, defaults `'a1'`
  - `writeLevel(level: string): void` — persists `deutsch-level` and calls `stampSettings()`; ignores an unknown level

- [ ] **Step 1: Write the failing test**

Create `src/lib/levelPref.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEVELS, readLevel, writeLevel } from './levelPref';

vi.mock('./settingsStamp', () => ({ stampSettings: vi.fn() }));
import { stampSettings } from './settingsStamp';

describe('levelPref', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('lists the three levels in order', () => {
    expect(LEVELS).toEqual(['a1', 'a2', 'b1']);
  });

  it('defaults to a1 when nothing is stored', () => {
    expect(readLevel()).toBe('a1');
  });

  it.each([
    ['beginner', 'a1'],
    ['intermediate', 'b1'],
  ])('maps the legacy value %s to %s', (stored, expected) => {
    localStorage.setItem('deutsch-level', stored);
    expect(readLevel()).toBe(expected);
  });

  it('falls back to a1 for a corrupt value', () => {
    localStorage.setItem('deutsch-level', 'c2');
    expect(readLevel()).toBe('a1');
  });

  it('persists and stamps on write', () => {
    writeLevel('b1');
    expect(localStorage.getItem('deutsch-level')).toBe('b1');
    expect(stampSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown level rather than persisting it', () => {
    writeLevel('a1');
    writeLevel('c2');
    expect(localStorage.getItem('deutsch-level')).toBe('a1');
    expect(stampSettings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/levelPref.test.js
```

Expected: FAIL — `Failed to resolve import "./levelPref"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/levelPref.js`:

```js
import { stampSettings } from './settingsStamp';

/** Per-device practice level. NOT part of synced `deutsch-app-state-v1`. */
export const LEVEL_KEY = 'deutsch-level';

export const LEVELS = ['a1', 'a2', 'b1'];

// Values written by builds that predate the CEFR codes.
const LEGACY = { beginner: 'a1', intermediate: 'b1' };

/**
 * @returns {'a1' | 'a2' | 'b1'} the stored level, a1 when unset or corrupt
 */
export function readLevel() {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    if (LEVELS.includes(stored)) return stored;
    if (stored in LEGACY) return LEGACY[stored];
  } catch {
    // private mode / blocked storage
  }
  return 'a1';
}

/**
 * Persist a level and stamp settings for last-write-wins sync.
 * Unknown values are ignored rather than persisted.
 * @param {string} level
 */
export function writeLevel(level) {
  if (!LEVELS.includes(level)) return;
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // best-effort; the caller's in-memory state still updates
  }
  stampSettings();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/levelPref.test.js
```

Expected: PASS.

- [ ] **Step 5: Use the helper in SplashScreen**

In `src/components/SplashScreen.jsx`, replace the import of `stampSettings` with `import { writeLevel } from '../lib/levelPref';` and rewrite `handleSelect`:

```jsx
  const handleSelect = (level) => {
    writeLevel(level);
    // Nothing reads this key after the gate change; kept because AGENTS.md
    // forbids removing or migrating a storage key.
    localStorage.setItem('deutsch-onboarded', '1');
    onComplete(level);
  };
```

`SplashScreen.test.jsx` asserts both keys and must keep passing untouched.

- [ ] **Step 6: Use the helper in App's review handler**

In `src/App.jsx`, replace the body of the `if` at lines 449-457:

```js
    if (item.tab === 'translate' && item.context && item.context !== level) {
      setLevel(item.context);
      writeLevel(item.context);
    }
```

Add `import { readLevel, writeLevel } from './lib/levelPref';` to the imports, and replace the `level` initialiser at line 408-414 with:

```js
  const [level, setLevel] = useState(readLevel);
```

- [ ] **Step 7: Run the full suite**

```bash
npm test && npm run lint && npm run format:check
```

Expected: all green. No existing test should need changing — `readLevel` reproduces the old initialiser's mapping exactly, including the `'beginner'` and `'intermediate'` legacy values.

- [ ] **Step 8: Commit**

```bash
git add src/lib/levelPref.js src/lib/levelPref.test.js src/components/SplashScreen.jsx src/App.jsx
git commit -m "refactor(level): one helper for reading and writing the level preference"
```

---

### Task 4: LevelPicker component

**Files:**
- Create: `src/components/gamification/LevelPicker.jsx`
- Create: `src/components/gamification/LevelPicker.test.jsx`

**Interfaces:**
- Consumes: `LEVELS` from `src/lib/levelPref.js` (Task 3); `SegmentedPicker` from `src/components/ui/SegmentedPicker.jsx` — props `{ options: [{key, label, detail?}], activeKey, onPick, ariaLabel }`, calls `onPick(option)` with the whole option object.
- Produces: `export default function LevelPicker({ level, onPick })` — `onPick` receives the level **key** (`'a1' | 'a2' | 'b1'`), not the option object. Task 5 and Task 7 both depend on that signature.

- [ ] **Step 1: Write the failing test**

Create `src/components/gamification/LevelPicker.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LevelPicker from './LevelPicker';

describe('LevelPicker', () => {
  it('renders the three levels with their CEFR codes', () => {
    render(<LevelPicker level="a1" onPick={() => {}} />);
    for (const name of [/BEGINNER/, /ELEMENTARY/, /INTERMEDIATE/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: 'Practice level' })).toBeInTheDocument();
  });

  it('marks only the active level as pressed', () => {
    render(<LevelPicker level="a2" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /ELEMENTARY/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /BEGINNER/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('reports the level key, not the option object', async () => {
    const onPick = vi.fn();
    render(<LevelPicker level="a1" onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: /INTERMEDIATE/ }));
    expect(onPick).toHaveBeenCalledWith('b1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/gamification/LevelPicker.test.jsx
```

Expected: FAIL — `Failed to resolve import "./LevelPicker"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/gamification/LevelPicker.jsx`:

```jsx
import SegmentedPicker from '../ui/SegmentedPicker';

// Label/detail split mirrors GoalPicker: the word is the label, the short
// token is the big detail line.
const OPTIONS = [
  { key: 'a1', label: 'Beginner', detail: 'A1' },
  { key: 'a2', label: 'Elementary', detail: 'A2' },
  { key: 'b1', label: 'Intermediate', detail: 'B1' },
];

// Practice-level picker for the settings surface. Selecting calls onPick(key).
export default function LevelPicker({ level, onPick }) {
  return (
    <SegmentedPicker
      options={OPTIONS}
      activeKey={level}
      onPick={(o) => onPick(o.key)}
      ariaLabel="Practice level"
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/gamification/LevelPicker.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/gamification/LevelPicker.jsx src/components/gamification/LevelPicker.test.jsx
git commit -m "feat(level): add a LevelPicker built on SegmentedPicker"
```

---

### Task 5: Wire the LevelPicker into the Stats tab

This is what makes Task 2 tolerable: a signed-in user no longer meets the splash, so this is the only place they can change difficulty.

**Files:**
- Modify: `src/components/StatsTab.jsx:33-42` (props), `:22-24` (imports), `:160-180` (new section beside Daily goal)
- Modify: `src/App.jsx` (pass `level` and a handler to `StatsTab`)
- Test: `src/components/StatsTab.test.jsx`

**Interfaces:**
- Consumes: `LevelPicker` from Task 4 — `onPick` yields the level key; `writeLevel` from Task 3.
- Produces: two new `StatsTab` props — `level: 'a1' | 'a2' | 'b1'` and `onLevelChange: (level: string) => void`. Both optional, defaulting to `'a1'` and a no-op, so existing `StatsTab` tests render unchanged.

- [ ] **Step 1: Write the failing test**

Append to `src/components/StatsTab.test.jsx`:

```jsx
  it('offers a level picker and reports the chosen level', async () => {
    const onLevelChange = vi.fn();
    render(<StatsTab level="a1" onLevelChange={onLevelChange} />);
    await userEvent.click(screen.getByRole('button', { name: /INTERMEDIATE/ }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });

  it('persists the chosen level', async () => {
    render(<StatsTab level="a1" onLevelChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /ELEMENTARY/ }));
    expect(localStorage.getItem('deutsch-level')).toBe('a2');
  });
```

Check the file's existing imports first — add `vi` and `userEvent` only if they are not already imported.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/StatsTab.test.jsx
```

Expected: FAIL — no button matching `/INTERMEDIATE/`.

- [ ] **Step 3: Add the props and import**

In `src/components/StatsTab.jsx`, add to the imports beside `GoalPicker`:

```jsx
import LevelPicker from './gamification/LevelPicker';
import { writeLevel } from '../lib/levelPref';
```

and extend the props at lines 33-42 with:

```jsx
  level = 'a1',
  onLevelChange = () => {},
```

- [ ] **Step 4: Render the section**

In `src/components/StatsTab.jsx`, immediately after the Daily goal block's closing `</div>` (the one that wraps `GoalPicker`, ending near line 180), add:

```jsx
              <div style={{ marginTop: SPACE[5] }}>
                <SectionLabel num="·" text="Practice level" />
                <LevelPicker
                  level={level}
                  onPick={(next) => {
                    writeLevel(next);
                    onLevelChange(next);
                  }}
                />
              </div>
```

- [ ] **Step 5: Pass the props from App**

In `src/App.jsx`, the `<StatsTab` element at line 817 — add two props:

```jsx
              level={level}
              onLevelChange={setLevel}
```

`writeLevel` is already called inside `StatsTab`, so `App` only mirrors the change into React state. Do not call `writeLevel` again here — a second `stampSettings()` for one user action muddies the last-write-wins clock.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run src/components/StatsTab.test.jsx src/App.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Verify the round trip in a browser**

```bash
npm run dev
```

Stats → Practice level → pick B1. Switch to Vocab and confirm the deck list is the B1 one, then reload and confirm B1 survived. Check the picker at 320px — it is a three-column `SegmentedPicker`, the same shape as the goal picker directly above it.

- [ ] **Step 8: Full suite, lint, commit**

```bash
npm test && npm run lint && npm run format:check
git add src/components/StatsTab.jsx src/components/StatsTab.test.jsx src/App.jsx
git commit -m "feat(level): change practice level from settings without signing out"
```

---

### Task 6: XP multiplier by level

**Files:**
- Modify: `src/lib/gameConfig.js` (add `LEVEL_MULTIPLIERS`)
- Create: `src/lib/xpEntitlement.js`
- Create: `src/lib/xpEntitlement.test.js`
- Modify: `src/lib/stats.js:235-255` (`recordEvent`)
- Test: `src/lib/stats.test.js`

**Interfaces:**
- Produces:
  - `LEVEL_MULTIPLIERS: { a1: 1, a2: 1.25, b1: 1.5 }` from `src/lib/gameConfig.js`
  - `setLevelBoostEnabled(on: boolean): void` and `isLevelBoostEnabled(): boolean` from `src/lib/xpEntitlement.js`. Defaults to `false`. Task 7 calls the setter.
  - `recordEvent(tab, level, verdict)` keeps its signature and its `{ xp, mult }` return; `mult` now includes the level factor.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/xpEntitlement.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { setLevelBoostEnabled, isLevelBoostEnabled } from './xpEntitlement';

describe('xpEntitlement', () => {
  beforeEach(() => setLevelBoostEnabled(false));

  it('defaults to off so a guest and a test both get flat XP', () => {
    expect(isLevelBoostEnabled()).toBe(false);
  });

  it('round-trips the flag', () => {
    setLevelBoostEnabled(true);
    expect(isLevelBoostEnabled()).toBe(true);
    setLevelBoostEnabled(false);
    expect(isLevelBoostEnabled()).toBe(false);
  });

  it('coerces truthy and falsy values to booleans', () => {
    setLevelBoostEnabled('yes');
    expect(isLevelBoostEnabled()).toBe(true);
    setLevelBoostEnabled(undefined);
    expect(isLevelBoostEnabled()).toBe(false);
  });
});
```

Append to `src/lib/stats.test.js` a new block. The fixture deliberately carries **two different levels and a streak long enough that the streak multiplier is not 1** — with one level and no streak, a correct implementation and a broken one produce identical numbers:

```js
describe('recordEvent — XP by level', () => {
  beforeEach(() => {
    localStorage.clear();
    setLevelBoostEnabled(false);
  });

  /** Seed `days` consecutive qualifying days ending yesterday. */
  function seedStreak(days) {
    const daily = {};
    const [y, m, d] = todayKey().split('-').map(Number);
    for (let i = days; i >= 1; i -= 1) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - i);
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      daily[`${dt.getUTCFullYear()}-${mm}-${dd}`] = {
        byLevel: { a1: { correct: 6, almost: 0, wrong: 0 } },
      };
    }
    saveState({ daily, gamification: { goal: 50 } });
  }

  it('pays flat XP to an unentitled learner even at b1', () => {
    expect(recordEvent('vocab', 'b1', 'correct')).toEqual({ xp: 10, mult: 1 });
  });

  it('pays the level multiplier to an entitled learner', () => {
    setLevelBoostEnabled(true);
    // base 10 × 1.5 = 15
    expect(recordEvent('vocab', 'b1', 'correct')).toEqual({ xp: 15, mult: 1.5 });
  });

  it('pays a1 the same either way, entitled or not', () => {
    setLevelBoostEnabled(true);
    expect(recordEvent('vocab', 'a1', 'correct')).toEqual({ xp: 10, mult: 1 });
  });

  it('composes with the streak multiplier rather than adding to it', () => {
    // A 7-day streak is ×1.5; b1 is ×1.5. Multiplicative → 2.25 (xp 23).
    // Additive (1.5 + 1.5 − 1 = 2.0) would give xp 20, so this fixture can
    // actually tell the two apart. A 3-day streak and a2 could not: 1.2 × 1.25
    // and 1.2 + 1.25 − 1 both round to the same XP.
    seedStreak(7);
    setLevelBoostEnabled(true);
    const { xp, mult } = recordEvent('vocab', 'b1', 'correct');
    expect(mult).toBeCloseTo(2.25);
    expect(xp).toBe(23);
  });

  it('falls back to ×1 for an unknown level rather than NaN', () => {
    setLevelBoostEnabled(true);
    expect(recordEvent('vocab', 'c2', 'correct')).toEqual({ xp: 10, mult: 1 });
  });
});
```

Add `setLevelBoostEnabled` to the file's imports (`import { setLevelBoostEnabled } from './xpEntitlement';`) and make sure `saveState`, `recordEvent` and `todayKey` are imported — check the file's existing import block rather than assuming.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/xpEntitlement.test.js src/lib/stats.test.js
```

Expected: FAIL — `Failed to resolve import "./xpEntitlement"`.

- [ ] **Step 3: Write the entitlement module**

Create `src/lib/xpEntitlement.js`:

```js
// Whether the current visitor earns the per-level XP multiplier — an account
// benefit, so guests earn flat XP.
//
// Module-level state rather than a parameter because recordEvent is called from
// eight sites across five components, none of which knows about auth; and
// rather than a field on `deutsch-app-state-v1`, because that blob syncs and an
// entitlement derived from the local session must not travel between devices.
// Same shape as setSoundEnabled in lib/sound.js.
//
// Defaults to false so a guest — and any test that forgets to opt in — gets
// flat XP rather than a silent bonus.
let enabled = false;

/** @param {boolean} on */
export function setLevelBoostEnabled(on) {
  enabled = !!on;
}

/** @returns {boolean} */
export function isLevelBoostEnabled() {
  return enabled;
}
```

- [ ] **Step 4: Add the multiplier table**

Append to `src/lib/gameConfig.js`:

```js
// XP multiplier by practice level — a harder level pays more for the same
// answer. Account holders only (see lib/xpEntitlement.js); composes
// multiplicatively with MULTIPLIER_TIERS above.
export const LEVEL_MULTIPLIERS = { a1: 1, a2: 1.25, b1: 1.5 };
```

- [ ] **Step 5: Fold it into recordEvent**

In `src/lib/stats.js`, extend the imports:

```js
import { DEFAULT_GOAL, XP_PER_VERDICT, LEVEL_MULTIPLIERS } from './gameConfig';
import { isLevelBoostEnabled } from './xpEntitlement';
```

and replace lines 242-244 inside `recordEvent`:

```js
    const streakMult = multiplier(streakLen);
    // Unknown level → ×1, never NaN: `level` reaches here straight from a
    // component prop.
    const levelMult = isLevelBoostEnabled() ? (LEVEL_MULTIPLIERS[level] ?? 1) : 1;
    const mult = streakMult * levelMult;
    const base = XP_PER_VERDICT[verdict] ?? 0;
    const bonus = Math.round(base * (mult - 1));
```

Nothing else in the function changes: `applyEvent` already takes `bonus`, storage shape is untouched, and the returned `{ xp: base + bonus, mult }` now carries the composed multiplier so the existing "+XP" flourish shows the larger number for free.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run src/lib/xpEntitlement.test.js src/lib/stats.test.js
```

Expected: PASS.

- [ ] **Step 7: Run the full suite**

```bash
npm test && npm run lint && npm run format:check
```

Expected: all green. If any pre-existing XP test fails, stop — the entitlement default is `false`, so no existing behaviour should have moved, and a failure means the composition changed a path it should not have.

- [ ] **Step 8: Commit**

```bash
git add src/lib/gameConfig.js src/lib/xpEntitlement.js src/lib/xpEntitlement.test.js src/lib/stats.js src/lib/stats.test.js
git commit -m "feat(xp): pay a per-level multiplier to account holders"
```

---

### Task 7: Turn the entitlement on for signed-in users, and show it

**Files:**
- Modify: `src/App.jsx` (call `setLevelBoostEnabled` on auth resolution)
- Modify: `src/components/StatsTab.jsx` (caption under the level picker)
- Test: `src/App.test.jsx`, `src/components/StatsTab.test.jsx`

**Interfaces:**
- Consumes: `setLevelBoostEnabled` and `isLevelBoostEnabled` from Task 6; the `authMock` harness added to `App.test.jsx` in Task 2.
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Write the failing tests**

Append to `src/App.test.jsx`, inside the `describe('entry gate', ...)` block from Task 2 (it already controls `authMock`):

```jsx
  it('enables the level XP boost for a signed-in user', () => {
    authMock.status = 'authenticated';
    authMock.mayHaveSession = true;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(isLevelBoostEnabled()).toBe(true);
  });

  it('leaves the boost off for a guest', async () => {
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    await userEvent.click(gate());
    expect(isLevelBoostEnabled()).toBe(false);
  });
```

Add `import { isLevelBoostEnabled, setLevelBoostEnabled } from './lib/xpEntitlement';` at the top of the file, and reset it in the block's `beforeEach` with `setLevelBoostEnabled(false)` — module state persists between tests in a file.

Append to `src/components/StatsTab.test.jsx`:

```jsx
  it('names the level XP bonus for an account holder', () => {
    setLevelBoostEnabled(true);
    render(<StatsTab level="b1" onLevelChange={() => {}} />);
    expect(screen.getByText(/×1\.5 XP per answer/)).toBeInTheDocument();
  });

  it('promises no bonus to a guest', () => {
    setLevelBoostEnabled(false);
    render(<StatsTab level="b1" onLevelChange={() => {}} />);
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });
```

Add `import { setLevelBoostEnabled } from '../lib/xpEntitlement';` and reset it to `false` in the file's `beforeEach`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/App.test.jsx src/components/StatsTab.test.jsx
```

Expected: FAIL — the boost is never enabled, and no caption renders.

- [ ] **Step 3: Set the entitlement in App**

In `src/App.jsx`, add `import { setLevelBoostEnabled } from './lib/xpEntitlement';`, then add an effect next to the other auth-driven effects (near line 399):

```js
  // The per-level XP multiplier is an account benefit. Driven off authStatus
  // rather than `user` so a sign-out turns it off in the same render.
  useEffect(() => {
    setLevelBoostEnabled(authStatus === 'authenticated');
  }, [authStatus]);
```

- [ ] **Step 4: Add the caption**

In `src/components/StatsTab.jsx`, add to the imports:

```jsx
import { isLevelBoostEnabled } from '../lib/xpEntitlement';
import { LEVEL_MULTIPLIERS } from '../lib/gameConfig';
```

and inside the Practice level `<div>` from Task 5, directly after `<LevelPicker … />`:

```jsx
                {isLevelBoostEnabled() && (
                  <div
                    style={{
                      marginTop: SPACE[3],
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.caps,
                      color: COLORS.mute,
                    }}
                  >
                    ×{LEVEL_MULTIPLIERS[level] ?? 1} XP per answer
                  </div>
                )}
```

A caption rather than a `detail` line inside the picker: `SegmentedPicker` renders `detail` in the display face at `FONT_SIZE.xl` across three columns, and "A1 · ×1.25" in that slot overflows at 320px.

Check `FONTS`, `FONT_SIZE` and `LETTER_SPACING` are in the file's existing theme import and add any that are missing.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/App.test.jsx src/components/StatsTab.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Verify end to end in a browser**

```bash
npm run dev
```

Signed in: Stats → Practice level → B1 shows "×1.5 XP per answer". Answer a Vocab card and confirm the "+XP" flourish reads 15 rather than 10. Sign out, and confirm both the caption disappears and a correct answer pays 10 again.

- [ ] **Step 7: Full suite, lint, commit**

```bash
npm test && npm run lint && npm run format:check
git add src/App.jsx src/App.test.jsx src/components/StatsTab.jsx src/components/StatsTab.test.jsx
git commit -m "feat(xp): enable the level boost for account holders and name it in settings"
```

---

## PR boundaries

| PR | Tasks | Title |
|---|---|---|
| A | 1–2 | `fix(entry): gate on account session and stop the entry screens inverting the theme` |
| B | 3–5 | `feat(level): change practice level from settings` |
| C | 6–7 | `feat(xp): per-level XP multiplier for account holders` |

**A and B must land together or B first.** Task 2 takes the level picker away from returning signed-in users; Task 5 is where they get it back. Merging A alone leaves an account holder with no way to change difficulty at all.

Branch from an up-to-date `main` per PR; never commit to `main` directly.

## Out of scope

- Re-pairing the splash's red stripe with an on-fill ink. `COLORS.red` is `var(--c-error)`, a semantic colour, and its text is currently `COLORS.paper`. Worth a look, but it is not the reported bug and it drags the accent-token rules in.
- Rebalancing weekly leagues for the multiplier skew — a B1 user now out-earns an A1 user doing identical work. Measure after real data exists.
- Per-level daily goals.
- Making the level part of the account rather than the device. `deutsch-level` is device-local; namespacing storage is Phase 4.
