import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COLORS } from '../../lib/theme';

const { isAuthConfigured } = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
}));

vi.mock('../../lib/auth.js', () => ({
  isAuthConfigured,
  signInWithMagicLink: vi.fn(() => Promise.resolve({ error: null })),
  verifyCode: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock('./MagicLinkForm', () => ({
  default: function MockForm({ heading }) {
    return <div data-testid="magic-link-form">{heading}</div>;
  },
}));

import AuthSheet from './AuthSheet';

describe('AuthSheet', () => {
  beforeEach(() => {
    isAuthConfigured.mockReturnValue(true);
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <AuthSheet open={false} intent="signin" onClose={() => {}} onSuccess={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when auth is not configured — even if open', () => {
    isAuthConfigured.mockReturnValue(false);
    const { container } = render(
      <AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the sign-in form when open', () => {
    render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /sign in/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveStyle({ color: COLORS.ink, background: COLORS.paper });
    expect(screen.getByTestId('magic-link-form')).toHaveTextContent('Sign in');
  });

  it('shows create-account heading for create intent', () => {
    render(<AuthSheet open intent="create" onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByRole('dialog', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByTestId('magic-link-form')).toHaveTextContent('Create your account');
  });

  it('dismisses on Escape and via the close button', async () => {
    const onClose = vi.fn();
    render(<AuthSheet open intent="signin" onClose={onClose} onSuccess={() => {}} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /close sign-in/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('dismisses when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<AuthSheet open intent="signin" onClose={onClose} onSuccess={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss sign-in/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
