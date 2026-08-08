import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COLORS } from '../../lib/theme';

const { isAuthConfigured, isGoogleAuthConfigured, signInWithGoogle } = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  isGoogleAuthConfigured: vi.fn(() => false),
  signInWithGoogle: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock('../../lib/auth.js', () => ({
  isAuthConfigured,
  isGoogleAuthConfigured,
  signInWithGoogle,
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
    // Flag off is the merge state and the one CI runs.
    isGoogleAuthConfigured.mockReturnValue(false);
    signInWithGoogle.mockClear();
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

  // Flag off is what merges and what CI runs, so it is asserted as hard as the
  // flag-on path: the sheet must be exactly what shipped in #93/#94.
  describe('with Google off', () => {
    it('offers no Google button and no divider', () => {
      render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} />);
      expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
      // A bare "or" left behind would change the sheet in the very state that
      // has to stay identical.
      expect(screen.queryByText(/^or$/i)).toBeNull();
      expect(screen.getByTestId('magic-link-form')).toBeInTheDocument();
    });

    it('never starts a Google flow', async () => {
      render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /close sign-in/i }));
      expect(signInWithGoogle).not.toHaveBeenCalled();
    });
  });

  describe('with Google on', () => {
    beforeEach(() => isGoogleAuthConfigured.mockReturnValue(true));

    it('puts Google above the email form, separated by an "or" divider', () => {
      render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} />);
      const google = screen.getByRole('button', { name: /continue with google/i });
      const form = screen.getByTestId('magic-link-form');
      expect(google).toBeInTheDocument();
      expect(screen.getByText(/^or$/i)).toBeInTheDocument();
      // Google is primary, so it comes first in the DOM and in the tab order.
      expect(google.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('routes the button to the handler App passes, not its own call', async () => {
      const onGoogle = vi.fn();
      render(
        <AuthSheet
          open
          intent="signin"
          onClose={() => {}}
          onSuccess={() => {}}
          onGoogle={onGoogle}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
      expect(onGoogle).toHaveBeenCalledTimes(1);
    });

    it('disables the button while a redirect is already in flight', () => {
      render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} googleBusy />);
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
    });

    it('keeps the email form intact — it gains a sibling, not a rewrite', () => {
      render(<AuthSheet open intent="create" onClose={() => {}} onSuccess={() => {}} />);
      expect(screen.getByTestId('magic-link-form')).toHaveTextContent('Create your account');
    });
  });
});
