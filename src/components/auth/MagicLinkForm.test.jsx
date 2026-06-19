import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted() ensures these vi.fn() values are available when vi.mock() factory
// runs (vi.mock is hoisted to the top of the file by Vitest's transform, but
// const declarations in the same file would still be in the TDZ at that point).
const { signInWithMagicLink, verifyCode } = vi.hoisted(() => ({
  signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
  verifyCode: vi.fn(() => Promise.resolve({ error: null })),
}));
vi.mock('../../lib/auth.js', () => ({ signInWithMagicLink, verifyCode }));

import MagicLinkForm from './MagicLinkForm';

describe('MagicLinkForm', () => {
  beforeEach(() => {
    signInWithMagicLink.mockClear();
    verifyCode.mockClear();
  });

  it('sends a link and moves to the inbox state', async () => {
    render(<MagicLinkForm heading="Sign in" onSuccess={() => {}} />);
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(signInWithMagicLink).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it('verifies a typed 6-digit code and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<MagicLinkForm heading="Sign in" onSuccess={onSuccess} />);
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await userEvent.type(await screen.findByRole('textbox', { name: /code/i }), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(verifyCode).toHaveBeenCalledWith('a@b.com', '123456');
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('surfaces a send error', async () => {
    signInWithMagicLink.mockResolvedValueOnce({ error: { message: 'Too many attempts' } });
    render(<MagicLinkForm heading="Sign in" onSuccess={() => {}} />);
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it('surfaces a verify error', async () => {
    verifyCode.mockResolvedValueOnce({ error: { message: 'Invalid code' } });
    render(<MagicLinkForm heading="Sign in" onSuccess={() => {}} />);
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await userEvent.type(await screen.findByRole('textbox', { name: /code/i }), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(await screen.findByText(/invalid code/i)).toBeInTheDocument();
  });
});
