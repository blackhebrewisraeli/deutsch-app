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

  it('grades the chosen option against payload.answer', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<MultipleChoiceExercise payload={payload} onGraded={onGraded} />);
    await user.click(screen.getByRole('button', { name: 'wie ss' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onGraded).toHaveBeenCalledWith('correct');
  });

  it('reports wrong for the wrong option', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<MultipleChoiceExercise payload={payload} onGraded={onGraded} />);
    await user.click(screen.getByRole('button', { name: 'wie z' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onGraded).toHaveBeenCalledWith('wrong');
  });

  it('stays ungraded when the payload carries no answer — a seed without one must not score', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    const { answer: _answer, ...noAnswer } = payload;
    render(<MultipleChoiceExercise payload={noAnswer} onGraded={onGraded} />);
    await user.click(screen.getByRole('button', { name: 'wie ss' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onGraded).not.toHaveBeenCalled();
  });

  it('grades once — Submit is spent after the first press', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(<MultipleChoiceExercise payload={payload} onGraded={onGraded} />);
    await user.click(screen.getByRole('button', { name: 'wie ss' }));
    const submit = screen.getByRole('button', { name: 'Submit' });
    await user.click(submit);
    await user.click(submit);
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
