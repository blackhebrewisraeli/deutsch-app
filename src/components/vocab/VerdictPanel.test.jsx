import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerdictPanel from './VerdictPanel';

describe('VerdictPanel', () => {
  it('offers only AGAIN after a wrong answer', () => {
    // Grading how well you knew something you did not know is meaningless.
    render(<VerdictPanel result="wrong" answer="bread" onVerdict={() => {}} />);
    expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AGAIN/ })).toBeInTheDocument();
    for (const name of ['HARD', 'GOOD', 'EASY']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('offers the three Leitner verdicts after a correct answer', () => {
    render(<VerdictPanel result="correct" answer="bread" onVerdict={() => {}} />);
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
    for (const name of ['HARD', 'GOOD', 'EASY']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /AGAIN/ })).not.toBeInTheDocument();
  });

  it('treats almost as gradeable and flags the spelling', () => {
    render(<VerdictPanel result="almost" answer="bread" onVerdict={() => {}} />);
    expect(screen.getByText('≈ ALMOST — CHECK SPELLING')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GOOD' })).toBeInTheDocument();
  });

  it('centers the verdict and the answer', () => {
    const { container } = render(
      <VerdictPanel result="correct" answer="bread" onVerdict={() => {}} />
    );
    expect(container.firstChild).toHaveStyle({
      textAlign: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('always shows the answer, whatever the verdict', () => {
    for (const result of ['correct', 'almost', 'wrong']) {
      const { unmount } = render(
        <VerdictPanel result={result} answer="bread" onVerdict={() => {}} />
      );
      expect(screen.getByText('bread')).toBeInTheDocument();
      unmount();
    }
  });

  it('reports the verdict it was clicked with', async () => {
    const onVerdict = vi.fn();
    render(<VerdictPanel result="correct" answer="bread" onVerdict={onVerdict} />);
    await userEvent.click(screen.getByRole('button', { name: 'EASY' }));
    expect(onVerdict).toHaveBeenCalledWith('easy');
  });
});
