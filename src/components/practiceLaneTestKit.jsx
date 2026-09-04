import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PracticeLane from './PracticeLane';

// Render + interaction scaffolding shared by the PracticeLane test files.
// They deliberately stay separate files — one mocks recordEvent to assert the
// call, one runs the real thing to assert the write, one swaps the registry —
// but the render call and the reveal/rate sequence were identical in all three,
// which is what SonarCloud's new-code duplication gate counts.

export const BUNDLED = 'BUNDLED-TAB-CONTENT';

/** Mount the lane with a recognisable stand-in for the tab's own content. */
export function renderLane(props) {
  return render(
    <PracticeLane {...props}>
      <div>{BUNDLED}</div>
    </PracticeLane>
  );
}

/**
 * Reveal a flashcard and rate it. Returns the user-event instance so a caller
 * can keep interacting with the same session.
 */
export async function revealAndRate(rating = 'Got it', user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
  await user.click(screen.getByRole('button', { name: rating }));
  return user;
}
