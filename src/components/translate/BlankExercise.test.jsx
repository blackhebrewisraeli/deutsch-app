import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlankExercise from './BlankExercise';

const exercise = {
  en: 'I am tired',
  de: 'Ich bin müde',
  template: 'Ich ___ müde',
  blanks: [{ word: 'bin', distractors: ['ist', 'sind'] }],
  note: 'bin = first person of sein',
};

describe('BlankExercise', () => {
  it('renders the template with an empty, disabled blank and the word bank', () => {
    render(<BlankExercise exercise={exercise} level="a2" onCorrect={() => {}} onSkip={() => {}} />);
    const blank = screen.getByRole('button', { name: 'Blank 1 is empty' });
    expect(blank).toBeDisabled();
    expect(blank).toHaveTextContent('___');
    for (const w of ['bin', 'ist', 'sind']) {
      expect(screen.getByRole('button', { name: `Use ${w} for next blank` })).toBeInTheDocument();
    }
  });

  it('fills the next blank with the tapped option and removes it from the bank', async () => {
    render(<BlankExercise exercise={exercise} level="a2" onCorrect={() => {}} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use bin for next blank' }));
    const filled = screen.getByRole('button', { name: 'Clear blank 1' });
    expect(filled).toHaveTextContent('bin');
    expect(
      screen.queryByRole('button', { name: 'Use bin for next blank' })
    ).not.toBeInTheDocument();
  });

  it('returns the word to the bank when the filled blank is tapped', async () => {
    render(<BlankExercise exercise={exercise} level="a2" onCorrect={() => {}} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use ist for next blank' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear blank 1' }));
    expect(screen.getByRole('button', { name: 'Use ist for next blank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blank 1 is empty' })).toBeInTheDocument();
  });

  it('disables CHECK until every blank is filled', async () => {
    render(<BlankExercise exercise={exercise} level="a2" onCorrect={() => {}} onSkip={() => {}} />);
    const check = screen.getByRole('button', { name: 'CHECK →' });
    expect(check).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Use bin for next blank' }));
    expect(check).toBeEnabled();
  });

  it('calls onCorrect and shows the correct panel for the right word', async () => {
    const onCorrect = vi.fn();
    render(
      <BlankExercise exercise={exercise} level="a2" onCorrect={onCorrect} onSkip={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use bin for next blank' }));
    await userEvent.click(screen.getByRole('button', { name: 'CHECK →' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
  });

  it('shows the wrong panel with the full sentence for a wrong word', async () => {
    const onCorrect = vi.fn();
    render(
      <BlankExercise exercise={exercise} level="a2" onCorrect={onCorrect} onSkip={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use ist for next blank' }));
    await userEvent.click(screen.getByRole('button', { name: 'CHECK →' }));
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
    expect(screen.getByText('Ich bin müde')).toBeInTheDocument();
  });

  it('accepts a word that matches after pack normalization (case-insensitive)', async () => {
    const onCorrect = vi.fn();
    const cased = {
      en: 'I am tired',
      de: 'Ich bin müde',
      template: 'Ich ___ müde',
      blanks: [{ word: 'bin', distractors: ['Bin'] }],
    };
    render(<BlankExercise exercise={cased} level="a2" onCorrect={onCorrect} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use Bin for next blank' }));
    await userEvent.click(screen.getByRole('button', { name: 'CHECK →' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
  });

  it('fills blanks in order for a two-blank template', async () => {
    const twoBlanks = {
      en: 'I am very tired',
      de: 'Ich bin sehr müde',
      template: 'Ich ___ sehr ___',
      blanks: [
        { word: 'bin', distractors: [] },
        { word: 'müde', distractors: [] },
      ],
    };
    render(
      <BlankExercise exercise={twoBlanks} level="a2" onCorrect={() => {}} onSkip={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use bin for next blank' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use müde for next blank' }));
    expect(screen.getByRole('button', { name: 'Clear blank 1' })).toHaveTextContent('bin');
    expect(screen.getByRole('button', { name: 'Clear blank 2' })).toHaveTextContent('müde');
  });

  it('calls onSkip from the skip button', async () => {
    const onSkip = vi.fn();
    render(<BlankExercise exercise={exercise} level="a2" onCorrect={() => {}} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip exercise' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
