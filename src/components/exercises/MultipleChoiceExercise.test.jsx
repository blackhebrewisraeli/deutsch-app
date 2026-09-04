import { describe, it, expect } from 'vitest';
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
