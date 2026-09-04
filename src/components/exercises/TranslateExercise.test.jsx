import { describe, it, expect } from 'vitest';
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
