import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnknownExercise from './UnknownExercise';

describe('UnknownExercise', () => {
  it('tells the learner this type cannot be shown, without crashing', () => {
    render(<UnknownExercise type="hologram" payload={{}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/not available/i);
    expect(screen.getByText('hologram')).toBeInTheDocument();
  });

  it('still renders when type is missing', () => {
    render(<UnknownExercise payload={{}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
