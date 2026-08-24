# Entry Flow Simplification + Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the theme toggle reachable from the very first frame, remove the blocking "What's your level?" gate in favor of the level control that already exists in the header, and add a recurring Home dashboard as the landing tab on every app open.

**Architecture:** Three additive/subtractive changes to the existing entry flow, in dependency order: (1) `WelcomeGate` gains its own `ThemeChip` corner, (2) `SplashScreen` and its blocking state are deleted from `App.jsx` (nothing new replaces it — `readLevel()` already defaults to `'a1'`), (3) a new `HomeTab` component composes two already-existing widgets (`LevelCard`, `GoalRing`) and becomes the new first/default tab in `App.jsx`'s nav.

**Tech Stack:** React 18, Vitest + React Testing Library, inline styles with tokens from `src/lib/theme.js`.

**Spec:** `docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md`

## Global Constraints

- Styling: inline styles only, tokens from `src/lib/theme.js` (COLORS / FONTS / FONT_SIZE / SPACE / RADIUS / SHADOW) — never hardcode colors, radii, or shadows.
- Grid tracks: always `minmax(0, 1fr)`, never a bare `1fr` (AGENTS.md).
- Verify narrow viewports at 375px and 320px, and with a populated account.
- Never rename or migrate a storage key (`deutsch-level`, `deutsch-onboarded`, `deutsch-app-state-v1`) — AGENTS.md forbids it outside Phase 4.
- `npm test`, `npm run lint`, `npm run format:check` must all pass before any task is done.
- Don't bypass `.husky/pre-commit` — it reruns the full suite on every commit.
- No new "System"/"Tone"-style automatic-condition-exposed-as-a-toggle — `resolveThemeMode`'s system-preference fallback and `readLevel()`'s `'a1'` default both stay internal, never a selectable UI state.

---

### Task 1: Theme access on WelcomeGate

**Files:**
- Modify: `src/components/WelcomeGate.jsx`
- Test: `src/components/WelcomeGate.test.jsx`

**Interfaces:**
- Consumes: `ThemeChip` (`src/components/ThemeChip.jsx`) — default export, no props, self-contained (icon button + its own sheet).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Add to `src/components/WelcomeGate.test.jsx`, as a new `it` inside the existing `describe('WelcomeGate', ...)` block (after the `'opts into dynamic-viewport sizing'` test, before the closing `});` of the describe block):

```jsx
  // Theme access must exist from the very first frame the app can show — not
  // only after guest/account is chosen. See
  // docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §5.
  it('offers the theme toggle from the moment the entry screen renders', async () => {
    render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} />);
    const appearance = screen.getByRole('button', { name: /^appearance$/i });
    expect(appearance).toBeInTheDocument();
    await userEvent.click(appearance);
    expect(screen.getByRole('dialog', { name: /appearance/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/WelcomeGate.test.jsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name "/^appearance$/i"`.

- [ ] **Step 3: Add ThemeChip to WelcomeGate**

Replace the full contents of `src/components/WelcomeGate.jsx` with:

