import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrialWall from './TrialWall';

function setup(props = {}) {
  const onCreateAccount = vi.fn();
  const onSignIn = vi.fn();
  render(
    <TrialWall roundsUsed={12} onCreateAccount={onCreateAccount} onSignIn={onSignIn} {...props} />
  );
  return { onCreateAccount, onSignIn };
}

describe('TrialWall', () => {
  it('renders the spec copy', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Save your progress' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create a free account to keep going — every round you've practised comes with you."
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Your stats stay open — tap Stats below.')).toBeInTheDocument();
  });

  it('is a labelled dialog that does not claim to be modal', () => {
    setup();
    const wall = screen.getByRole('dialog', { name: 'Save your progress' });
    // The header and nav stay operable, so aria-modal would be a lie.
    expect(wall).not.toHaveAttribute('aria-modal');
  });

  it('reports the rounds practised, pluralised', () => {
    const { unmount } = render(<TrialWall roundsUsed={12} />);
    expect(screen.getByText('12 rounds practised')).toBeInTheDocument();
    unmount();
    render(<TrialWall roundsUsed={1} />);
    expect(screen.getByText('1 round practised')).toBeInTheDocument();
  });

  it('fires onCreateAccount from the primary CTA', async () => {
    const user = userEvent.setup();
    const { onCreateAccount, onSignIn } = setup();
    await user.click(screen.getByRole('button', { name: 'Create a free account' }));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('fires onSignIn from the secondary CTA', async () => {
    const user = userEvent.setup();
    const { onCreateAccount, onSignIn } = setup();
    await user.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).not.toHaveBeenCalled();
  });

  it('moves focus to the primary CTA on mount', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Create a free account' })).toHaveFocus();
  });

  it('has no dismiss affordance', () => {
    setup();
    // Exactly the two CTAs — a close button would be a way out of the wall.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  // Regression: the scrim first shipped at z-index 60, above App's sticky
  // header (50) and nav (49). It looked right at scroll 0 — the practice
  // surface starts below both — but the moment the page scrolled, the scrim
  // painted straight over the chrome and swallowed the Stats tab, which is
  // the wall's own escape hatch.
  it('sits below the sticky header and nav so the chrome stays clickable', () => {
    setup();
    const scrim = screen.getByRole('dialog', { name: 'Save your progress' });
    expect(Number(scrim.style.zIndex)).toBeLessThan(49);
  });

  // The practice surface runs well past the fold, so a centred card lands
  // below it on a phone. Top-aligned + sticky keeps it on screen.
  it('keeps the card at the top of the surface rather than centring it', () => {
    setup();
    const scrim = screen.getByRole('dialog', { name: 'Save your progress' });
    expect(scrim.style.alignItems).toBe('flex-start');
    expect(scrim.firstElementChild.style.position).toBe('sticky');
  });

  it('ignores Escape — the wall is not dismissible', async () => {
    const user = userEvent.setup();
    const { onCreateAccount, onSignIn } = setup();
    await user.keyboard('{Escape}');
    expect(onCreateAccount).not.toHaveBeenCalled();
    expect(onSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save your progress' })).toBeInTheDocument();
  });
});
