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

  it('grades an exact answer correct', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<TranslateExercise payload={payload} onGraded={onGraded} />);
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Guten Morgen');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGraded).toHaveBeenCalledWith('correct');
  });

  it('grades a near miss "almost", not wrong', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<TranslateExercise payload={payload} onGraded={onGraded} />);
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Guten Morgn');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGraded).toHaveBeenCalledWith('almost');
  });

  it('grades an unrelated answer wrong', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<TranslateExercise payload={payload} onGraded={onGraded} />);
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Auf Wiedersehen');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGraded).toHaveBeenCalledWith('wrong');
  });

  it('accepts ANY listed answer, not just the first', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(
      <TranslateExercise
        payload={{ ...payload, accepted: ['Ich heiße Anna', 'Mein Name ist Anna'] }}
        onGraded={onGraded}
      />
    );
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Mein Name ist Anna');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGraded).toHaveBeenCalledWith('correct');
  });

  it('grades once, and reveals the accepted answers after checking', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<TranslateExercise payload={payload} onGraded={onGraded} />);
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Guten Morgen');
    const check = screen.getByRole('button', { name: 'Check' });
    await user.click(check);
    expect(screen.getByText('Guten Morgen', { selector: 'li *, li' })).toBeInTheDocument();
    await user.click(check);
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
