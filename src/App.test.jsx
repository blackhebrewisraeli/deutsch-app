import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { todayKey } from './lib/stats';
import { isLevelBoostEnabled, setLevelBoostEnabled } from './lib/xpEntitlement';
import { TUTORIAL_KEY } from './lib/tutorialPref';
import { THEME_MODE_KEY } from './lib/themeMode';
import { loadState, thawPersist } from './lib/storage';
import { activePack } from './packs';

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));

// Lets the App-level tests drive a real deck generation without a network call.
const callClaude = vi.hoisted(() => vi.fn());
vi.mock('./lib/claude', () => ({ callClaude }));

/**
 * Mark the first-run walkthrough as already seen.
 *
 * Every block in this file except the walkthrough's own renders the app as a
 * RETURNING learner, which is what they always implicitly assumed — before the
 * tour existed there was nothing on top of the shell. Without this the tour's
 * scrim and its "Skip tutorial" button sit over each of them, and its button
 * collides with Translate's own SKIP.
 */
const asReturningLearner = () => localStorage.setItem(TUTORIAL_KEY, 'true');

beforeEach(asReturningLearner);

const authMock = vi.hoisted(() => ({
  configured: true,
  status: 'anonymous',
  mayHaveSession: false,
  // Null matches the real module's behaviour with no Supabase configured, so
  // every existing test is unaffected; the account-lane tests set a token.
  token: null,
}));

// Spread the real module: App imports six names from it and StatsTab,
// WelcomeGate and GoogleButton import more. A bare factory breaks them.
// Mocked rather than inherited because isAuthConfigured() reads
// import.meta.env.VITE_SUPABASE_*, which Vitest loads from .env — true on a
// developer's machine, false in CI. See spec F7.
const authSignOutMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));

vi.mock('./lib/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  isAuthConfigured: () => authMock.configured,
  isGoogleAuthConfigured: () => false,
  mayHaveSession: () => authMock.mayHaveSession,
  signOut: authSignOutMock,
  getAccessToken: () => Promise.resolve(authMock.token),
  useAuth: () => ({
    session: null,
    user: authMock.status === 'authenticated' ? { id: 'u1', email: 'a@b.co' } : null,
    status: authMock.status,
  }),
}));

// The league standing is a network read, so App tests inject it directly. It is
// mutable and hoisted for the same reason syncMock is: the interesting case is
// the one that only happens in production (signed in, leagues on, at risk), and
// a test that cannot reach it cannot fail when the wiring regresses.
const leagueStandingMock = vi.hoisted(() => ({ value: null, calls: [] }));

vi.mock('./lib/useLeagueStanding', () => ({
  useLeagueStanding: (userId) => {
    leagueStandingMock.calls.push(userId);
    return leagueStandingMock.value;
  },
}));

// VITE_SYNC_ENABLED is false on a developer's machine AND false in CI, but
// true in production — so before this mock existed the enabled half of both
// sync effects in App had never run in a test. `SYNC_ENABLED` is a getter, not
// a value: App reads it inside an effect body, which compiles to a property
// access on the module namespace, so a getter lets a single test flip the flag
// that ships without re-importing App.
const syncMock = vi.hoisted(() => ({
  enabled: false,
  start: vi.fn(),
  stop: vi.fn(),
  markDirty: vi.fn(),
}));

vi.mock('./lib/sync', async (importOriginal) => ({
  ...(await importOriginal()),
  get SYNC_ENABLED() {
    return syncMock.enabled;
  },
  start: syncMock.start,
  stop: syncMock.stop,
  markDirty: syncMock.markDirty,
}));

const TAB_NAMES = ['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

// The entry gate is a function of account session, not a device flag (see
// docs/superpowers/specs/2026-08-17-entry-flow-and-level-xp-design.md). There
// is no longer a level-picker screen behind it — see
// docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md
// §6 — so continuing past the gate lands directly on the app shell. Tests
// below this point that only care about the app shell — not the gate itself
// — render then dismiss the gate once, exactly as a real guest would.
// `fireEvent` (not `userEvent`) for a synchronous click that avoids the
// delay-based interactions `userEvent` schedules internally. A no-op when the
// gate never appeared (e.g. an
// authenticated or auth-unconfigured mock).
const renderPastEntry = (ui) => {
  const result = render(ui);
  const guestBtn = screen.queryByRole('button', { name: 'Try it first — free →' });
  if (guestBtn) fireEvent.click(guestBtn);
  return result;
};

/** Seed ~14 qualifying days so streak + freeze chip both render. */
function seedPopulatedAccount() {
  const qual = { byLevel: { a1: { correct: 6, almost: 0, wrong: 0 } } };
  const daily = {};
  const today = todayKey();
  const [y, m, d] = today.split('-').map(Number);
  for (let i = 14; i >= 1; i -= 1) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - i);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    daily[`${dt.getUTCFullYear()}-${mm}-${dd}`] = qual;
  }
  localStorage.setItem(
    'deutsch-app-state-v1',
    JSON.stringify({ daily, gamification: { goal: 50 }, stats: { streak: 0, learnedCount: 40 } })
  );
}

describe('App navigation a11y', () => {
  beforeEach(() => {
    // jsdom has no scrollIntoView (ChatTab auto-scrolls on mount)
    Element.prototype.scrollIntoView = vi.fn();
    // Skip the onboarding splash so the main shell renders
    localStorage.setItem('deutsch-level', 'a1');
  });

  it('desktop nav exposes an accessible name for every tab', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      expect(nav.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('mobile icon-only nav buttons keep their accessible names', () => {
    setViewportWidth(375);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      const button = nav.getByRole('button', { name });
      expect(button).toBeInTheDocument();
      // Icon-only on mobile: the name must come from aria-label, not text
      expect(button).toHaveAttribute('aria-label', name);
    }
  });

  it('marks only the active tab with aria-current', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });

  it('renders HomeTab content on the default landing tab', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    expect(screen.getByRole('heading', { name: 'Willkommen' })).toBeInTheDocument();
  });

  // The labelled nav needs 809px (measured: six labels + the 01-06 prefixes +
  // padding + gaps), but labels used to switch on at `mobile` = 640. In that
  // 640-809 band every button is forced to an equal flex share — 105px at
  // 700px — while "Translate" alone wants 149px, so the label overflowed its
  // button and ran into the neighbour's.
  //
  // No overflow assertion catches this: the buttons carry minWidth: 0, so the
  // nav never grows and never scrolls sideways — it just renders text on top
  // of text. (A jsdom scrollWidth check would be worse than useless here;
  // jsdom reports 0 for every element, so it could not fail. The width itself
  // is verified in a real browser.) The honest assertion is what the button
  // renders: an icon-only button has no text of its own.
  it('renders the nav icon-only below the width where labels fit', () => {
    setViewportWidth(700);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      const button = nav.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-label', name);
      // Icon-only: the accessible name comes from aria-label, never from text
      // the button paints. Asserted as "does not contain the label" rather
      // than "has no text at all" because the Stats button also carries the
      // attention badge, which is legitimately text.
      expect(button.textContent).not.toContain(name);
      expect(button.querySelector('svg')).toBeInTheDocument();
    }
  });

  // Positive control for the test above: without this, simply never rendering
  // labels at any width would pass it.
  it('restores the nav labels once there is room for them', () => {
    setViewportWidth(900);
    renderPastEntry(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Translate' })).toHaveTextContent('Translate');
  });
});