```jsx
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';
import Button from './ui/Button';
import GoogleButton from './auth/GoogleButton';
import ThemeChip from './ThemeChip';

/** Minimum comfortable touch target, px — the iOS Human Interface guideline. */
const TAP_TARGET_MIN = 44;

// Entry screen. The guest path is always available (anonymous-first);
// the account actions render only when auth is configured, so no environment
// ever shows a dead button. GoogleButton self-guards on its own flag, so it
// simply is not there until an owner turns Google on.
export default function WelcomeGate({ onGuest, onAuth, onGoogle, googleBusy = false }) {
  const authOn = isAuthConfigured();
  return (
    <div
      className="entry-screen"
      style={{
        position: 'relative',
        background: COLORS.paper,
        color: COLORS.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        fontFamily: FONTS.display,
        padding: 24,
      }}
    >
      {/* Theme access from the very first frame. This is the only screen that
          renders before the main app's own header (which already has
          ThemeChip) once the level-picker splash is gone, so it gets its own
          corner rather than a shared shell. */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeChip />
      </div>
      <div
        style={{ fontSize: 64, fontWeight: FONT_WEIGHT.black, letterSpacing: LETTER_SPACING.tight }}
      >
        Deutsch<span style={{ color: COLORS.red }}>.</span>
      </div>
      <p
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
        }}
      >
        Learn German with an AI tutor
      </p>
      {/* Inline styles can't express :focus-visible; a scoped rule gives the
          bare guest button a visible focus ring against the ground colour. */}
      <style>{`.welcome-guest:focus-visible { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; border-radius: 4px; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        {authOn && (
          <>
            <GoogleButton onClick={onGoogle} busy={googleBusy} />
            <Button onClick={() => onAuth('create')}>Create account</Button>
            <Button variant="secondary" onClick={() => onAuth('signin')}>
              Sign in
            </Button>
          </>
        )}
        <button
          className="welcome-guest"
          onClick={onGuest}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.ink,
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: SPACE[2],
            // Styled as a text link, but it is the front door to the whole
            // guest trial and the only way past this screen without an
            // account — and since the gate stopped being a once-per-device
            // event, every guest meets it on every visit. Padding alone left
            // it 29px tall on a phone, under the 44px minimum, and the
            // smallest target on the screen was the one most people reach for.
            // The underline still reads as a link; only the hit area grows.
            minHeight: TAP_TARGET_MIN,
          }}
        >
          Try it first — free →
        </button>
      </div>
    </div>
  );
}
```

(Only two changes from the current file: `import ThemeChip from './ThemeChip';` added, `position: 'relative'` added to the root style, and the new absolutely-positioned `<div>` wrapping `<ThemeChip />` inserted right after the opening `<div className="entry-screen" ...>` tag.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/WelcomeGate.test.jsx`
Expected: all tests PASS (the new one plus every pre-existing one in the file — the pre-existing `'offers no Google button while the flag is off'` test only checks presence of three specific named buttons, not a total count, so it is unaffected by the fourth button).

- [ ] **Step 5: Commit**

```bash
git add src/components/WelcomeGate.jsx src/components/WelcomeGate.test.jsx
git commit -m "Add theme access to WelcomeGate, before entry

Theme should be reachable from the moment the app can show anything,
not only after guest/account is chosen. WelcomeGate is the only
pre-entry screen (the level-picker splash is being removed next), so
it gets a ThemeChip corner directly rather than a shared shell."
```

---

### Task 2: Remove the blocking level-picker gate

**Files:**
- Delete: `src/components/SplashScreen.jsx`
- Delete: `src/components/SplashScreen.test.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

**Interfaces:**
- Consumes: `readLevel()` (`src/lib/levelPref.js`) — already defaults to `'a1'` when nothing is stored or storage is corrupt/blocked. No change to that module in this task.
- Produces: `App.jsx` with no `SplashScreen` import, no `showSplash` state, no `handleSplashComplete`, no `hasStoredLevel` import. Later tasks build on this cleaned-up file.

- [ ] **Step 1: Write the failing tests**

In `src/App.test.jsx`, inside `describe('entry gate', ...)`:

Replace this test (currently at lines 606-611):
```jsx
  it('shows the level picker after the guest continues', async () => {
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    await userEvent.click(gate());
    expect(levelPicker()).toBeInTheDocument();
  });
```
with:
```jsx
  it('lands in the app — no level picker — after the guest continues', async () => {
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    await userEvent.click(gate());
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
```

Replace this test (currently at lines 651-660):
```jsx
  it('shows the level picker to anyone who has never chosen a level', () => {
    authMock.configured = false;
    // The storage shim is one module-level instance shared by every test in
    // the file (see 'guest trial wall' above) — earlier tests in this very
    // describe set 'deutsch-level', so it must be cleared to exercise "never
    // chosen a level".
    localStorage.removeItem('deutsch-level');
    render(<App />);
    expect(levelPicker()).toBeInTheDocument();
  });
```
with:
```jsx
  it('defaults silently to a1 for anyone who has never chosen a level', () => {
    authMock.configured = false;
    // The storage shim is one module-level instance shared by every test in
    // the file (see 'guest trial wall' above) — earlier tests in this very
    // describe set 'deutsch-level', so it must be cleared to exercise "never
    // chosen a level".
    localStorage.removeItem('deutsch-level');
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /open status/i })
    ).toHaveTextContent('A1');
    // Never written until an explicit choice — the default is silent and in-memory.
    expect(localStorage.getItem('deutsch-level')).toBeNull();
  });
