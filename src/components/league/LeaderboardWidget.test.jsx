import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LeaderboardWidget from './LeaderboardWidget';

const leaders = [
  {
    user_id: 'u1',
    handle: 'anna',
    weekly_xp: 1280,
    profile: {
      display_name: 'Anna Adler',
      handle: 'anna',
      avatar_path: null,
      is_private: false,
    },
  },
  {
    user_id: 'u2',
    handle: 'private-paul',
    weekly_xp: 940,
    profile: {
      display_name: 'Paul Privat',
      handle: 'private-paul',
      avatar_path: null,
      is_private: true,
    },
  },
  {
    user_id: 'u3',
    handle: 'fallback-frieda',
    weekly_xp: 710,
    profile: null,
  },
  {
    user_id: 'u4',
    handle: 'not-rendered',
    weekly_xp: 400,
    profile: null,
  },
];

describe('LeaderboardWidget', () => {
  it('renders only the top three ranks with compact identity and XP rows', () => {
    render(<LeaderboardWidget leaders={leaders} />);

    expect(screen.getByRole('heading', { name: 'Top 3' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Top 3 leaderboard' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Anna Adler')).toBeInTheDocument();
    expect(screen.getByText('1,280 XP')).toBeInTheDocument();
    expect(screen.queryByText('@not-rendered')).not.toBeInTheDocument();
    // Avatars are decorative beside a printed name, so Avatar correctly gives
    // them alt="" and they do not enter the accessibility tree as images.
    expect(list.querySelectorAll('img')).toHaveLength(3);
  });

  it('uses only @handle for a private profile and never prints its full name', () => {
    render(<LeaderboardWidget leaders={leaders} />);

    expect(screen.getByText('@private-paul')).toBeInTheDocument();
    expect(screen.queryByText('Paul Privat')).not.toBeInTheDocument();
    expect(screen.getByText('@fallback-frieda')).toBeInTheDocument();
  });

  it('declares bounded shrink behavior for narrow layouts', () => {
    render(<LeaderboardWidget leaders={leaders} />);

    expect(screen.getByTestId('home-leaderboard-widget')).toHaveStyle({
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
      overflow: 'hidden',
    });
    const firstRow = screen.getAllByRole('listitem')[0];
    expect(firstRow).toHaveStyle({
      gridTemplateColumns: '24px 28px minmax(0, 1fr) auto',
      maxWidth: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
    });
    expect(screen.getByText('Anna Adler')).toHaveStyle({
      minWidth: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });

  it('renders nothing without an active cohort preview', () => {
    const { container } = render(<LeaderboardWidget leaders={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