// The header held logo + level badge + streak + goal ring + account chip,
// which measured 389px on a 375px phone — a horizontal scroll on every tab.
// The ring is dropped on mobile, so the goal strip has to cover every tab
// there: otherwise Chat, Alphabet and Stats lose the daily-goal signal
// entirely rather than merely relocating it.
describe('header at mobile width', () => {
  const goalStrip = () =>
    // GoalStrip renders "{current} / {target} XP" across several text nodes
    screen.queryByText((_, el) => /^\d+ \/ \d+ XP$/.test((el?.textContent ?? '').trim()), {
      selector: 'div',
    });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.setItem('deutsch-level', 'a1');
  });

  // The masthead is the flag's black stripe carried into the app frame, so it
  // must NOT follow the page ground. This is the PR #116 bug class: pairing a
  // brand surface with a theme token made the splash's black stripe invert to
  // parchment in light mode. Nothing else catches it — the header still looks
  // like a header either way, and the contrast audit passes on both.
  it('paints the masthead from the flag black tier, not the page ground', () => {
    setViewportWidth(1280);
    const { container } = renderPastEntry(<App />);
    const style = container.querySelector('header').getAttribute('style') ?? '';
    expect(style).toMatch(/background:\s*var\(--c-accent-black\)/);
    expect(style, 'masthead must not follow the page ground').not.toMatch(
      /background:\s*var\(--c-ground\)/
    );
  });

  it('drops the goal ring from the header on mobile', () => {
    setViewportWidth(375);
    renderPastEntry(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.queryByTitle(/Daily goal/)).not.toBeInTheDocument();
  });

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

  // Home is deliberately excluded here — it shows its own GoalRing/streak
  // widgets instead of GoalStrip, on every viewport, covered by
  // 'renders HomeTab content on the default landing tab' below.
  it.each(['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'])(
    'shows daily-goal progress on the %s tab on mobile',
    async (tabName) => {
      setViewportWidth(375);
      const user = userEvent.setup();
      renderPastEntry(<App />);
      await user.click(
        within(screen.getByRole('navigation')).getByRole('button', { name: tabName })
      );
      expect(goalStrip()).toBeInTheDocument();
    }
  );

  // At 320px (original iPhone SE) the cluster still overflowed by 25px after the
  // ring came out. Nothing else in the header is expendable — the streak block
  // carries the "streak at risk" pulse, which GoalStrip has no equivalent for —
  // so the decorative wordmark scales with the viewport and the chrome tightens,
  // leaving every functional widget in place.
  it('scales the wordmark with the viewport on mobile and tightens the chrome', () => {
    // 480 is inside mobile (< bp.mobile) but past bp.tiny, so the wordmark
    // is present and still viewport-scaled.
    setViewportWidth(480);
    renderPastEntry(<App />);
    const header = screen.getByRole('banner');
    expect(header.style.padding).toBe('12px 10px');
    const wordmark = within(header)
      .getByText(/Deutsch/)
      .closest('div');
    expect(wordmark.style.fontSize).toBe('min(26px, 6.5vw)');
  });

  // The streak block was 111px of the 230px cluster, most of it the caption.
  // Dropping just the caption keeps the flame, the count and the at-risk pulse
  // — the signal GoalStrip does not replicate — while freeing ~70px.
  it('omits the STREAK caption on mobile', () => {
    setViewportWidth(375);
    renderPastEntry(<App />);
    expect(within(screen.getByRole('banner')).queryByText('STREAK')).not.toBeInTheDocument();
  });

  it('keeps the STREAK caption on desktop', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    expect(within(screen.getByRole('banner')).getByText('STREAK')).toBeInTheDocument();
  });

  // Below 360px even the scaled wordmark cannot coexist with the widgets: a
  // real year-long streak renders level 30 + "365" + a freeze chip + SIGN IN,
  // which measured 34px past a 320px viewport. Every one of those is the only
  // surface for its signal — the freeze count appears nowhere else in the app —
  // so the wordmark, the one decorative item, is dropped instead.
  it('drops the wordmark below 360px', () => {
    setViewportWidth(320);
    renderPastEntry(<App />);
    expect(within(screen.getByRole('banner')).queryByText(/Deutsch/)).not.toBeInTheDocument();
  });

  // The wordmark is decoration and yields to the functional cluster, which grew
  // a ThemeChip. It is hidden across the common phone range and returns at
  // bp.tiny (414), where the header measurably fits again.
  it('hides the wordmark across the phone range and restores it at bp.tiny', () => {
    setViewportWidth(390);
    const { unmount } = renderPastEntry(<App />);
    expect(within(screen.getByRole('banner')).queryByText(/Deutsch/)).toBeNull();
    unmount();

    setViewportWidth(414);
    renderPastEntry(<App />);
    expect(within(screen.getByRole('banner')).getByText(/Deutsch/)).toBeInTheDocument();
  });

  it('keeps the full-size wordmark and chrome on desktop', () => {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    const header = screen.getByRole('banner');
    expect(header.style.padding).toBe('20px 32px');
    const wordmark = within(header)
      .getByText(/Deutsch/)
      .closest('div');
    expect(wordmark.style.fontSize).toBe('36px');
  });

  // On desktop the header ring carries the signal, so the strip stays scoped to
  // the two practice tabs it was built for.
  it('leaves the strip off the chat tab on desktop, where the ring covers it', async () => {
    setViewportWidth(1280);
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Chat' }));
    expect(goalStrip()).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTitle(/Daily goal/)).toBeInTheDocument();
  });

  it('exposes Appearance from the header ThemeChip on every viewport', () => {
    setViewportWidth(390);
    renderPastEntry(<App />);
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /^appearance$/i })
    ).toBeInTheDocument();
  });

  it.each([320, 390, 1280])(
    'keeps the populated header (with freeze chip) within %ipx without horizontal overflow',
    (width) => {
      setViewportWidth(width);
      seedPopulatedAccount();
      renderPastEntry(<App />);
      const header = screen.getByRole('banner');
      expect(within(header).getByTitle(/streak freeze/i)).toBeInTheDocument();
      expect(within(header).getByRole('button', { name: /^appearance$/i })).toBeInTheDocument();
      // jsdom layout is approximate; still catch a cluster that refuses to shrink.
      expect(header.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
    }
  );

  it('no longer offers Appearance inside Stats (header is the single control)', async () => {
    setViewportWidth(1280);
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Stats' }));
    expect(screen.queryByText(/^Appearance$/i)).not.toBeInTheDocument();
  });
});