```

Replace this test (currently at lines 662-667):
```jsx
  it('asks for a level again when the stored one is corrupt', () => {
    authMock.configured = false; // no gate, so the splash is what renders
    localStorage.setItem('deutsch-level', 'c2');
    render(<App />);
    expect(screen.getByRole('button', { name: /Beginner \(A1\)/ })).toBeInTheDocument();
  });
```
with:
```jsx
  it('treats a corrupt stored level as a1 rather than asking again', () => {
    authMock.configured = false; // no gate, so the app shell is what renders
    localStorage.setItem('deutsch-level', 'c2');
    render(<App />);
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /open status/i })
    ).toHaveTextContent('A1');
  });
```

In the same describe block, find `'lets a signed-in user straight through to the app'` (currently lines 613-621) and delete just this one line from its body:
```jsx
    expect(levelPicker()).toBeNull();
```
(leave every other line in that test unchanged).

Find `'re-gates and drops the boost when a signed-in user signs out via the real control'` (currently lines 693-719). Change:
```jsx
    // Latch gateDismissed the way a real signed-in session does, then land
    // on the level picker and pick a level to reach the app shell.
    await user.click(gate());
    await user.click(levelPicker());
```
to:
```jsx
    // Latch gateDismissed the way a real signed-in session does, landing
    // directly on the app shell.
    await user.click(gate());
```

Delete the `levelPicker` helper itself (currently line 596, right above the tests it was used in):
```jsx
  const levelPicker = () => screen.queryByRole('button', { name: /Beginner \(A1\)/ });
```
(Every remaining use of `levelPicker()` in the file was in the four spots just edited above — confirm with `grep -n "levelPicker" src/App.test.jsx` that nothing else references it before deleting.)

Also update `renderPastEntry` and its preceding comment (currently lines 69-85):
```jsx
// Task 2 made the entry gate a function of account session rather than a
// device flag, and made the post-gate splash unconditional (continuing past
// the gate, guest or authenticated, always lands on the level picker once).
// Tests below this point that only care about the app shell — not the gate
// or splash themselves — render then walk through both screens once, exactly
// as a real guest would. `fireEvent` (not `userEvent`) because one call site
// runs under fake timers and a synchronous click avoids the delay-based
// interactions `userEvent` schedules internally. A no-op when the gate or
// splash never appeared (e.g. an authenticated or auth-unconfigured mock).
const renderPastEntry = (ui) => {
  const result = render(ui);
  const guestBtn = screen.queryByRole('button', { name: 'Try it first — free →' });
  if (guestBtn) fireEvent.click(guestBtn);
  const levelBtn = screen.queryByRole('button', { name: /Beginner \(A1\)/ });
  if (levelBtn) fireEvent.click(levelBtn);
  return result;
};
```
to:
```jsx
// The entry gate is a function of account session, not a device flag (see
// docs/superpowers/specs/2026-08-17-entry-flow-and-level-xp-design.md). There
// is no longer a level-picker screen behind it — see
// docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md
// §6 — so continuing past the gate lands directly on the app shell. Tests
// below this point that only care about the app shell — not the gate itself
// — render then dismiss the gate once, exactly as a real guest would.
// `fireEvent` (not `userEvent`) because one call site runs under fake timers
// and a synchronous click avoids the delay-based interactions `userEvent`
// schedules internally. A no-op when the gate never appeared (e.g. an
// authenticated or auth-unconfigured mock).
const renderPastEntry = (ui) => {
  const result = render(ui);
  const guestBtn = screen.queryByRole('button', { name: 'Try it first — free →' });
  if (guestBtn) fireEvent.click(guestBtn);
  return result;
};
```

- [ ] **Step 2: Run the changed tests to verify they fail correctly**

Run: `npx vitest run src/App.test.jsx -t "entry gate"`
Expected: FAIL. The three replaced tests fail because `SplashScreen` still renders (the app hasn't reached the app shell / `getByRole('navigation')` isn't found yet, or the header status chip isn't present). The two trimmed tests should still pass at this point (they only removed now-redundant assertions/clicks) — if either errors instead of passing, stop and investigate before continuing; don't proceed with a red step for the wrong reason.

- [ ] **Step 3: Delete SplashScreen and remove it from App.jsx**

```bash
git rm src/components/SplashScreen.jsx src/components/SplashScreen.test.jsx
```

In `src/App.jsx`:

Remove `hasStoredLevel` from the import (line 6):
```diff
-import { readLevel, writeLevel, hasStoredLevel, LEVEL_CHANGE_EVENT } from './lib/levelPref';
+import { readLevel, writeLevel, LEVEL_CHANGE_EVENT } from './lib/levelPref';
```

Remove the `SplashScreen` import (line 39):
```diff
-import SplashScreen from './components/SplashScreen';
 import WelcomeGate from './components/WelcomeGate';
