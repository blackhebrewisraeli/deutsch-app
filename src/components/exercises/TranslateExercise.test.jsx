import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TranslateExercise from './TranslateExercise';
import { SPACE } from '../../lib/theme';

const PAYLOAD = {
  prompt: 'Good morning',
  accepted: ['Guten Morgen', 'Morgen'],
  direction: 'en-de',
};

describe('TranslateExercise', () => {
  it('shows the prompt and direction, and keeps accepted answers hidden', () => {
    render(<TranslateExercise type="translate" payload={PAYLOAD} />);
    expect(screen.getByText('Good morning')).toBeInTheDocument();
    expect(screen.getByText('en-de')).toBeInTheDocument();
    expect(screen.queryByText('Guten Morgen')).not.toBeInTheDocument();
  });

  it('reveals accepted answers when the stub check is tapped', async () => {
    render(<TranslateExercise type="translate" payload={PAYLOAD} />);
    await userEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText('Guten Morgen')).toBeInTheDocument();
    expect(screen.getByText('Morgen')).toBeInTheDocument();
  });

  it('uses a full-width thumb-sized check control', () => {
    render(<TranslateExercise type="translate" payload={PAYLOAD} />);
    const check = screen.getByRole('button', { name: /check/i });
    expect(check).toHaveStyle({ width: '100%', minHeight: `${SPACE[12]}px` });
  });

  it('tolerates a missing payload without throwing', () => {
    render(<TranslateExercise type="translate" />);
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
  });
});

describe('TranslateExercise — grading (E5.5)', () => {
  const payload = {
    prompt: 'Good morning',
    accepted: ['Guten Morgen'],
    direction: 'en-de',
  };

  /** Type an answer, press Check, and report what the exercise graded it. */
  async function answer(typed, over = {}) {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<TranslateExercise payload={{ ...payload, ...over }} onGraded={onGraded} />);
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), typed);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    return { onGraded, user };
  }

  it.each([
    ['an exact answer', 'Guten Morgen', {}, 'correct'],
    ['a one-typo near miss', 'Guten Morgn', {}, 'almost'],
    ['an unrelated answer', 'Auf Wiedersehen', {}, 'wrong'],
    // Grading only accepted[0] is the bug that made the meaning drill mark real
    // answers wrong; a second listed answer must count as fully correct.
    [
      'ANY listed answer, not just the first',
      'Mein Name ist Anna',
      { accepted: ['Ich heiße Anna', 'Mein Name ist Anna'] },
      'correct',
    ],
  ])('grades %s as %s', async (_label, typed, over, verdict) => {
    const { onGraded } = await answer(typed, over);
    expect(onGraded).toHaveBeenCalledWith(verdict);
  });

  it('grades once, and reveals the accepted answers after checking', async () => {
    const { onGraded, user } = await answer('Guten Morgen');
    expect(screen.getByText('Guten Morgen', { selector: 'li *, li' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGraded).toHaveBeenCalledTimes(1);
  });

  it('does not reveal the answer before the learner commits one', () => {
    render(<TranslateExercise payload={payload} onGraded={() => {}} />);
    // The reveal used to be a bare toggle. With grading attached, showing the
    // answer first would let anyone bank `correct` for free.
    expect(screen.queryByText('Guten Morgen')).not.toBeInTheDocument();
  });

  it('without a listener it stays the presentation-only reveal it was', async () => {
    const user = userEvent.setup();
    render(<TranslateExercise payload={payload} />);
    expect(screen.queryByRole('textbox', { name: 'Your answer' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Guten Morgen')).toBeInTheDocument();
  });
});