// Mid-app sign-in used to re-open WelcomeGate (the gate was the only auth-modal
// host). AuthSheet is now shared — signing in from Stats must not flash the gate.
describe('in-app AuthSheet', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.setItem('deutsch-level', 'a1');
    vi.resetModules();
  });

  it('opens from Stats without resurfacing the WelcomeGate', async () => {
    vi.doMock('./lib/auth.js', () => ({
      isAuthConfigured: () => true,
      isGoogleAuthConfigured: () => false,
      signInWithGoogle: vi.fn(() => Promise.resolve({ error: null })),
      humanAuthError: () => 'Something went wrong — try again.',
      useAuth: () => ({ user: null, session: null, status: 'anonymous' }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getAccessToken: vi.fn(() => Promise.resolve(null)),
      signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
      verifyCode: vi.fn(() => Promise.resolve({ error: null })),
      mayHaveSession: () => false,
      authCallbackKind: () => null,
      authCallbackReason: () => null,
      getSupabase: () => Promise.resolve(null),
    }));

    const { default: AppWithAuth } = await import('./App.jsx');
    setViewportWidth(1280);
    const user = userEvent.setup();
    renderPastEntry(<AppWithAuth />);

    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Stats' }));
    await user.click(screen.getByRole('button', { name: /sign in to sync/i }));

    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email me a sign-in code/i })).toBeInTheDocument();
    // Gate brand lives on the dark full-screen WelcomeGate — must stay gone.
    expect(screen.queryByText(/Learn German with an AI tutor/i)).not.toBeInTheDocument();
  });
});

