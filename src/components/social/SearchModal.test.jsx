import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/social.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchUsers: vi.fn(),
}));

vi.mock('../stats/ProfileCard', () => ({
  default: ({ userId }) => <div>passport:{userId}</div>,
}));

import SearchModal from './SearchModal';
import { searchUsers } from '../../lib/social.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SearchModal', () => {
  it('opens as a labelled dialog holding the search box', () => {
    searchUsers.mockResolvedValue([]);
    render(<SearchModal onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Search people' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SearchModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens a result's public passport over the search", async () => {
    searchUsers.mockResolvedValue([
      { user_id: 'u-1', handle: 'sam_de', display_name: 'Sam', is_following: false },
    ]);
    const onClose = vi.fn();
    render(<SearchModal onClose={onClose} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sam' } });

    fireEvent.click(
      await screen.findByRole('button', { name: "View Sam's profile" }, { timeout: 2000 })
    );
    expect(screen.getByText('passport:u-1')).toBeInTheDocument();
    // Search is disarmed underneath: Escape belongs to the passport.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
