import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('../../lib/social.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchUsers: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

import UserSearch, { DEBOUNCE_MS } from './UserSearch';
import { searchUsers, followUser, unfollowUser } from '../../lib/social.js';

const SAM = {
  user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  handle: 'sam_de',
  display_name: 'Sam Weber',
  avatar_path: null,
  is_following: false,
};
const SUE = {
  user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  handle: 'sue_de',
  display_name: null,
  avatar_path: null,
  is_following: true,
};

const box = () => screen.getByRole('searchbox');

/** Type, then let the debounce elapse and the search promise settle. */
async function typeAndSettle(value) {
  fireEvent.change(box(), { target: { value } });
  await act(async () => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  searchUsers.mockResolvedValue([]);
  followUser.mockResolvedValue({ is_following: true });
  unfollowUser.mockResolvedValue({ is_following: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('UserSearch — querying', () => {
  it('sends ONE request for a burst of typing, not one per keystroke', async () => {
    render(<UserSearch />);
    fireEvent.change(box(), { target: { value: 's' } });
    fireEvent.change(box(), { target: { value: 'sa' } });
    fireEvent.change(box(), { target: { value: 'sam' } });

    expect(searchUsers).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(searchUsers).toHaveBeenCalledTimes(1);
    expect(searchUsers).toHaveBeenCalledWith('sam');
  });

  it('does not query at all for a term below the minimum', async () => {
    render(<UserSearch />);
    await typeAndSettle('s');
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('renders the name, the handle and an avatar for each result', async () => {
    searchUsers.mockResolvedValue([SAM]);
    render(<UserSearch />);
    await typeAndSettle('sam');

    expect(screen.getByText('Sam Weber')).toBeInTheDocument();
    expect(screen.getByText('@sam_de')).toBeInTheDocument();
    expect(document.querySelector('[data-avatar]')).toBeTruthy();
  });

  // profileName already falls back to the handle, so printing it again below
  // would show the same string twice.
  it('does not print the handle twice when there is no display name', async () => {
    searchUsers.mockResolvedValue([SUE]);
    render(<UserSearch />);
    await typeAndSettle('sue');

    expect(screen.getAllByText(/sue_de/)).toHaveLength(1);
  });

  it('says so when nobody matches', async () => {
    searchUsers.mockResolvedValue([]);
    render(<UserSearch />);
    await typeAndSettle('zzz');

    expect(screen.getByText(/nobody matches/i)).toBeInTheDocument();
  });

  it('surfaces the server’s own wording when the search fails', async () => {
    searchUsers.mockRejectedValue(new Error('Too many requests — slow down.'));
    render(<UserSearch />);
    await typeAndSettle('sam');

    expect(screen.getByText('Too many requests — slow down.')).toBeInTheDocument();
  });

  it('clearing the box empties the list', async () => {
    searchUsers.mockResolvedValue([SAM]);
    render(<UserSearch />);
    await typeAndSettle('sam');
    expect(screen.getByText('Sam Weber')).toBeInTheDocument();

    await typeAndSettle('');
    expect(screen.queryByText('Sam Weber')).not.toBeInTheDocument();
  });

  // React 18 no-ops a setState after unmount, so an unmount test cannot tell a
  // present guard from a missing one. A SUPERSEDED response can.
  it('a slow earlier response cannot overwrite a newer one', async () => {
    let resolveFirst;
    searchUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    searchUsers.mockResolvedValueOnce([SUE]);

    render(<UserSearch />);
    await typeAndSettle('sam');
    await typeAndSettle('sue');

    expect(screen.getByText('sue_de')).toBeInTheDocument();

    // The stale request lands last, carrying the OLD term's results.
    await act(async () => {
      resolveFirst([SAM]);
    });

    expect(screen.queryByText('Sam Weber')).not.toBeInTheDocument();
    expect(screen.getByText('sue_de')).toBeInTheDocument();
  });

  it('a response for a term the learner already cleared cannot repopulate it', async () => {
    let resolveFirst;
    searchUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    render(<UserSearch />);
    await typeAndSettle('sam');
    await typeAndSettle('');

    await act(async () => {
      resolveFirst([SAM]);
    });

    expect(screen.queryByText('Sam Weber')).not.toBeInTheDocument();
  });
});

describe('UserSearch — following', () => {
  it('flips the button immediately, before the server answers', async () => {
    searchUsers.mockResolvedValue([SAM]);
    let resolveFollow;
    followUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFollow = resolve;
        })
    );

    render(<UserSearch />);
    await typeAndSettle('sam');

    const button = screen.getByRole('button', { name: /^Follow Sam Weber$/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await act(async () => {
      fireEvent.click(button);
    });

    // The request has NOT resolved, and the button already reads Following.
    expect(screen.getByRole('button', { name: /^Unfollow Sam Weber$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await act(async () => {
      resolveFollow({ is_following: true });
    });
    expect(followUser).toHaveBeenCalledWith(SAM.user_id);
  });

  it('rolls the button back when the follow fails', async () => {
    searchUsers.mockResolvedValue([SAM]);
    followUser.mockRejectedValue(new Error('Could not follow.'));

    render(<UserSearch />);
    await typeAndSettle('sam');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Follow Sam Weber$/ }));
    });

    // No waitFor here: it schedules its own timers, which fake timers never
    // advance, so it deadlocks. The rollback settles in microtasks that the
    // async act() above already flushed.
    expect(screen.getByRole('button', { name: /^Follow Sam Weber$/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByText('Could not follow.')).toBeInTheDocument();
  });

  it('unfollows someone already followed', async () => {
    searchUsers.mockResolvedValue([SUE]);
    render(<UserSearch />);
    await typeAndSettle('sue');

    const button = screen.getByRole('button', { name: /^Unfollow sue_de$/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(unfollowUser).toHaveBeenCalledWith(SUE.user_id);
    expect(screen.getByRole('button', { name: /^Follow sue_de$/ })).toBeInTheDocument();
  });

  // A list of buttons all named "Follow" is unnavigable by name alone.
  it('names each button after the person it acts on', async () => {
    searchUsers.mockResolvedValue([SAM, SUE]);
    render(<UserSearch />);
    await typeAndSettle('de');

    expect(screen.getByRole('button', { name: 'Follow Sam Weber' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unfollow sue_de' })).toBeInTheDocument();
  });

  it('labels the search box for a screen reader', async () => {
    render(<UserSearch />);
    expect(screen.getByLabelText(/search people by name or handle/i)).toBeInTheDocument();
  });
});
