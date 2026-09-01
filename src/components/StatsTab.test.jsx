import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  score: () => ({
    level: 1,
    rankName: 'Anfänger',
    progress: 0,
    xpIntoLevel: 0,
    xpToNext: 50,
    totalXp: 0,
  }),
  DEFAULT_GOAL: 20,
}));

vi.mock('../lib/settingsStamp', () => ({ stampSettings: () => {}, stampLevel: () => {} }));

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
    expect(screenOff.getByRole('button', { name: /settings/i })).toBeTruthy();
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

describe('StatsTab — Profile segments', () => {
  it('always offers STATS and SETTINGS', () => {
    render(<StatsTab />);
    expect(screen.getByRole('button', { name: /stats/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /settings/i })).toBeTruthy();
  });

  it('renders the settings panel in the SETTINGS view', () => {
    render(<StatsTab settingsPanel={<div>stub-settings</div>} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByText('stub-settings')).toBeTruthy();
  });

  it('does not keep GoalPicker or LevelSwitcher on the stats view', () => {
    render(<StatsTab />);
    expect(screen.queryByRole('radiogroup', { name: /level/i })).toBeNull();
    expect(screen.queryByText(/daily goal/i)).toBeNull();
    expect(screen.queryByText(/sound: on/i)).toBeNull();
    expect(screen.queryByText(/sound: off/i)).toBeNull();
  });
});
