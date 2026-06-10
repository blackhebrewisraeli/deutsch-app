import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TileExercise from './TileExercise';

const exercise = {
  en: 'I am tired',
  de: 'Ich bin müde',
  words: ['Ich', 'bin', 'müde'],
  distractors: ['Hund'],
  note: 'bin = first person of sein',
};

describe('TileExercise', () => {
  it('renders every word and distractor as a bank tile', () => {
    render(<TileExercise exercise={exercise} level="a1" onCorrect={() => {}} onSkip={() => {}} />);
    for (const w of [...exercise.words, ...exercise.distractors]) {
      expect(screen.getByRole('button', { name: `Add ${w} to answer` })).toBeInTheDocument();
    }
  });

  it('moves a tapped tile from the bank to the answer', async () => {
    render(<TileExercise exercise={exercise} level="a1" onCorrect={() => {}} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Ich to answer' }));
    expect(screen.getByRole('button', { name: 'Remove Ich from answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Ich to answer' })).not.toBeInTheDocument();
  });

  it('returns a tapped answer tile to the bank', async () => {
    render(<TileExercise exercise={exercise} level="a1" onCorrect={() => {}} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add bin to answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove bin from answer' }));
    expect(screen.getByRole('button', { name: 'Add bin to answer' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove bin from answer' })
    ).not.toBeInTheDocument();
  });

  it('disables CHECK while the answer is empty', () => {
    render(<TileExercise exercise={exercise} level="a1" onCorrect={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('button', { name: 'CHECK →' })).toBeDisabled();
  });

  it('calls onCorrect and shows the correct panel for the right order', async () => {
    const onCorrect = vi.fn();
    render(<TileExercise exercise={exercise} level="a1" onCorrect={onCorrect} onSkip={() => {}} />);
    for (const w of exercise.words) {
      await userEvent.click(screen.getByRole('button', { name: `Add ${w} to answer` }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'CHECK →' }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
  });

  it('shows the wrong panel (and no onCorrect) for a wrong assembly', async () => {
    const onCorrect = vi.fn();
    render(<TileExercise exercise={exercise} level="a1" onCorrect={onCorrect} onSkip={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Hund to answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'CHECK →' }));
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
    expect(screen.getByText('Ich bin müde')).toBeInTheDocument();
  });

  it('calls onSkip from the skip button', async () => {
    const onSkip = vi.fn();
    render(<TileExercise exercise={exercise} level="a1" onCorrect={() => {}} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip exercise' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
