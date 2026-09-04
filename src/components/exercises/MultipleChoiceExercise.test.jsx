import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultipleChoiceExercise from './MultipleChoiceExercise';
import { SPACE } from '../../lib/theme';

const PAYLOAD = {
  question: 'What is the article for Haus?',
  options: ['der', 'die', 'das'],
};

describe('MultipleChoiceExercise', () => {
  it('shows the question and every option, with none selected', () => {
    render(<MultipleChoiceExercise type="multiple-choice" payload={PAYLOAD} />);
    expect(
      screen.getByRole('heading', { name: 'What is the article for Haus?' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'der' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'die' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'das' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks the tapped option as selected and leaves the others unpressed', async () => {
    render(<MultipleChoiceExercise type="multiple-choice" payload={PAYLOAD} />);
    await userEvent.click(screen.getByRole('button', { name: 'das' }));
    expect(screen.getByRole('button', { name: 'das' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'der' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'die' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps Submit disabled until an option is chosen, then confirms locally', async () => {
    render(<MultipleChoiceExercise type="multiple-choice" payload={PAYLOAD} />);
    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'das' }));
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent(/das/i);
  });

  it('uses thumb-sized touch targets on every option and the submit action', () => {
    render(<MultipleChoiceExercise type="multiple-choice" payload={PAYLOAD} />);
    for (const name of ['der', 'die', 'das', /submit/i]) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        width: '100%',
        minHeight: `${SPACE[12]}px`,
      });
    }
  });

  it('keeps the submit action clear of the home indicator', () => {
    render(<MultipleChoiceExercise type="multiple-choice" payload={PAYLOAD} />);
    expect(screen.getByRole('button', { name: /submit/i }).style.marginBottom).toContain(
      'safe-area-inset-bottom'
    );
  });

  it('lets a long option break instead of widening the page', () => {
    render(
      <MultipleChoiceExercise
        type="multiple-choice"
        payload={{
          question: 'Pick one',
          options: ['Donaudampfschifffahrtsgesellschaftskapitän'],
        }}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Donaudampfschifffahrtsgesellschaftskapitän' })
    ).toHaveStyle({
      overflowWrap: 'anywhere',
      maxWidth: '100%',
    });
  });

  it('accepts the spec aliases prompt and choices', () => {
    render(
      <MultipleChoiceExercise
        type="multiple-choice"
        payload={{ prompt: 'Choose the greeting', choices: ['Hallo', 'Tschüss'] }}
      />
    );
    expect(screen.getByRole('heading', { name: 'Choose the greeting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hallo' })).toBeInTheDocument();
  });

  it('tolerates a missing or empty payload without throwing', () => {
    render(<MultipleChoiceExercise type="multiple-choice" />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });
});

describe('MultipleChoiceExercise — grading (E5.5)', () => {
  const payload = {
    question: 'Wie klingt »ß«?',
    choices: ['wie ss', 'wie z', 'wie sch'],
    answer: 'wie ss',
  };

  /** Pick an option, submit, and report what the exercise graded it. */
  async function choose(option, over = {}) {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<MultipleChoiceExercise payload={{ ...payload, ...over }} onGraded={onGraded} />);
    await user.click(screen.getByRole('button', { name: option }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    return { onGraded, user };
  }

  it.each([
    ['the right option', 'wie ss', 'correct'],
    ['a wrong option', 'wie z', 'wrong'],
  ])('grades %s as %s', async (_label, option, verdict) => {
    const { onGraded } = await choose(option);
    expect(onGraded).toHaveBeenCalledWith(verdict);
  });

  it('stays ungraded when the payload carries no answer', async () => {
    // A seed written before grading existed must not silently bank `wrong` for
    // every learner over a content omission.
    const { answer: _answer, ...noAnswer } = payload;
    const { onGraded } = await choose('wie ss', { ...noAnswer, answer: undefined });
    expect(onGraded).not.toHaveBeenCalled();
  });

  it('grades once — Submit is spent after the first press', async () => {
    const { onGraded, user } = await choose('wie ss');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onGraded).toHaveBeenCalledTimes(1);
  });

  it('never leaks which option is right before submitting', () => {
    render(<MultipleChoiceExercise payload={payload} onGraded={() => {}} />);
    // The drills have leaked their own answer twice before (see the CardFace
    // note): assert the correct option is not singled out by any attribute.
    const right = screen.getByRole('button', { name: 'wie ss' });
    const wrong = screen.getByRole('button', { name: 'wie z' });
    expect(right.getAttribute('aria-pressed')).toBe(wrong.getAttribute('aria-pressed'));
    expect(right.className).toBe(wrong.className);
    expect(document.body.textContent).not.toMatch(/correct|richtig/i);
  });
});