// The guest trial is bounded: once it is spent, earning new progress is walled
// but everything else stays reachable. Five conditions gate the wall and each
// one has a failure mode worth pinning — a dead affordance with no auth
// behind it (PR #79), a wall over a signed-in user, a wall over the Stats tab
// the user is being told to go to, or a wall stamped over a live celebration.
describe('guest trial wall', () => {
  // Four tabs sampled and 60 XP on a 50 XP goal — both halves of the designed
  // peak, so trialStatus reports exhausted.
  const EXHAUSTED = {
    daily: {
      [todayKey()]: {
        total: 8,
        byTab: { chat: 2, alphabet: 2, vocab: 2, translate: 2 },
        byLevel: { a1: { correct: 6, almost: 0, wrong: 0 } },
      },
    },
    gamification: { goal: 50 },
  };
  // One tab, well under the cap, goal not met — trial still running.
  const FRESH = {
    daily: {
      [todayKey()]: {
        total: 2,
        byTab: { chat: 2 },
        byLevel: { a1: { correct: 1, almost: 0, wrong: 0 } },
      },
    },
    gamification: { goal: 50 },
  };

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    // The storage shim is one module-level instance shared by every test in
    // the file — clear it so a seeded account from an earlier block cannot
    // decide whether the trial is exhausted here.
    localStorage.clear();
    asReturningLearner();
    localStorage.setItem('deutsch-level', 'a1');
    vi.resetModules();
  });

  let signInWithGoogle;

  async function renderApp({
    configured = true,
    status = 'anonymous',
    state = EXHAUSTED,
    googleOn = false,
  } = {}) {
    localStorage.setItem('deutsch-app-state-v1', JSON.stringify(state));
    signInWithGoogle = vi.fn(() => Promise.resolve({ error: null }));
    vi.doMock('./lib/auth.js', () => ({
      isAuthConfigured: () => configured,
      isGoogleAuthConfigured: () => googleOn,
      signInWithGoogle,
      humanAuthError: () => 'Something went wrong — try again.',
      useAuth: () => ({
        user: status === 'authenticated' ? { id: 'u1', email: 'a@b.co' } : null,
        session: null,
        status,
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getAccessToken: vi.fn(() => Promise.resolve(null)),
      signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
      verifyCode: vi.fn(() => Promise.resolve({ error: null })),
      mayHaveSession: () => false,
      authCallbackKind: () => null,
      authCallbackReason: () => null,
      getSupabase: () => Promise.resolve(null),
    }));
    const { default: AppWithAuth } = await import('./App.jsx');
    setViewportWidth(1280);
    renderPastEntry(<AppWithAuth />);
    // Home is the landing tab now and is never walled — land on a practice
    // tab first, exactly as every test below originally assumed when Chat
    // was the default landing tab.
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Chat' })
    );
  }

  const wall = () => screen.queryByRole('dialog', { name: 'Save your progress' });
  const goToTab = (user, name) =>
    user.click(within(screen.getByRole('navigation')).getByRole('button', { name }));

  it('walls the practice surface for an exhausted anonymous guest', async () => {
    await renderApp();
    expect(wall()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a free account' })).toBeInTheDocument();
  });

  it('follows the guest across all four practice tabs', async () => {
    const user = userEvent.setup();
    await renderApp();
    for (const name of ['Alphabet', 'Vocab', 'Translate', 'Chat']) {
      await goToTab(user, name);
      expect(wall()).toBeInTheDocument();
    }
  });

  it('never walls the Stats tab — it is the escape hatch', async () => {
    const user = userEvent.setup();
    await renderApp();
    await goToTab(user, 'Stats');
    expect(wall()).not.toBeInTheDocument();
  });

  it('never walls the Home tab — it is the new landing surface', async () => {
    await renderApp();
    // renderApp already navigated to Chat (walled); step back to Home.
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Home' })
    );
    expect(wall()).not.toBeInTheDocument();
  });

  it('leaves the nav operable while the wall is up', async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(wall()).toBeInTheDocument();
    // Reaching Stats from behind the wall is the whole point of scrimming the
    // practice surface instead of the viewport.
    await goToTab(user, 'Stats');
    expect(wall()).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /^appearance$/i })
    ).toBeInTheDocument();
  });

  it('never walls a signed-in user', async () => {
    await renderApp({ status: 'authenticated' });
    expect(wall()).not.toBeInTheDocument();
  });

  it('does not flash the wall while the session is still loading', async () => {
    await renderApp({ status: 'loading' });
    expect(wall()).not.toBeInTheDocument();
  });

  it('stays away when auth is unconfigured — no dead affordance', async () => {
    await renderApp({ configured: false });
    expect(wall()).not.toBeInTheDocument();
  });

  it('stays away while the trial still has room', async () => {
    await renderApp({ state: FRESH });
    expect(wall()).not.toBeInTheDocument();
  });

  it('opens the shared AuthSheet from the primary CTA without resurfacing the gate', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'Create a free account' }));

    expect(screen.getByRole('dialog', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email me a sign-in code/i })).toBeInTheDocument();
    // Gate brand lives on the dark full-screen WelcomeGate — must stay gone.
    expect(screen.queryByText(/Learn German with an AI tutor/i)).not.toBeInTheDocument();
  });

  it('opens the sign-in intent from the secondary CTA', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(screen.getByRole('dialog', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Learn German with an AI tutor/i)).not.toBeInTheDocument();
  });

  // Clause 5, the subtle one. The designed peak fires on the very round that
  // completes the first daily goal — the same round that pushes the
  // "Tagesziel erreicht!" toast and the confetti burst. The wall must wait for
  // the celebration to finish rather than stamping itself over it.
  it('waits for a running celebration to finish before it appears', async () => {
    // All four tabs sampled but only 40 XP against a 50 XP goal: one half of
    // the peak met, so the trial is still running.
    await renderApp({
      state: {
        daily: {
          [todayKey()]: {
            total: 8,
            byTab: { chat: 2, alphabet: 2, vocab: 2, translate: 2 },
            byLevel: { a1: { correct: 4, almost: 0, wrong: 0 } },
          },
        },
        gamification: { goal: 50 },
      },
    });
    expect(wall()).not.toBeInTheDocument();

    // Fake timers activate only now — renderApp's own Chat-tab click (added
    // for the Home-landing-tab change) needs real timers to resolve; the
    // click's internal delay is a real setTimeout that fake time never
    // advances, so starting fake timers before renderApp() hangs it forever.
    // Only the celebration-timing assertions below need deterministic time.
    vi.useFakeTimers();
    try {
      // The round that tips the day over the goal. Preserve the gamification
      // block App just wrote so this reads as one more round, not a reset.
      const cur = JSON.parse(localStorage.getItem('deutsch-app-state-v1'));
      cur.daily[todayKey()].total = 9;
      cur.daily[todayKey()].byLevel.a1.correct = 6;
      localStorage.setItem('deutsch-app-state-v1', JSON.stringify(cur));

      act(() => {
        window.dispatchEvent(new Event('deutsch:progress'));
      });

      // Trial is now exhausted, but the celebration owns the screen.
      expect(screen.getByText('Tagesziel erreicht!')).toBeInTheDocument();
      expect(wall()).not.toBeInTheDocument();

      // Burst clears at 1600ms, the toast at 3200ms — then the wall lands,
      // before the next round can start.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Tagesziel erreicht!')).not.toBeInTheDocument();
      expect(wall()).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // The wall's Google button must reach the real signInWithGoogle through
  // App's single handler — not a second sign-in path bolted onto the wall.
  it('starts the Google flow from the wall when the flag is on', async () => {
    const user = userEvent.setup();
    await renderApp({ googleOn: true });
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows no Google button on the wall when the flag is off', async () => {
    await renderApp();
    expect(wall()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  // A redirect takes a beat and the page is on its way out; a second tap must
  // not start a second round trip.
  it('does not start a second flow on a double tap', async () => {
    const user = userEvent.setup();
    await renderApp({ googleOn: true });
    const button = screen.getByRole('button', { name: 'Continue with Google' });
    await user.click(button);
    await user.click(button);
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('entry gate', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    authMock.configured = true;
    authMock.status = 'anonymous';
    authMock.mayHaveSession = false;
    setViewportWidth(1280);
    setLevelBoostEnabled(false);
    authSignOutMock.mockClear();
  });

  const gate = () => screen.queryByRole('button', { name: 'Try it first — free →' });

  it('shows the gate to a guest who has already onboarded once', () => {
    // The whole point of the change: a device flag must not hide the gate.
    localStorage.setItem('deutsch-onboarded', '1');
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeInTheDocument();
  });

  it('lands in the app — no level picker — after the guest continues', async () => {
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    await userEvent.click(gate());
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('lets a signed-in user straight through to the app', () => {
    authMock.status = 'authenticated';
    authMock.mayHaveSession = true;
    localStorage.setItem('deutsch-level', 'a1');
    render(<App />);
    expect(gate()).toBeNull();
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

  it('treats a corrupt stored level as a1 rather than asking again', () => {
    authMock.configured = false; // no gate, so the app shell is what renders
    localStorage.setItem('deutsch-level', 'c2');
    render(<App />);
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /open status/i })
    ).toHaveTextContent('A1');
  });

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

  // Pins the `gateDismissed` latch reset in App.jsx's onSignOut handlers.
  // The latch is component state set by handleGuest/handleAuthDone — those
  // are the only ways it becomes true — so this test drives the real path:
  // dismiss the gate (as a signed-in user's callback would), then click the
  // actual "Sign out" control AccountSection renders, then flip the mocked
  // auth status the way a real sign-out event would. An earlier version of
  // this test only flipped authMock.status without ever setting the latch
  // or clicking a real control, so it passed identically whether or not the
  // reset existed — it could not fail against the unfixed code.
  //
  // Hard navigation is stubbed: jsdom cannot leave the document. Production
  // sets window.location.href = '/' then window.location.reload() in a
  // finally after signOut, so a server error cannot skip the reset.
  it('re-gates, wipes user storage, and hard-resets on Sign out', async () => {
    localStorage.setItem('deutsch-level', 'b1');
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ stats: { streak: 9, learnedCount: 20 }, gamification: { xp: 300 } })
    );
    localStorage.setItem(THEME_MODE_KEY, 'light');
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '/', reload },
    });
    const user = userEvent.setup();
    const { rerender, unmount } = render(<App />);

    try {
      // Latch gateDismissed the way a real signed-in session does, landing
      // directly on the app shell.
      await user.click(gate());

      authMock.status = 'authenticated';
      authMock.mayHaveSession = true;
      rerender(<App />);
      expect(gate()).toBeNull();
      expect(isLevelBoostEnabled()).toBe(true);

      // Sign out moved off Stats with the account section; the header chip is
      // the shortest real path to it now.
      await user.click(screen.getByRole('button', { name: /account/i }));
      await user.click(screen.getByRole('button', { name: 'Sign out' }));
      await waitFor(() => expect(authSignOutMock).toHaveBeenCalled());
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(window.location.href).toBe('/');

      expect(localStorage.getItem('deutsch-app-state-v1')).toBeNull();
      expect(localStorage.getItem('deutsch-level')).toBeNull();
      expect(localStorage.getItem(THEME_MODE_KEY)).toBe('light');
      expect(loadState()).toBeNull();

      // A real reload starts a new heap. thawPersist + remount stands in for that.
      thawPersist();
      unmount();
      authMock.status = 'anonymous';
      authMock.mayHaveSession = false;
      render(<App />);

      expect(gate()).toBeInTheDocument();
      expect(isLevelBoostEnabled()).toBe(false);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('hard-navigates even when signOut returns a server error', async () => {
    localStorage.setItem('deutsch-level', 'b1');
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ stats: { streak: 9 }, gamification: { xp: 1112 } })
    );
    localStorage.setItem(THEME_MODE_KEY, 'light');
    authSignOutMock.mockResolvedValueOnce({ error: { message: 'network' } });
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '/', reload },
    });
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    try {
      await user.click(gate());
      authMock.status = 'authenticated';
      authMock.mayHaveSession = true;
      rerender(<App />);
      // Sign out moved off Stats with the account section; the header chip is
      // the shortest real path to it now.
      await user.click(screen.getByRole('button', { name: /account/i }));
      await user.click(screen.getByRole('button', { name: 'Sign out' }));
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(window.location.href).toBe('/');
      expect(localStorage.getItem('deutsch-app-state-v1')).toBeNull();
      expect(loadState()).toBeNull();
      expect(localStorage.getItem(THEME_MODE_KEY)).toBe('light');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('keeps a level picked in settings after leaving and returning to the tab', async () => {
    authMock.status = 'authenticated';
    authMock.mayHaveSession = true;
    localStorage.setItem('deutsch-level', 'b1');
    render(<App />);
    const nav = within(screen.getByRole('navigation'));

    await userEvent.click(nav.getByRole('button', { name: 'Stats' }));
    await userEvent.click(screen.getByRole('radio', { name: /A1/ }));
    await userEvent.click(nav.getByRole('button', { name: 'Vocab' }));
    await userEvent.click(nav.getByRole('button', { name: 'Stats' }));

    // If App had dropped onLevelChange, StatsTab would re-mount from the stale
    // `level` prop and B1 would be checked again.
    expect(screen.getByRole('radio', { name: /A1/ })).toBeChecked();
  });
});

