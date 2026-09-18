import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserList from './UserList';

vi.mock('../../lib/adminApi.js', () => ({
  fetchAdminUsers: vi.fn(),
  setUserBlocked: vi.fn(),
}));

import { fetchAdminUsers, setUserBlocked } from '../../lib/adminApi.js';

const ADMIN = {
  userId: 'admin-1',
  email: 'esterkinshimon712@gmail.com',
  handle: 'sys',
  isAdmin: true,
  isSystemAccount: true,
  blockedAt: null,
  providers: ['google'],
};

const REGULAR = {
  userId: 'user-1',
  email: 'blackhebrewisraeli@gmail.com',
  handle: 'sam',
  isAdmin: false,
  isSystemAccount: false,
  blockedAt: null,
  providers: ['email'],
};

describe('UserList', () => {
  beforeEach(() => {
    fetchAdminUsers.mockResolvedValue({ items: [ADMIN, REGULAR] });
    setUserBlocked.mockResolvedValue({ userId: REGULAR.userId, blockedAt: 't' });
  });

  it('is read-only for admin identities', async () => {
    render(<UserList />);
    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();
    expect(screen.getByText(/admin accounts cannot be blocked/i)).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
  });

  it('blocks a regular user after confirm', async () => {
    render(<UserList />);
    await screen.findByText(REGULAR.email);
    await userEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(setUserBlocked).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /confirm block/i }));
    expect(setUserBlocked).toHaveBeenCalledWith(REGULAR.userId, true);
  });
});
