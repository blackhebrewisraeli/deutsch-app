import { describe, it, expect, vi, beforeEach } from 'vitest';
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