// The level lives in App state and is prop-drilled into every practice tab, so
// "the header switched it" and "the tabs re-rendered" are two separate claims.
describe('level coordination', () => {
  beforeEach(() => {
    // Shimmed here rather than inherited: this block passed only because an
    // earlier describe in the file had already assigned it to the prototype,
    // so running it alone (`vitest -t "level coordination"`) failed on
    // ChatTab's mount scroll. jsdom has no scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    authMock.configured = false;
    authMock.status = 'anonymous';
    authMock.mayHaveSession = false;
    setViewportWidth(1280);
  });

  // One header control now carries both the XP badge and the CEFR code.
  const chip = () =>
    within(screen.getByRole('banner')).getByRole('button', { name: /open status/i });

  it('offers the status control in the header on every viewport', () => {
    setViewportWidth(320);
    renderPastEntry(<App />);
    expect(chip()).toBeInTheDocument();
  });

  // The consolidation only holds if it is genuinely ONE target: a second
  // header button offering the same levels is the clutter it was meant to
  // remove, and the earlier LevelChip + LevelBadge pair is exactly that.
  it('leaves exactly one level affordance in the header', () => {
    renderPastEntry(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.queryAllByRole('button', { name: /level/i })).toHaveLength(1);
    // Closed by default: the levels live behind the trigger, not beside it.
    // Scoped to the CEFR radios — the Chat tab underneath has a scenario
    // radiogroup of its own, so a bare queryByRole('radio') matches that.
    expect(screen.queryByRole('radiogroup', { name: /learning level/i })).toBeNull();
  });

  it('carries the XP level and the practice level on the same control', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    expect(chip()).toHaveTextContent('A1');
    await user.click(chip());
    const sheet = within(screen.getByRole('dialog', { name: 'Status' }));
    expect(sheet.getByText('Progress')).toBeInTheDocument();
    expect(sheet.getByText('Practice level')).toBeInTheDocument();
  });

  it('switches the level from the header and drives the Translate tab with it', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Translate' })
    );
    expect(screen.getByText(/A1 — WORD TILES/)).toBeInTheDocument();

    await user.click(chip());
    await user.click(screen.getByRole('radio', { name: /B1/ }));

    expect(screen.getByText(/B1 — FREE TYPING/)).toBeInTheDocument();
    expect(screen.queryByText(/A1 — WORD TILES/)).toBeNull();
    expect(chip()).toHaveTextContent('B1');
  });

  // Mid-set, the switch is destructive, so it asks first and only then
  // restarts. Nothing here is persisted — no XP, no SRS box — so the cost is
  // position in the current set of ten, which is worth one question.
  it('asks before restarting a set in progress, then restarts on confirm', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Translate' })
    );
    // Advance off exercise 1 so a preserved index would be visible.
    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText(/Exercise 2 \/ 10/)).toBeInTheDocument();

    await user.click(chip());
    await user.click(screen.getByRole('radio', { name: /A2/ }));

    // Not switched yet: still A1, still on exercise 2.
    expect(screen.getByText(/exercise 2 of 10/i)).toBeInTheDocument();
    expect(screen.getByText(/A1 — WORD TILES/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch to A2/i }));
    expect(screen.getByText(/A2 — FILL THE BLANKS/)).toBeInTheDocument();
    expect(screen.getByText(/Exercise 1 \/ 10/)).toBeInTheDocument();
  });

  it('keeps the set and the level when the switch is declined', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Translate' })
    );
    await user.click(screen.getByRole('button', { name: /skip/i }));

    await user.click(chip());
    await user.click(screen.getByRole('radio', { name: /B1/ }));
    await user.click(screen.getByRole('button', { name: /keep going/i }));

    expect(screen.getByText(/A1 — WORD TILES/)).toBeInTheDocument();
    expect(screen.getByText(/Exercise 2 \/ 10/)).toBeInTheDocument();
    // Declining must not have written the level either.
    expect(localStorage.getItem('deutsch-level')).not.toBe('b1');
  });

  // The other half of the guardrail: with nothing in flight it must NOT ask.
  // A confirmation that fires every time is one people learn to click through.
  it('switches without asking when no set is in progress', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Translate' })
    );
    // Still on exercise 1 — nothing to lose.
    expect(screen.getByText(/Exercise 1 \/ 10/)).toBeInTheDocument();

    await user.click(chip());
    await user.click(screen.getByRole('radio', { name: /A2/ }));
    expect(screen.queryByRole('button', { name: /switch to A2/i })).toBeNull();
    expect(screen.getByText(/A2 — FILL THE BLANKS/)).toBeInTheDocument();
  });

  // TranslateTab unmounts when the learner leaves the tab, so its claim must
  // go with it. A flag pushed up to App instead of a registry would be left
  // behind here and would ask about a session that no longer exists.
  it('stops asking once the practice tab is left', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    const nav = () => within(screen.getByRole('navigation'));
    await user.click(nav().getByRole('button', { name: 'Translate' }));
    await user.click(screen.getByRole('button', { name: /skip/i }));
    await user.click(nav().getByRole('button', { name: 'Stats' }));

    await user.click(chip());
    // Scoped to the sheet: the Stats tab renders a full switcher of its own,
    // so an unscoped /B1/ radio query matches two controls here.
    const sheet = within(screen.getByRole('dialog', { name: 'Status' }));
    await user.click(sheet.getByRole('radio', { name: /B1/ }));
    expect(screen.queryByRole('button', { name: /switch to B1/i })).toBeNull();
  });

  it('follows a level written anywhere else, via the change notifier', async () => {
    renderPastEntry(<App />);
    expect(chip()).toHaveTextContent('A1');
    // Stands in for sync pulling a level chosen on another device.
    await act(async () => {
      const { writeLevel } = await import('./lib/levelPref');
      writeLevel('b1');
    });
    expect(chip()).toHaveTextContent('B1');
  });

  it('keeps the Stats switcher and the header control on the same level', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(chip());
    await user.click(screen.getByRole('radio', { name: /A2/ }));
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Stats' }));
    expect(screen.getByRole('radio', { name: /A2/ })).toBeChecked();
  });
});

