import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeTab from './HomeTab';

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