```

Remove the `showSplash` state and its comment (lines 301-307 region — keep `gateDismissed`, delete only `showSplash`):
```diff
   // Dismissal is component state, not storage: the gate is a property of "is
   // there a session", so it comes back on the next load for anyone without one.
   const [gateDismissed, setGateDismissed] = useState(false);
-  // Seeded from `deutsch-level`, not from isAuthConfigured(): env-independent
-  // (spec F7), and it states the real precondition — someone who has never
-  // picked a level needs the picker however they arrived.
-  const [showSplash, setShowSplash] = useState(() => !hasStoredLevel());
   const [authModal, setAuthModal] = useState(null); // 'create' | 'signin' | null
```

Remove the `setShowSplash(true)` call from `handleGuest`:
```diff
   const handleGuest = () => {
     setGateDismissed(true);
-    setShowSplash(true);
   };
```

Remove the `setShowSplash(true)` call from `handleAuthDone` (keep the rest, including the `deutsch-onboarded` write — AGENTS.md forbids removing storage-key writes):
```diff
   const handleAuthDone = () => {
     setAuthModal(null);
     setGateDismissed(true);
-    setShowSplash(true);
     // Nothing reads this key any more; kept because AGENTS.md forbids removing
     // or migrating a storage key.
     localStorage.setItem('deutsch-onboarded', '1');
   };
```

Remove `handleSplashComplete` entirely:
```diff
   const [level, setLevel] = useState(readLevel);
   const sessionGuard = useSessionGuardValue();

-  const handleSplashComplete = (chosenLevel) => {
-    setLevel(chosenLevel);
-    setShowSplash(false);
-  };
-
   // `level` is held here and prop-drilled into every tab, ...
```

Remove the splash render branch entirely:
```diff
   if (showGate) {
     return (
       <>
         <WelcomeGate
           onGuest={handleGuest}
           onAuth={(intent) => setAuthModal(intent)}
           onGoogle={handleGoogle}
           googleBusy={googleBusy}
         />
         {authOverlay}
       </>
     );
   }

