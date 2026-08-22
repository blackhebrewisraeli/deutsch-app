import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatsTab from './StatsTab';

// --- Module mocks ---

vi.mock('../lib/storage', () => ({
  loadState: () => null,
  saveState: () => {},
}));

vi.mock('../lib/stats', () => ({
  todayKey: () => '2026-06-27',
  getTodaySnapshot: () => ({}),
  getHeatmapData: () => [],
  getPerTabBreakdown: () => ({}),
  getAccuracyByLevel: () => ({}),
  getReviewItems: () => [],
}));

vi.mock('../lib/gamification', () => ({
  levelFromXp: () => 1,
  totalXp: () => 0,
  DEFAULT_GOAL: 20,
}));

vi.mock('../lib/settingsStamp', () => ({ stampSettings: () => {} }));

// Stub out heavy sub-components so tests are fast
vi.mock('./stats/TodaySnapshot.jsx', () => ({ default: () => <div /> }));
vi.mock('./stats/Heatmap.jsx', () => ({ default: () => <div />, HeatmapLegend: () => <div /> }));
vi.mock('./stats/PerTabBars.jsx', () => ({ default: () => <div /> }));
vi.mock('./stats/AccuracyByLevel.jsx', () => ({ default: () => <div /> }));
vi.mock('./stats/ReviewFeed.jsx', () => ({ default: () => <div /> }));
vi.mock('./stats/VocabSrsWidget.jsx', () => ({ default: () => <div /> }));
vi.mock('./stats/AccountSection.jsx', () => ({ default: () => <div /> }));
vi.mock('./gamification/LevelCard.jsx', () => ({ default: () => <div /> }));
vi.mock('./gamification/GoalPicker.jsx', () => ({ default: () => <div /> }));
vi.mock('./gamification/BadgeGrid.jsx', () => ({ default: () => <div /> }));

// --- Leagues-specific stubs ---
vi.mock('./stats/LeaderboardSection.jsx', () => ({
  default: ({ onSelectUser }) => (
    <button onClick={() => onSelectUser('x')}>stub-leaderboard</button>
  ),
}));

vi.mock('./stats/ProfileCard.jsx', () => ({
  default: ({ userId }) => <div>stub-card-{userId}</div>,
}));

// Mock leagues flag as ENABLED
vi.mock('../lib/leagues.js', () => ({
  LEAGUES_ENABLED: true,
  TIER_NAMES: ['Bronze'],
}));

describe('StatsTab — Leagues flag OFF', () => {
  it('hides Leagues nav button when LEAGUES_ENABLED is false', async () => {
    vi.resetModules();
    vi.doMock('../lib/leagues.js', () => ({ LEAGUES_ENABLED: false, TIER_NAMES: ['Bronze'] }));
    const { default: StatsTabOff } = await import('./StatsTab.jsx');
    const { render: renderOff, screen: screenOff } = await import('@testing-library/react');
    renderOff(<StatsTabOff />);
    expect(screenOff.queryByRole('button', { name: /leagues/i })).toBeNull();
    vi.resetModules();
  });
});

describe('StatsTab — Leagues view', () => {
  it('shows Leagues nav tab when LEAGUES_ENABLED', () => {
    render(<StatsTab />);
    expect(screen.getByRole('button', { name: /leagues/i })).toBeTruthy();
  });

  it('switches to Leagues view and renders LeaderboardSection', () => {
    render(<StatsTab />);
    fireEvent.click(screen.getByRole('button', { name: /leagues/i }));
    expect(screen.getByText('stub-leaderboard')).toBeTruthy();
  });

  it('clicking leaderboard row opens ProfileCard with correct userId', () => {
    render(<StatsTab />);
    fireEvent.click(screen.getByRole('button', { name: /leagues/i }));
    fireEvent.click(screen.getByText('stub-leaderboard'));
    expect(screen.getByText('stub-card-x')).toBeTruthy();
  });
});

describe('StatsTab — Learning level', () => {
  it('offers a level picker and reports the chosen level', async () => {
    const onLevelChange = vi.fn();
    render(<StatsTab level="a1" onLevelChange={onLevelChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });

  it('persists the chosen level', async () => {
    render(<StatsTab level="a1" onLevelChange={() => {}} />);
    await userEvent.click(screen.getByRole('radio', { name: /A2/ }));
    expect(localStorage.getItem('deutsch-level')).toBe('a2');
  });

  it('names the level for a guest, with no bonus promised', () => {
    render(<StatsTab level="a1" onLevelChange={() => {}} />);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });

  it.each([
    ['a1', /Word tiles/, /Assemble the full sentence/],
    ['a2', /Fill the blanks/, /Select the missing words/],
    ['b1', /Free typing/, /AI-graded translation/],
  ])('describes the %s exercise mode', (lvl, label, detail) => {
    render(<StatsTab level={lvl} onLevelChange={() => {}} />);
    const line = screen.getByText(/Translate exercises:/);
    expect(line).toHaveTextContent(label);
    expect(line).toHaveTextContent(detail);
  });

  // Case-transforming the descriptor mangled the acronym ("ai-graded").
  it('keeps the AI acronym uppercase in the B1 descriptor', () => {
    render(<StatsTab level="b1" onLevelChange={() => {}} />);
    expect(screen.getByText(/Translate exercises:/)).toHaveTextContent('AI-graded');
    expect(screen.queryByText(/ai-graded/)).toBeNull();
  });

  it('describes only the selected level, not all three', () => {
    render(<StatsTab level="a1" onLevelChange={() => {}} />);
    const line = screen.getByText(/Translate exercises:/);
    expect(line).not.toHaveTextContent(/AI-graded/);
    expect(line).not.toHaveTextContent(/missing words/);
  });

  it('names the level XP bonus for an account holder above A1', () => {
    render(<StatsTab level="b1" onLevelChange={() => {}} levelBoost />);
    expect(screen.getByText(/×1\.5 XP per answer/)).toBeInTheDocument();
  });

  it('promises no bonus to a guest', () => {
    render(<StatsTab level="b1" onLevelChange={() => {}} />);
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });

  it('names the level but promises no bonus for an A1 account holder', () => {
    render(<StatsTab level="a1" onLevelChange={() => {}} levelBoost />);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });
});
