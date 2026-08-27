import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

    // This used to assert toBeDisabled(). A disabled element leaves the tab
    // order, and inside a focus-trapped sheet that is worse than elsewhere: the
    // trap's first stop disappears mid-action. Button's `busy` blocks the click
    // without disabling — see GoogleButton.test.jsx.
    it('marks the button busy while a redirect is already in flight, without disabling it', () => {
      render(<AuthSheet open intent="signin" onClose={() => {}} onSuccess={() => {}} googleBusy />);
      const button = screen.getByRole('button', { name: /continue with google/i });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).not.toBeDisabled();
    });

    it('keeps the email form intact — it gains a sibling, not a rewrite', () => {
      render(<AuthSheet open intent="create" onClose={() => {}} onSuccess={() => {}} />);
      expect(screen.getByTestId('magic-link-form')).toHaveTextContent('Create your account');
    });
  });

  // ── Keyboard loop ──────────────────────────────────────────
  // The sheet claims `aria-modal="true"` and lays a scrim over the page, so it
  // asserts to assistive tech that nothing behind it is reachable. It was not
  // keeping that promise: Tab walked straight out into the page under the
  // scrim, and closing dropped focus to <body> rather than returning it to
  // whichever of the five triggers opened the sheet.
  //
  // Run under BOTH Google configurations. The rest of this file runs with the
  // flag off — "the merge state and the one CI runs" — but production runs with
  // it on, and that difference is not cosmetic: GoogleButton's `autoFocus`
  // fires during React's commit, ahead of this component's effects, which is
  // exactly what broke focus-restore in production while every test was green.
  // Testing focus-in under one flag and focus-return under the other left the
  // combination that ships completely uncovered.
  describe.each([
    ['Google off', false],
    ['Google on', true],
  ])('keyboard loop — %s', (_label, googleOn) => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Sign in trigger
          </button>
          <AuthSheet
            open={open}
            intent="signin"
            onClose={() => setOpen(false)}
            onSuccess={() => {}}
          />
        </>
      );
    }

    beforeEach(() => {
      isGoogleAuthConfigured.mockReturnValue(googleOn);
    });

    const openSheet = async (user) => {
      const trigger = screen.getByRole('button', { name: 'Sign in trigger' });
      await user.click(trigger);
      return { trigger, dialog: await screen.findByRole('dialog') };
    };

    it('moves focus into the sheet when it opens', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const { dialog } = await openSheet(user);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // Starts from the LAST control INSIDE the sheet. Tabbing from the trigger
    // instead passes by DOM-order coincidence — it lands on the close button,
    // which happens to be inside the dialog.
    it('wraps Tab from the last control back into the sheet', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const { dialog } = await openSheet(user);

      const stops = dialog.querySelectorAll('a[href], button, input, select, textarea');
      expect(stops.length).toBeGreaterThan(0);
      stops[stops.length - 1].focus();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('wraps Shift+Tab from the first control back into the sheet', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const { dialog } = await openSheet(user);

      dialog.querySelector('button').focus();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // The one that shipped broken. With Google ON, autoFocus takes focus during
    // the commit, so an effect-time read of document.activeElement captures the
    // Google button rather than the trigger — and on close that node is gone,
    // so the restore silently skipped and focus fell to <body>.
    it('returns focus to the trigger on close', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const { trigger, dialog } = await openSheet(user);

      dialog.querySelector('button').focus();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.activeElement).toBe(trigger);
    });

    // The scrim is a pointer affordance that duplicates the labelled "Close
    // sign-in" button, and `aria-modal` already hides it from assistive tech.
    // Leaving it in the tab order gave keyboard users a stop that screen
    // readers cannot announce.
    it('does not put the scrim in the tab order', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openSheet(user);
      const scrim = screen.queryByRole('button', { name: /dismiss sign-in/i });
      expect(scrim === null || scrim.tabIndex === -1).toBe(true);
    });
  });

  // Guards the OTHER direction, and only makes sense with the flag on: with
  // Google configured, GoogleButton's autoFocus already lands focus on the
  // primary action. Moving focus to the sheet unconditionally would take it
  // away and bury the main affordance.
  describe('autoFocus', () => {
    it('leaves the primary action focused when Google is configured', async () => {
      isGoogleAuthConfigured.mockReturnValue(true);
      const user = userEvent.setup();
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Sign in trigger
            </button>
            <AuthSheet
              open={open}
              intent="signin"
              onClose={() => setOpen(false)}
              onSuccess={() => {}}
            />
          </>
        );
      }
      render(<Harness />);
      await user.click(screen.getByRole('button', { name: 'Sign in trigger' }));
      expect(screen.getByRole('button', { name: /continue with google/i })).toHaveFocus();
    });
  });
});