-  if (showSplash)
-    return (
-      <>
-        <SplashScreen onComplete={handleSplashComplete} />
-        {authOverlay}
-      </>
-    );
-
   return (
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS — every test in the file, including the whole `describe('entry gate', ...)` block and every other describe block (their `deutsch-level` fixtures already seed `hasStoredLevel()`-true state and were never exercising the splash path in the first place, per the trace in the design spec).

Run: `npx vitest run src/components/SplashScreen.test.jsx`
Expected: the file no longer exists — no error, nothing to run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove the blocking level-picker gate

SplashScreen was the only thing standing between WelcomeGate and the
app shell. readLevel() already defaults to a1 when nothing is stored,
and StatusChip's LevelSwitcher already covers changing it later —
nothing new needs to replace the gate, it just needs to go."
```

---

### Task 3: Build the Home dashboard tab

**Files:**
- Create: `src/components/HomeTab.jsx`
- Create: `src/components/HomeTab.test.jsx`

**Interfaces:**
- Consumes:
  - `LevelCard` (`src/components/gamification/LevelCard.jsx`) — props `{ lvl: { level, rankName, progress, xpIntoLevel, xpToNext }, totalXp, learnedCount }`.
  - `GoalRing` (`src/components/gamification/GoalRing.jsx`) — props `{ pct, met, size }`.
  - `StatBlock`, `Hero` (`src/components/UI.jsx`) — `StatBlock({ label, value, icon, accent, pulsing })`, `Hero({ kicker, title, sub })`.
- Produces: `HomeTab` default export, props `{ lvl, totalXp, learnedCount, goalPct, goalMet, streak }`. Task 4 renders it with these exact prop names.

- [ ] **Step 1: Write the failing test**

Create `src/components/HomeTab.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeTab from './HomeTab';

const lvl = { level: 3, rankName: 'Anfänger', progress: 0.4, xpIntoLevel: 60, xpToNext: 150 };

describe('HomeTab', () => {
  it('renders the level card and the streak/goal ring', () => {
    render(
      <HomeTab
        lvl={lvl}
        totalXp={300}
        learnedCount={12}
        goalPct={0.5}
        goalMet={false}
        streak={4}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Anfänger')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal · 50%')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  // Home is a quick glance, not a second Stats — the deep-dive widgets
  // (accuracy breakdown, heatmap, leaderboard, account) stay exclusive to
  // Stats. See docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §7.
  it('shows nothing beyond the progress snapshot', () => {
    render(
      <HomeTab lvl={lvl} totalXp={300} learnedCount={12} goalPct={0.5} goalMet={false} streak={4} />
    );
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/account/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/HomeTab.test.jsx`
Expected: FAIL — `Failed to resolve import "./HomeTab"` (the file doesn't exist yet).

- [ ] **Step 3: Write HomeTab**

Create `src/components/HomeTab.jsx`:

```jsx
import { Flame } from 'lucide-react';
import { SPACE } from '../lib/theme';
import { Hero, StatBlock } from './UI';
import LevelCard from './gamification/LevelCard';
import GoalRing from './gamification/GoalRing';

// Landing surface for every app open, guest or signed-in — a quick glance at
// standing progress. Deliberately NOT a second Stats tab: no accuracy
// breakdown, heatmap, leaderboard, or account section here. Those stay
// exclusive to Stats, which remains the deep dive. See
// docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §7.
export default function HomeTab({ lvl, totalXp, learnedCount, goalPct, goalMet, streak }) {
  return (
    <div>
      <Hero kicker="Section 01" title="Willkommen" sub="Your standing progress, at a glance." />
      <LevelCard lvl={lvl} totalXp={totalXp} learnedCount={learnedCount} />
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[5], marginTop: SPACE[6] }}>
        <GoalRing pct={goalPct} met={goalMet} size={72} />
        <StatBlock label="STREAK" value={streak} icon={<Flame size={16} />} accent />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/HomeTab.test.jsx`
Expected: PASS — both tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeTab.jsx src/components/HomeTab.test.jsx
git commit -m "Add HomeTab: LevelCard + GoalRing/streak, nothing else

Not yet wired into App.jsx's nav — that's the next task. Standalone
and testable on its own first."
```

---

### Task 4: Wire Home into the nav as the default landing tab

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

**Interfaces:**
- Consumes: `HomeTab` from Task 3, exact props `{ lvl, totalXp, learnedCount, goalPct, goalMet, streak }`.
- Produces: `App.jsx` with `tab` defaulting to `'home'`, `home` as the nav's first entry, and the header's `GoalRing` hidden specifically on the `home` tab.

- [ ] **Step 1: Write the failing tests**

In `src/App.test.jsx`:

Change `TAB_NAMES` (currently line 59):
```diff
-const TAB_NAMES = ['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];
+const TAB_NAMES = ['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];
```

In `describe('App navigation a11y', ...)`, replace `'marks only the active tab with aria-current'`:
```jsx
  it('marks only the active tab with aria-current', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });
```
with:
```jsx
  it('marks only the active tab with aria-current', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });
```

In `describe('header at mobile width', ...)`:

Change the `it.each` array for `'shows daily-goal progress on the %s tab on mobile'` (currently line 190):
```diff
-  it.each(['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'])(
+  it.each(['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'])(
     'shows daily-goal progress on the %s tab on mobile',
```

Replace `'keeps the goal ring in the header on desktop'`:
```jsx
  it('keeps the goal ring in the header on desktop', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.getByTitle(/Daily goal/)).toBeInTheDocument();
  });
```
with:
```jsx
  it('keeps the goal ring in the header on desktop', async () => {
    setViewportWidth(1280);
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Chat' }));
    const header = within(screen.getByRole('banner'));
    expect(header.getByTitle(/Daily goal/)).toBeInTheDocument();
  });

  // Home already shows its own, bigger GoalRing — the header's compact one
  // would be an exact duplicate sitting right above it.
  it('hides the header goal ring on the Home tab, where HomeTab already shows one', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.queryByTitle(/Daily goal/)).not.toBeInTheDocument();
  });
```

Replace `'leaves the strip off the chat tab on desktop, where the ring covers it'`:
```jsx
  it('leaves the strip off the chat tab on desktop, where the ring covers it', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    expect(goalStrip()).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTitle(/Daily goal/)).toBeInTheDocument();
  });
```
with:
```jsx
  it('leaves the strip off the chat tab on desktop, where the ring covers it', async () => {
    setViewportWidth(1280);
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Chat' }));
    expect(goalStrip()).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTitle(/Daily goal/)).toBeInTheDocument();
  });
```

In `describe('guest trial wall', ...)`, add one line to the end of the `renderApp` helper (currently lines 396-426):
```diff
     const { default: AppWithAuth } = await import('./App.jsx');
     setViewportWidth(1280);
     renderPastEntry(<AppWithAuth />);
+    // Home is the landing tab now and is never walled — land on a practice
+    // tab first, exactly as every test below originally assumed when Chat
+    // was the default landing tab.
+    await userEvent.click(
+      within(screen.getByRole('navigation')).getByRole('button', { name: 'Chat' })
+    );
   }
```

Add a new test right after `'never walls the Stats tab — it is the escape hatch'` (currently ends at line 452):
```jsx
  it('never walls the Home tab — it is the new landing surface', async () => {
    await renderApp();
    // renderApp already navigated to Chat (walled); step back to Home.
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Home' })
    );
    expect(wall()).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail correctly**

Run: `npx vitest run src/App.test.jsx`

Not every edited test goes red here — some are defensive rewrites of already-correct behavior (e.g. `renderApp` now clicks "Chat" explicitly instead of relying on it being the default tab, which is currently still true, so those pass unchanged). The ones that must fail, because they assert behavior that doesn't exist yet:
- Anything depending on a `'Home'` nav button existing (`TAB_NAMES`-driven tests, the `it.each` list, `'marks only the active tab with aria-current'`, the new `'never walls the Home tab'` test) — fails with "unable to find role button name Home".
- `'hides the header goal ring on the Home tab...'` — fails because the ring is still unconditional on tab, so it's found when the test asserts it should be absent.

If a test you didn't expect to change also goes red, stop and understand why before continuing — don't patch a failure you haven't diagnosed.

- [ ] **Step 3: Wire Home into App.jsx**

In `src/App.jsx`:

Add `Home` to the lucide-react import (line 2):
```diff
-import { BarChart3, Flame, BookOpen, MessageSquare, Type, Languages } from 'lucide-react';
+import { BarChart3, Flame, BookOpen, MessageSquare, Type, Languages, Home } from 'lucide-react';
```

Add the `HomeTab` import, right before the `ChatTab` import:
```diff
 import { StatBlock } from './components/UI';
+import HomeTab from './components/HomeTab';
 import ChatTab from './components/ChatTab';
```

Change the default tab:
```diff
-  const [tab, setTab] = useState('chat');
+  const [tab, setTab] = useState('home');
```

Prepend `home` to the `tabs` array and renumber the rest:
```diff
   const tabs = [
-    { id: 'chat', label: 'Chat', icon: MessageSquare, num: '01' },
-    { id: 'alphabet', label: 'Alphabet', icon: Type, num: '02' },
-    { id: 'vocab', label: 'Vocab', icon: BookOpen, num: '03' },
-    { id: 'translate', label: 'Translate', icon: Languages, num: '04' },
-    { id: 'stats', label: 'Stats', icon: BarChart3, num: '05' },
+    { id: 'home', label: 'Home', icon: Home, num: '01' },
+    { id: 'chat', label: 'Chat', icon: MessageSquare, num: '02' },
+    { id: 'alphabet', label: 'Alphabet', icon: Type, num: '03' },
+    { id: 'vocab', label: 'Vocab', icon: BookOpen, num: '04' },
+    { id: 'translate', label: 'Translate', icon: Languages, num: '05' },
+    { id: 'stats', label: 'Stats', icon: BarChart3, num: '06' },
   ];
```

Hide the header `GoalRing` on the `home` tab:
```diff
-            {width >= bp.wide && <GoalRing pct={game.goal.pct} met={game.goal.met} size={48} />}
+            {width >= bp.wide && tab !== 'home' && (
+              <GoalRing pct={game.goal.pct} met={game.goal.met} size={48} />
+            )}
```

Render `HomeTab` on the `home` tab. Add this block in `<main>`, right after the `GoalStrip` conditional and before the `{TABS.includes(tab) && (...)}` practice-tabs block:
```diff
           {(mobile || tab === 'translate' || tab === 'vocab') && (
             <GoalStrip
               streak={game.streak}
               current={game.goal.current}
               target={game.goal.target}
               mult={game.mult}
             />
           )}
+          {tab === 'home' && (
+            <HomeTab
+              lvl={game.lvl}
+              totalXp={totalXp(liveState.daily ?? {})}
+              learnedCount={stats.learnedCount ?? 0}
+              goalPct={game.goal.pct}
+              goalMet={game.goal.met}
+              streak={game.streak}
+            />
+          )}
           {/* The four practice tabs share one positioned wrapper so the trial
             wall can scrim THEM and nothing else. A position: fixed modal would
             take the header and nav with it, and the wall is explicitly not
             allowed to: Stats and settings stay reachable while it is up. */}
           {TABS.includes(tab) && (
```

(`totalXp` is already imported at the top of `App.jsx` from `./lib/gamification`; `liveState` is already computed earlier in the render body at `const liveState = loadState() ?? {};` — no new imports or derived state needed. `home` is deliberately not added to the `TABS` constant imported from `lib/stats.js`, so it stays excluded from the trial wall and per-tab accuracy exactly the way `stats` already is.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS — every test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "Add Home as the default landing tab

Composes App.jsx's existing game/stats state into HomeTab. The header
GoalRing hides on the Home tab specifically, since HomeTab already
shows a bigger one — otherwise it would be an exact duplicate."
```

---

### Task 5: Full verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: every test file passes, no unexpected drop in total test count beyond the one deleted file (`SplashScreen.test.jsx`, 8 tests removed) offset by the new ones added in Tasks 1–4.

- [ ] **Step 2: Lint and format**

Run: `npm run lint`
Expected: clean.

Run: `npm run format:check`
Expected: clean. If not, run `npx prettier --write <flagged files>` and re-check.

- [ ] **Step 3: Manual browser verification**

Start the dev server (`streak-demo` config in `.claude/launch.json`, port 5290) and check, in order:

1. Load the app fresh (clear localStorage first). WelcomeGate renders with an "Appearance" icon button in its top-right corner; clicking it opens the Light/Dark sheet, and picking Dark flips the WelcomeGate itself.
2. Click "Try it first — free →". The app renders directly on the **Home** tab — no level-picker screen. `StatusChip` in the header reads **A1**.
3. Open `StatusChip` and switch to B1. Confirm the switch applies with no confirmation prompt (no practice session is in flight yet).
4. At desktop width (≥ `bp.wide`, e.g. 1280px), confirm the header's compact `GoalRing` is **absent** while on Home, and Home's own larger ring is visible. Click into Chat — confirm the header ring **reappears**.
5. Resize to 320px and 390px. Confirm the six-item nav (`Home`, `Chat`, `Alphabet`, `Vocab`, `Translate`, `Stats`) still renders icon-only with no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`, checked via `read_page`/`javascript_tool` or a screenshot).
6. As a guest, exhaust the trial (or seed `deutsch-app-state-v1` accordingly) and confirm the wall appears on Chat/Alphabet/Vocab/Translate but **not** on Home or Stats.

- [ ] **Step 4: Final commit (if manual verification required fixes)**

Only if Step 3 surfaced an issue requiring a code change — otherwise Task 4's commit is the last one and this step is a no-op.
