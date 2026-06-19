import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Auth is configured in this test so the auth buttons render.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));
import WelcomeGate from './WelcomeGate';

describe('WelcomeGate', () => {
  it('routes the guest path', async () => {
    const onGuest = vi.fn();
    render(<WelcomeGate onGuest={onGuest} onAuth={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /continue without an account/i }));
    expect(onGuest).toHaveBeenCalledTimes(1);
  });

  it('routes create / sign-in to the auth callback with the right intent', async () => {
    const onAuth = vi.fn();
    render(<WelcomeGate onGuest={() => {}} onAuth={onAuth} />);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(onAuth).toHaveBeenCalledWith('create');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(onAuth).toHaveBeenCalledWith('signin');
  });
});