// ── Sync orchestration ───────────────────────────────────────
// App wires the sync engine in two effects, both guarded by SYNC_ENABLED. The
// flag is false on both machines that run this suite and true in production,
// so the guarded side shipped with no test at all — the same flag-split that
// let #148 reach production green. These drive the value that ships.
describe('sync engine wiring', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.setItem('deutsch-level', 'a1');
    syncMock.enabled = false;
    syncMock.start.mockClear();
    syncMock.stop.mockClear();
    syncMock.markDirty.mockClear();
    authMock.status = 'anonymous';
  });

  it('starts the engine for a signed-in user when sync is enabled', () => {
    syncMock.enabled = true;
    authMock.status = 'authenticated';
    renderPastEntry(<App />);
    expect(syncMock.start).toHaveBeenCalledWith('u1');
  });

  // A second effect, a second spy: progress anywhere in the app dispatches
  // `deutsch:progress`, and sync's job is to mark the local state dirty so the
  // next push carries it. Guarded by the same flag, so it shipped untested for
  // the same reason.
  it('marks state dirty when progress is recorded', () => {
    syncMock.enabled = true;
    authMock.status = 'authenticated';
    renderPastEntry(<App />);
    expect(syncMock.markDirty).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent('deutsch:progress'));
    });
    expect(syncMock.markDirty).toHaveBeenCalledTimes(1);
  });

  // The cleanup half. Without it the listener outlives the signed-in session
  // and a guest's practice would keep marking an ex-user's state dirty.
  it('stops listening for progress once the app unmounts', () => {
    syncMock.enabled = true;
    authMock.status = 'authenticated';
    const { unmount } = renderPastEntry(<App />);
    unmount();

    act(() => {
      window.dispatchEvent(new CustomEvent('deutsch:progress'));
    });
    expect(syncMock.markDirty).not.toHaveBeenCalled();
  });

  // The disabled side of the same guard, asserted rather than assumed: with a
  // user present but the flag off, nothing may be wired up at all.
  it('wires nothing when the flag is off, even with a signed-in user', () => {
    syncMock.enabled = false;
    authMock.status = 'authenticated';
    renderPastEntry(<App />);

    act(() => {
      window.dispatchEvent(new CustomEvent('deutsch:progress'));
    });
    expect(syncMock.start).not.toHaveBeenCalled();
    expect(syncMock.markDirty).not.toHaveBeenCalled();
    expect(syncMock.stop).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
//  First-run walkthrough
// ═══════════════════════════════════════════════════════════════
//
// The overlay's own placement maths is unit-tested against stubbed rects in
// tutorial/geometry.test.js. What can only be checked here is the wiring: that
// each step's ref is attached to the DOM node it claims, and that the tour
// reaches a learner past the entry gate at all. jsdom lays nothing out, so the
// rects are stubbed onto the REAL header and nav nodes and a resize is fired to
// make the overlay re-measure them.
describe('first-run walkthrough', () => {
  const asRect = (left, top, width, height) => () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    localStorage.setItem('deutsch-level', 'a1');
    authMock.configured = false;
    authMock.status = 'anonymous';
    authMock.mayHaveSession = false;
    setViewportWidth(1280);
  });

  const tour = () => screen.queryByRole('dialog', { name: /tutorial/i });
  const statusChip = () =>
    within(screen.getByRole('banner')).getByRole('button', { name: /open status/i });
  const navButton = (name) => within(screen.getByRole('navigation')).getByRole('button', { name });
  // The status step anchors to the wrapper around StatusChip, not to the chip
  // button inside it — StatusChip owns its own root ref, so the walkthrough
  // gets its handle from outside. In a browser the wrapper is a flex item
  // sized to that chip; jsdom lays nothing out, so it is what must be stubbed.
  const statusAnchor = () => statusChip().closest('[data-tutorial-anchor="status"]');

  it('greets a learner who has never dismissed it', () => {
    renderPastEntry(<App />);
    expect(tour()).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('stays away once the learner has dismissed it', () => {
    asReturningLearner();
    renderPastEntry(<App />);
    expect(tour()).not.toBeInTheDocument();
  });

  it('hands the app back and remembers, when Skip tutorial is clicked', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);
    await user.click(screen.getByRole('button', { name: /skip tutorial/i }));

    expect(tour()).not.toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_KEY)).toBe('true');
    // The app underneath is intact and usable.
    expect(navButton('Chat')).toBeInTheDocument();
  });

  it('anchors each step to the header chip, then Chat, then Stats', async () => {
    const user = userEvent.setup();
    renderPastEntry(<App />);

    // Distinct, non-overlapping rects so a ref pointing at the wrong node
    // cannot coincidentally land in the right place.
    statusAnchor().getBoundingClientRect = asRect(900, 10, 52, 52);
    navButton('Chat').getBoundingClientRect = asRect(200, 90, 120, 48);
    navButton('Stats').getBoundingClientRect = asRect(600, 90, 120, 48);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const bubbleCentre = () => {
      const b = screen.getByTestId('tutorial-bubble');
      return Number.parseFloat(b.style.left) + Number.parseFloat(b.style.width) / 2;
    };

    expect(bubbleCentre()).toBeCloseTo(926, 0); // status chip centre
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(bubbleCentre()).toBeCloseTo(260, 0); // Chat nav centre
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(bubbleCentre()).toBeCloseTo(660, 0); // Stats nav centre
  });

  it('keeps the whole tour inside a 320px viewport, over the real chrome', async () => {
    const user = userEvent.setup();
    setViewportWidth(320);
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 568,
    });
    renderPastEntry(<App />);

    // Icon-only nav at bp.tiny: six buttons across 320px, the last flush right.
    statusAnchor().getBoundingClientRect = asRect(262, 8, 42, 42);
    navButton('Chat').getBoundingClientRect = asRect(55, 60, 45, 44);
    navButton('Stats').getBoundingClientRect = asRect(265, 60, 45, 44);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    for (let step = 1; step <= 3; step += 1) {
      const b = screen.getByTestId('tutorial-bubble');
      const left = Number.parseFloat(b.style.left);
      const width = Number.parseFloat(b.style.width);
      expect(left, `step ${step} left edge`).toBeGreaterThanOrEqual(0);
      expect(left + width, `step ${step} right edge`).toBeLessThanOrEqual(320);
      if (step < 3) await user.click(screen.getByRole('button', { name: /next/i }));
    }
  });
});

// The account lane's client wiring: App owns the fetch, the reauth_required
// branch and the post-delete reset, and none of it was covered before. The
// reauth branch matters most — a 401 that does not open the sheet leaves the
// user at a dead end with no way to finish deleting.
describe('account deletion wiring', () => {
  let fetchSpy;

  beforeEach(() => {
    // The Settings route seeds itself from window.location.hash so it can be
    // deep-linked. jsdom keeps that hash across tests in a file, so without
    // this reset a later test opens with Settings already showing.
    window.location.hash = '';
    // `configured` is deliberately reset here, not just status/token: earlier
    // blocks in this file leave it false, and requestSignIn() is a no-op when
    // auth is unconfigured — so without this the reauth assertion passes or
    // fails depending on which tests ran before it.
    authMock.configured = true;
    authMock.status = 'authenticated';
    authMock.token = 'tok';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    window.location.hash = '';
    authMock.status = 'anonymous';
    authMock.token = null;
  });

  const jsonRes = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return this;
    },
    json: () => Promise.resolve(body),
  });

  async function armDeletion() {
    setViewportWidth(1280);
    renderPastEntry(<App />);
    // The danger zone lives in the Settings route now, opened from the header
    // chip rather than sitting inside the Stats tab.
    await userEvent.click(screen.getByRole('button', { name: /account/i }));
    await userEvent.click(screen.getByRole('button', { name: /open settings/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /type delete to confirm/i }),
      'DELETE'
    );
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }));
  }

  it('sends the typed confirmation to the delete endpoint', async () => {
    fetchSpy.mockResolvedValue(jsonRes(204, {}));
    await armDeletion();

    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/account/delete'));
    expect(call).toBeDefined();
    const [, init] = call;
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ confirm: 'DELETE' });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('opens the sign-in sheet when the server demands a fresh authentication', async () => {
    fetchSpy.mockResolvedValue(
      jsonRes(401, { error: { code: 'reauth_required', message: 'Please sign in again.' } })
    );
    await armDeletion();

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()
    );
    // The phrase stays typed so retrying after re-auth is one click.
    expect(screen.getByRole('textbox', { name: /type delete to confirm/i })).toHaveValue('DELETE');
  });

  it('does NOT open the sign-in sheet for an ordinary failure', async () => {
    fetchSpy.mockResolvedValue(jsonRes(500, { error: { code: 'server_error', message: 'boom' } }));
    await armDeletion();

    expect(screen.queryByRole('dialog', { name: /sign in/i })).not.toBeInTheDocument();
  });
});

