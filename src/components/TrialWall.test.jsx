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

  it('ignores Escape — the wall is not dismissible', async () => {
    const user = userEvent.setup();
    const { onCreateAccount, onSignIn } = setup();
    await user.keyboard('{Escape}');
    expect(onCreateAccount).not.toHaveBeenCalled();
    expect(onSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save your progress' })).toBeInTheDocument();
  });
});
