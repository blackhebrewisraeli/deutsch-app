import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeTab from './HomeTab';

// See IdentityStrip.test.jsx: isAuthConfigured() differs between a dev box and
// CI, and IdentityStrip branches on it.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));

const lvl = { level: 3, rankName: 'Anfänger', progress: 0.4, xpIntoLevel: 60, xpToNext: 150 };

describe('HomeTab', () => {
  it('renders the level card and the streak/goal ring', () => {
    render(
      <HomeTab lvl={lvl} totalXp={300} learnedCount={12} goalPct={0.5} goalMet={false} streak={4} />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Anfänger')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal · 50%')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/300 XP total/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
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

  // E5 is superseded NARROWLY by the identity strip: identity may appear,
  // administration may not. This is the assertion that stops the strip
  // drifting into a full account page on Home later.
  it('carries identity but never account management', () => {
    render(
      <HomeTab
        lvl={lvl}
        totalXp={300}
        learnedCount={12}
        goalPct={0.5}
        goalMet={false}
        streak={4}
        user={{ id: 'u1', email: 'semion@example.com' }}
        profile={{ display_name: 'Semion', handle: 'semion' }}
        cefrLevel="a2"
      />
    );
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();

    expect(screen.queryByText('semion@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export my data/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
  });

  it('renders the missions it is handed, and routes from one', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onGoToTab = vi.fn();
    render(
      <HomeTab
        lvl={lvl}
        totalXp={300}
        learnedCount={12}
        goalPct={0.5}
        goalMet={false}
        streak={4}
        cefrLevel="a1"
        missions={[{ id: 'srs-due', count: 5, tab: 'vocab', priority: 0 }]}
        onGoToTab={onGoToTab}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /5 cards are due/i }));
    expect(onGoToTab).toHaveBeenCalledWith('vocab', expect.objectContaining({ id: 'srs-due' }));
  });

  it('congratulates when no missions are open', () => {
    render(
      <HomeTab
        lvl={lvl}
        totalXp={300}
        learnedCount={12}
        goalPct={0.5}
        goalMet
        streak={4}
        cefrLevel="a1"
        missions={[]}
      />
    );
    expect(screen.getByText(/alles erledigt/i)).toBeInTheDocument();
  });
});