describe('Home missions fed from real data', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    localStorage.setItem('deutsch-level', 'a1');
    leagueStandingMock.value = null;
    leagueStandingMock.calls = [];
  });
  afterEach(() => {
    leagueStandingMock.value = null;
    leagueStandingMock.calls = [];
    authMock.status = 'anonymous';
  });

  /** One card learned in the first curated deck: started, not finished. */
  const seedStartedDeck = () => {
    const [deckId, cards] = Object.entries(activePack.content.decks)[0];
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ learnedWords: { [cards[0].id]: true } })
    );
    return { deckId, remaining: cards.length - 1 };
  };

  it('opens deck-unfinished with the real remaining-card count', async () => {
    const { remaining } = seedStartedDeck();
    renderPastEntry(<App />);

    expect(await screen.findByText(`${remaining} cards left in your deck`)).toBeInTheDocument();
  });

  it('opens no deck mission when nothing has been learned', async () => {
    localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ learnedWords: {} }));
    renderPastEntry(<App />);

    await waitFor(() => expect(screen.queryByText(/left in your deck/)).toBeNull());
  });

  it('opens league-position when the caller is in the demotion zone', async () => {
    // The production-only combination: signed in, a standing, and at risk.
    leagueStandingMock.value = { rank: 23, cohortSize: 25, inDemotionZone: true };
    seedStartedDeck();
    renderPastEntry(<App />);

    expect(await screen.findByText(/drop zone/i)).toBeInTheDocument();
  });

  it('opens no league mission for a mid-table standing', async () => {
    leagueStandingMock.value = { rank: 10, cohortSize: 25, inDemotionZone: false };
    seedStartedDeck();
    renderPastEntry(<App />);

    await screen.findByText(/left in your deck/); // the board has rendered
    expect(screen.queryByText(/drop zone/i)).toBeNull();
  });

  it('opens no league mission when there is no standing at all', async () => {
    leagueStandingMock.value = null;
    seedStartedDeck();
    renderPastEntry(<App />);

    await screen.findByText(/left in your deck/);
    expect(screen.queryByText(/drop zone/i)).toBeNull();
  });

  it("asks for the signed-in caller's own standing", async () => {
    authMock.status = 'authenticated';
    seedStartedDeck();
    renderPastEntry(<App />);

    await screen.findByText(/left in your deck/);
    expect(leagueStandingMock.calls).toContain('u1');
  });

  it('asks for no standing at all while signed out', async () => {
    authMock.status = 'anonymous';
    seedStartedDeck();
    renderPastEntry(<App />);

    await screen.findByText(/left in your deck/);
    expect(leagueStandingMock.calls.every((id) => id === undefined)).toBe(true);
  });
});

describe('custom decks survive the component that made them', () => {
  const generated = [
    { de: 'die Sonne', en: 'the sun' },
    { de: 'der Regen', en: 'the rain' },
    { de: 'der Wind', en: 'the wind' },
    { de: 'die Wolke', en: 'the cloud' },
  ];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    localStorage.setItem('deutsch-level', 'a1');
    callClaude.mockReset();
    callClaude.mockResolvedValue(JSON.stringify(generated));
    // syncMock.start is one shared spy for the whole file and an earlier block
    // asserts it WAS called. Without this clear, the guest test below inherits
    // that call and fails depending on execution order.
    syncMock.enabled = false;
    syncMock.start.mockClear();
    authMock.status = 'anonymous';
  });

  afterEach(() => {
    // Leave the shared mocks as this block found them.
    syncMock.enabled = false;
    syncMock.start.mockClear();
    authMock.status = 'anonymous';
  });

  const goToTab = async (name) => userEvent.click(screen.getByRole('button', { name }));

  const generateADeck = async () => {
    await goToTab('Vocab');
    await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
    await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));
    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
  };

  it('writes the generated deck into the state blob', async () => {
    renderPastEntry(<App />);
    await generateADeck();

    await waitFor(() => expect(loadState()?.decks?.custom).toBeTruthy());
    const stored = loadState().decks.custom;
    expect(stored.name).toBe('weather');
    expect(stored.cards.map((c) => c.de)).toEqual(generated.map((g) => g.de));
    expect(stored.updatedAt).toEqual(expect.any(Number));
  });

  it('keeps the deck across a tab switch — the bug this phase fixes', async () => {
    renderPastEntry(<App />);
    await generateADeck();

    // VocabTab unmounts here. Before this change that destroyed the deck.
    await goToTab('Chat');
    expect(screen.queryByRole('button', { name: /Your Deck/ })).toBeNull();
    await goToTab('Vocab');

    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
  });

  it('keeps the deck across a full remount — the reload case', async () => {
    const first = renderPastEntry(<App />);
    await generateADeck();
    await waitFor(() => expect(loadState()?.decks?.custom).toBeTruthy());
    first.unmount();

    renderPastEntry(<App />);
    await goToTab('Vocab');
    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
  });

  it('does all of that for a signed-out guest, with sync off and no writes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const first = renderPastEntry(<App />);
    await generateADeck();
    await waitFor(() => expect(loadState()?.decks?.custom).toBeTruthy());
    first.unmount();

    renderPastEntry(<App />);
    await goToTab('Vocab');
    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
    expect(syncMock.start).not.toHaveBeenCalled();
    // No WRITES, which is the claim. Deliberately not "no fetch at all": a
    // read left in flight by an earlier authenticated test can resolve after
    // this spy is installed, and a stray GET is not what this guards.
    const writes = fetchSpy.mock.calls.filter(([, opts]) => (opts?.method ?? 'GET') !== 'GET');
    expect(writes).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('does not lose learnedWords when it writes the deck', async () => {
    // The persist effect is a MERGE. If decks ever replaced the blob instead of
    // extending it, this is the assertion that would notice.
    localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ learnedWords: { Hallo: true } }));
    renderPastEntry(<App />);
    await generateADeck();

    await waitFor(() => expect(loadState()?.decks?.custom).toBeTruthy());
    expect(loadState().learnedWords).toEqual({ Hallo: true });
  });

  it('ignores a corrupted decks blob instead of failing to start', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ decks: { custom: { cards: 'not-an-array' } }, learnedWords: {} })
    );
    renderPastEntry(<App />);
    await goToTab('Vocab');

    expect(screen.queryByRole('button', { name: /Your Deck/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeInTheDocument();
  });
});

