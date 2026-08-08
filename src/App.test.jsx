import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { todayKey } from './lib/stats';

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));

const TAB_NAMES = ['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
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
    localStorage.setItem('deutsch-onboarded', '1');
  });

  it('desktop nav exposes an accessible name for every tab', () => {
    setViewportWidth(1280);
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      expect(nav.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('mobile icon-only nav buttons keep their accessible names', () => {
    setViewportWidth(375);
    render(<App />);
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
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
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
    localStorage.setItem('deutsch-onboarded', '1');
  });

  it('drops the goal ring from the header on mobile', () => {
    setViewportWidth(375);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.queryByTitle(/Daily goal/)).not.toBeInTheDocument();
  });

  it('keeps the goal ring in the header on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.getByTitle(/Daily goal/)).toBeInTheDocument();
  });

  it.each(['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'])(
    'shows daily-goal progress on the %s tab on mobile',
    async (tabName) => {
      setViewportWidth(375);
      const user = userEvent.setup();
      render(<App />);
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
    render(<App />);
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
    render(<App />);
    expect(within(screen.getByRole('banner')).queryByText('STREAK')).not.toBeInTheDocument();
  });

  it('keeps the STREAK caption on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    expect(within(screen.getByRole('banner')).getByText('STREAK')).toBeInTheDocument();
  });

  // Below 360px even the scaled wordmark cannot coexist with the widgets: a
  // real year-long streak renders level 30 + "365" + a freeze chip + SIGN IN,
  // which measured 34px past a 320px viewport. Every one of those is the only
  // surface for its signal — the freeze count appears nowhere else in the app —
  // so the wordmark, the one decorative item, is dropped instead.
  it('drops the wordmark below 360px', () => {
    setViewportWidth(320);
    render(<App />);
    expect(within(screen.getByRole('banner')).queryByText(/Deutsch/)).not.toBeInTheDocument();
  });

  // The wordmark is decoration and yields to the functional cluster, which grew
  // a ThemeChip. It is hidden across the common phone range and returns at
  // bp.tiny (414), where the header measurably fits again.
  it('hides the wordmark across the phone range and restores it at bp.tiny', () => {
    setViewportWidth(390);
    const { unmount } = render(<App />);
    expect(within(screen.getByRole('banner')).queryByText(/Deutsch/)).toBeNull();
    unmount();

    setViewportWidth(414);
    render(<App />);
    expect(within(screen.getByRole('banner')).getByText(/Deutsch/)).toBeInTheDocument();
  });

  it('keeps the full-size wordmark and chrome on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    const header = screen.getByRole('banner');
    expect(header.style.padding).toBe('20px 32px');
    const wordmark = within(header)
      .getByText(/Deutsch/)
      .closest('div');
    expect(wordmark.style.fontSize).toBe('36px');
  });

  // On desktop the header ring carries the signal, so the strip stays scoped to
  // the two practice tabs it was built for.
  it('leaves the strip off the chat tab on desktop, where the ring covers it', () => {
    setViewportWidth(1280);
    render(<App />);
    expect(goalStrip()).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTitle(/Daily goal/)).toBeInTheDocument();
  });

  it('exposes Appearance from the header ThemeChip on every viewport', () => {
    setViewportWidth(390);
    render(<App />);
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /^appearance$/i })
    ).toBeInTheDocument();
  });

  it.each([320, 390, 1280])(
    'keeps the populated header (with freeze chip) within %ipx without horizontal overflow',
    (width) => {
      setViewportWidth(width);
      seedPopulatedAccount();
      render(<App />);
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
    render(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Stats' }));
    expect(screen.queryByText(/^Appearance$/i)).not.toBeInTheDocument();
  });
});

// Mid-app sign-in used to re-open WelcomeGate (the gate was the only auth-modal
// host). AuthSheet is now shared — signing in from Stats must not flash the gate.
describe('in-app AuthSheet', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.setItem('deutsch-onboarded', '1');
    vi.resetModules();
  });

  it('opens from Stats without resurfacing the WelcomeGate', async () => {
    vi.doMock('./lib/auth.js', () => ({
      isAuthConfigured: () => true,
      useAuth: () => ({ user: null, session: null, status: 'anonymous' }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getAccessToken: vi.fn(() => Promise.resolve(null)),
      signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
      verifyCode: vi.fn(() => Promise.resolve({ error: null })),
      mayHaveSession: () => false,
      authCallbackKind: () => null,
      getSupabase: () => Promise.resolve(null),
    }));

    const { default: AppWithAuth } = await import('./App.jsx');
    setViewportWidth(1280);
    const user = userEvent.setup();
    render(<AppWithAuth />);

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
    localStorage.setItem('deutsch-onboarded', '1');
    vi.resetModules();
  });

  async function renderApp({ configured = true, status = 'anonymous', state = EXHAUSTED } = {}) {
    localStorage.setItem('deutsch-app-state-v1', JSON.stringify(state));
    vi.doMock('./lib/auth.js', () => ({
      isAuthConfigured: () => configured,
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
      getSupabase: () => Promise.resolve(null),
    }));
    const { default: AppWithAuth } = await import('./App.jsx');
    setViewportWidth(1280);
    render(<AppWithAuth />);
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
    vi.useFakeTimers();
    try {
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
});
