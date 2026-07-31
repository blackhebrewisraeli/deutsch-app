import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

  it('offers a resend in the inbox state and re-requests the link', async () => {
    render(<MagicLinkForm heading="Sign in" onSuccess={() => {}} />);
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    // Wait for inbox state
    await screen.findByText(/check your inbox/i);
    // Resend button should be visible
    const resendBtn = screen.getByRole('button', { name: /resend/i });
    expect(resendBtn).toBeInTheDocument();
    // Click resend — second call to signInWithMagicLink
    await userEvent.click(resendBtn);
    expect(signInWithMagicLink).toHaveBeenCalledTimes(2);
    expect(signInWithMagicLink).toHaveBeenLastCalledWith('a@b.com');
  });

  it('disables resend during the cooldown then re-enables it', async () => {
    // Use real userEvent for setup interactions (reach inbox state),
    // then install fake timers to control the 30-second cooldown interval.
    render(<MagicLinkForm heading="Sign in" onSuccess={() => {}} />);

    // Reach inbox state with real timers so userEvent works normally.
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText(/check your inbox/i);

    // Install fake timers before triggering the cooldown interval.
    vi.useFakeTimers();

    // Click resend inside async act so React flushes all state updates
    // (including setBusy(false) and startCooldown(30)) after the mock promise resolves.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /resend email/i }));
    });

    // Button should be disabled immediately with countdown label.
    expect(screen.getByRole('button', { name: /resend in/i })).toBeDisabled();

    // Advance fake timers through the full 30-second cooldown inside act
    // so React flushes all the setResendCooldown state updates.
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Restore real timers before asserting (so synchronous checks work cleanly).
    vi.useRealTimers();

    // Button should be re-enabled — no waitFor needed since act() already flushed.
    expect(screen.getByRole('button', { name: /resend email/i })).not.toBeDisabled();
  });
});