describe('a generated deck tells the sync engine there is something to push', () => {
  const generated = [
    { de: 'die Sonne', en: 'the sun' },
    { de: 'der Regen', en: 'the rain' },
  ];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    localStorage.setItem('deutsch-level', 'a1');
    callClaude.mockReset();
    callClaude.mockResolvedValue(JSON.stringify(generated));
    syncMock.markDirty.mockClear();
    syncMock.start.mockClear();
  });

  afterEach(() => {
    syncMock.enabled = false;
    syncMock.markDirty.mockClear();
    syncMock.start.mockClear();
    authMock.status = 'anonymous';
  });

  const generateADeck = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Vocab' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
    await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));
    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
  };

  it('marks the state dirty for a signed-in user with sync on', async () => {
    // Without this the deck sits locally until some UNRELATED progress event or
    // a tab refocus happens to flush it.
    syncMock.enabled = true;
    authMock.status = 'authenticated';
    renderPastEntry(<App />);
    await generateADeck();

    await waitFor(() => expect(syncMock.markDirty).toHaveBeenCalled());
  });

  it('still marks nothing dirty for a guest — sync stays off', async () => {
    syncMock.enabled = false;
    authMock.status = 'anonymous';
    renderPastEntry(<App />);
    await generateADeck();

    expect(syncMock.markDirty).not.toHaveBeenCalled();
  });
});

describe('deleting a custom deck writes a tombstone', () => {
  const generated = [
    { de: 'die Sonne', en: 'the sun' },
    { de: 'der Regen', en: 'the rain' },
  ];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    localStorage.setItem('deutsch-level', 'a1');
    callClaude.mockReset();
    callClaude.mockResolvedValue(JSON.stringify(generated));
    syncMock.enabled = false;
    syncMock.start.mockClear();
    syncMock.markDirty.mockClear();
    authMock.status = 'anonymous';
  });

  afterEach(() => {
    syncMock.enabled = false;
    syncMock.start.mockClear();
    syncMock.markDirty.mockClear();
    authMock.status = 'anonymous';
  });

  const seedDeck = () =>
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({
        decks: {
          custom: {
            deckId: 'custom',
            name: 'weather',
            cards: [{ id: 'die Sonne', de: 'die Sonne', en: 'the sun' }],
            updatedAt: 1000,
            deletedAt: null,
          },
        },
      })
    );

  const openVocab = async () => userEvent.click(screen.getByRole('button', { name: 'Vocab' }));
  const removeDeck = async () =>
    userEvent.click(screen.getByRole('button', { name: 'Remove your custom deck' }));

  it('offers a Remove control beside the deck, not nested inside it', async () => {
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();

    const remove = await screen.findByRole('button', { name: 'Remove your custom deck' });
    const select = screen.getByRole('button', { name: /Your Deck/ });
    // A <button> inside a <button> is invalid HTML and gets silently un-nested.
    expect(select.contains(remove)).toBe(false);
  });

  it('takes the deck out of the picker', async () => {
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();
    await removeDeck();

    await waitFor(() => expect(screen.queryByRole('button', { name: /Your Deck/ })).toBeNull());
  });

  it('records a TOMBSTONE rather than dropping the entry', async () => {
    // A plain delete is invisible to an upsert-only sync engine: the other
    // device would push its copy straight back on the next pull.
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();
    await removeDeck();

    await waitFor(() => expect(loadState()?.decks?.custom?.deletedAt).toEqual(expect.any(Number)));
    const stored = loadState().decks.custom;
    expect(stored.cards).toEqual([]);
    expect(stored.updatedAt).toBe(stored.deletedAt);
  });

  it('keeps the tombstone across a remount, so the deck stays gone', async () => {
    seedDeck();
    const first = renderPastEntry(<App />);
    await openVocab();
    await removeDeck();
    await waitFor(() => expect(loadState()?.decks?.custom?.deletedAt).toBeTruthy());
    first.unmount();

    renderPastEntry(<App />);
    await openVocab();
    expect(screen.queryByRole('button', { name: /Your Deck/ })).toBeNull();
  });

  it('falls back off the custom deck when the selected one is removed', async () => {
    // There is no PRESET_DECKS.custom to land on, so without the fallback the
    // learner is left staring at an empty deck.
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();
    await userEvent.click(screen.getByRole('button', { name: /Your Deck/ }));
    await removeDeck();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Greetings/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
  });

  it('tells the sync engine, so the tombstone reaches the other device', async () => {
    syncMock.enabled = true;
    authMock.status = 'authenticated';
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();
    await removeDeck();

    await waitFor(() => expect(syncMock.markDirty).toHaveBeenCalled());
  });

  it('lets a regenerated deck clear the tombstone', async () => {
    seedDeck();
    renderPastEntry(<App />);
    await openVocab();
    await removeDeck();
    await waitFor(() => expect(loadState()?.decks?.custom?.deletedAt).toBeTruthy());

    await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
    await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));

    expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
    await waitFor(() => expect(loadState()?.decks?.custom?.deletedAt).toBeNull());
  });
});

describe('markLearned sets rather than toggles', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
    asReturningLearner();
    // b1 → typed answer, so a one-card deck works (multiple choice needs four).
    localStorage.setItem('deutsch-level', 'b1');
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({
        decks: {
          custom: {
            deckId: 'custom',
            name: 'sun',
            updatedAt: 1000,
            deletedAt: null,
            cards: [{ id: 'die Sonne', de: 'die Sonne', en: 'the sun', glosses: ['the sun'] }],
          },
        },
      })
    );
  });

  const selectCustom = async () =>
    userEvent.click(await screen.findByRole('button', { name: /Your Deck/ }));

  const answerCorrectly = async () => {
    const input = screen.getByRole('textbox', { name: 'Type the English meaning' });
    await userEvent.type(input, 'the sun');
    await userEvent.click(screen.getByRole('button', { name: /CHECK/ }));
  };

  it('keeps a word learned when the same card comes round again', async () => {
    // A correct answer offers only HARD/GOOD/EASY, so the card leaves the queue.
    // Switching decks and back rebuilds it from SRS, which is how a learner meets
    // the same card twice. With the old `!prev[word]` the second correct answer
    // UN-learned it.
    renderPastEntry(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Vocab' }));
    await selectCustom();

    await answerCorrectly();
    expect(screen.getByText('✓ LEARNED')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'GOOD' }));

    // Rebuild the queue: away to a preset deck and back.
    await userEvent.click(screen.getByRole('button', { name: /Greetings/ }));
    await selectCustom();

    await answerCorrectly();
    expect(screen.getByText('✓ LEARNED')).toBeInTheDocument();
    expect(loadState().learnedWords['die Sonne']).toBe(true);
  });

  it('never writes false into learnedWords', async () => {
    // learnedWords is union-merged across devices, so a stray false is not just
    // wrong locally — the next sync discards it, making the bug device-specific.
    renderPastEntry(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Vocab' }));
    await selectCustom();

    await answerCorrectly();
    await userEvent.click(screen.getByRole('button', { name: 'GOOD' }));
    await userEvent.click(screen.getByRole('button', { name: /Greetings/ }));
    await selectCustom();
    await answerCorrectly();

    await waitFor(() => expect(loadState()?.learnedWords).toBeTruthy());
    expect(Object.values(loadState().learnedWords)).not.toContain(false);
  });
});
