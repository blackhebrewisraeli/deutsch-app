import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/social.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listFollows: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

vi.mock('../stats/ProfileCard', () => ({
  default: ({ userId, onClose }) => (
    <div role="dialog" aria-label="Learning passport">
      passport:{userId}
      <button type="button" onClick={onClose}>
        close passport
      </button>
    </div>
  ),
}));

import FollowListModal from './FollowListModal';
import { listFollows, followUser, unfollowUser } from '../../lib/social.js';

const SAM = {
  user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  handle: 'sam_de',
  display_name: 'Sam Weber',
  avatar_path: null,
  is_following: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FollowListModal — followers', () => {
  it('shows a loading state, then the people who follow the caller', async () => {
    listFollows.mockResolvedValue({ results: [SAM], hasMore: false });
    render(<FollowListModal kind="followers" onClose={() => {}} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('Sam Weber')).toBeInTheDocument();
    expect(listFollows).toHaveBeenCalledWith('followers');
    expect(screen.getByRole('dialog', { name: 'Follower' })).toBeInTheDocument();
  });

  it('says so when nobody follows the caller', async () => {
    listFollows.mockResolvedValue({ results: [], hasMore: false });
    render(<FollowListModal kind="followers" onClose={() => {}} />);
    expect(await screen.findByText('No followers yet.')).toBeInTheDocument();
  });

  it('surfaces the server error and retries on demand', async () => {
    listFollows.mockRejectedValueOnce(new Error('Could not load that list.'));
    listFollows.mockResolvedValueOnce({ results: [SAM], hasMore: false });
    render(<FollowListModal kind="followers" onClose={() => {}} />);

    expect(await screen.findByText('Could not load that list.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Sam Weber')).toBeInTheDocument();
    expect(listFollows).toHaveBeenCalledTimes(2);
  });

  // The 2026-09-23 "Folgt → 429" report read as a render loop. It was not
  // (see api/_lib/ratelimit.js), but this pins the property it suspected:
  // state the list itself sets — rows, pending, a parent re-render — must
  // never re-run the load.
  it('fetches exactly once per open, however often the list re-renders', async () => {
    listFollows.mockResolvedValue({ results: [SAM], hasMore: false });
    followUser.mockResolvedValue({ is_following: true });
    const onClose = () => {};
    const { rerender } = render(<FollowListModal kind="followers" onClose={onClose} />);

    fireEvent.click(await screen.findByRole('button', { name: /^Follow Sam Weber$/ }));
    await screen.findByRole('button', { name: /^Unfollow Sam Weber$/ });
    rerender(<FollowListModal kind="followers" onClose={() => {}} />);

    expect(listFollows).toHaveBeenCalledTimes(1);
  });

  it('follows back from the list, optimistically', async () => {
    listFollows.mockResolvedValue({ results: [SAM], hasMore: false });
    followUser.mockResolvedValue({ is_following: true });
    render(<FollowListModal kind="followers" onClose={() => {}} />);

    const button = await screen.findByRole('button', { name: /^Follow Sam Weber$/ });
    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: /^Unfollow Sam Weber$/ })).toBeInTheDocument();
    expect(followUser).toHaveBeenCalledWith(SAM.user_id);
  });

  it('offers Load more when another page exists, and appends it', async () => {
    const SUE = {
      ...SAM,
      user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      handle: 'sue_de',
      display_name: null,
    };
    listFollows.mockResolvedValueOnce({ results: [SAM], hasMore: true });
    listFollows.mockResolvedValueOnce({ results: [SUE], hasMore: false });

    render(<FollowListModal kind="followers" onClose={() => {}} />);
    await screen.findByText('Sam Weber');

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(loadMore);

    expect(await screen.findByText('sue_de')).toBeInTheDocument();
    expect(screen.getByText('Sam Weber')).toBeInTheDocument();
    expect(listFollows).toHaveBeenLastCalledWith('followers', { offset: 1 });
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('FollowListModal — following', () => {
  it('titles the dialog Folgt and unfollows from the list', async () => {
    const followed = { ...SAM, is_following: true };
    listFollows.mockResolvedValue({ results: [followed], hasMore: false });
    unfollowUser.mockResolvedValue({ is_following: false });

    render(<FollowListModal kind="following" onClose={() => {}} />);
    expect(await screen.findByRole('dialog', { name: 'Folgt' })).toBeInTheDocument();
    expect(listFollows).toHaveBeenCalledWith('following');

    fireEvent.click(screen.getByRole('button', { name: /^Unfollow Sam Weber$/ }));
    expect(await screen.findByRole('button', { name: /^Follow Sam Weber$/ })).toBeInTheDocument();
    expect(unfollowUser).toHaveBeenCalledWith(SAM.user_id);
  });

  it('says so when the caller follows nobody', async () => {
    listFollows.mockResolvedValue({ results: [], hasMore: false });
    render(<FollowListModal kind="following" onClose={() => {}} />);
    expect(await screen.findByText('Not following anyone yet.')).toBeInTheDocument();
  });
});

describe('FollowListModal — public profile', () => {
  it("opens the tapped person's passport over the list, and Escape closes only that layer", async () => {
    listFollows.mockResolvedValue({ results: [SAM], hasMore: false });
    const onClose = vi.fn();
    render(<FollowListModal kind="followers" onClose={onClose} />);

    fireEvent.click(await screen.findByRole('button', { name: "View Sam Weber's profile" }));
    expect(screen.getByText(`passport:${SAM.user_id}`)).toBeInTheDocument();

    // The list stays mounted underneath, so closing the passport returns to it.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'close passport' }));
    expect(screen.queryByText(/passport:/)).not.toBeInTheDocument();
    expect(screen.getByText('Sam Weber')).toBeInTheDocument();
    expect(listFollows).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
