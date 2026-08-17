import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { isGoogleAuthConfigured } = vi.hoisted(() => ({
  isGoogleAuthConfigured: vi.fn(() => false),
}));
// Auth is configured in this test so the auth buttons render.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true, isGoogleAuthConfigured }));
import WelcomeGate from './WelcomeGate';

describe('WelcomeGate', () => {
  beforeEach(() => {
    // Flag off is the merge state and the one CI runs.
    isGoogleAuthConfigured.mockReturnValue(false);
  });

  // The guest path is now a bounded trial, so the gate says so up front — a
  // wall later is only fair if the door promised a trial, not a free ride.
  it('routes the guest path, offered as a trial', async () => {
    const onGuest = vi.fn();
    render(<WelcomeGate onGuest={onGuest} onAuth={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try it first — free →' }));
    expect(onGuest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/continue without an account/i)).not.toBeInTheDocument();
  });

  it('routes create / sign-in to the auth callback with the right intent', async () => {
    const onAuth = vi.fn();
    render(<WelcomeGate onGuest={() => {}} onAuth={onAuth} />);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(onAuth).toHaveBeenCalledWith('create');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(onAuth).toHaveBeenCalledWith('signin');
  });

  it('offers no Google button while the flag is off', () => {
    render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} />);
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    // Today's exact rendering: create, sign in, guest link — nothing else.
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try it first — free →' })).toBeInTheDocument();
  });

  describe('with Google on', () => {
    beforeEach(() => isGoogleAuthConfigured.mockReturnValue(true));

    it('makes Google the top action, above create and sign in', () => {
      render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} />);
      const google = screen.getByRole('button', { name: /continue with google/i });
      const create = screen.getByRole('button', { name: /create account/i });
      expect(google.compareDocumentPosition(create)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    // The guest link is the trial's front door — Google must not displace it.
    it('leaves the guest trial link exactly where it was', () => {
      const onGuest = vi.fn();
      render(<WelcomeGate onGuest={onGuest} onAuth={() => {}} />);
      const guest = screen.getByRole('button', { name: 'Try it first — free →' });
      const google = screen.getByRole('button', { name: /continue with google/i });
      expect(google.compareDocumentPosition(guest)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('routes to the handler App passes', async () => {
      const onGoogle = vi.fn();
      render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} onGoogle={onGoogle} />);
      await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
      expect(onGoogle).toHaveBeenCalledTimes(1);
    });

    it('disables the button while a redirect is in flight', () => {
      render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} googleBusy />);
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
    });
  });

  // The bug this guards: background painted with COLORS.ink (var(--c-fg)) makes
  // the gate the exact inverse of the app — a light-mode machine gets a dark
  // gate. Asserted negatively, because "background is some token" passes
  // against the broken version too.
  it('takes its background from the ground token, not the foreground one', () => {
    const { container } = render(<WelcomeGate onGuest={() => {}} onAuth={() => {}} />);
    const screenEl = container.firstChild;
    expect(screenEl.style.background).toBe('var(--c-ground)');
    expect(screenEl.style.background).not.toBe('var(--c-fg)');
    expect(screenEl.style.color).toBe('var(--c-fg)');
  });
});
