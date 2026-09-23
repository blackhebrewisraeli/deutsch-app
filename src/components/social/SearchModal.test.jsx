import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/social.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchUsers: vi.fn(),
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
});
