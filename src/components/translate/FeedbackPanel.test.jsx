import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackPanel from './FeedbackPanel';

describe('FeedbackPanel', () => {
  it('renders the correct variant without repeating the answer', () => {
    render(
      <FeedbackPanel verdict="correct" correctText="Ich bin müde" note="Nice." onNext={() => {}} />
    );
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
    // Fully correct → the canonical answer is not echoed back.
    expect(screen.queryByText('Ich bin müde')).not.toBeInTheDocument();
    expect(screen.getByText('Nice.')).toBeInTheDocument();
  });

  it('renders the almost variant with the canonical answer', () => {
    render(
      <FeedbackPanel verdict="almost" correctText="Ich bin müde" note="Typo." onNext={() => {}} />
    );
    expect(screen.getByText('≈ ALMOST')).toBeInTheDocument();
    expect(screen.getByText('Ich bin müde')).toBeInTheDocument();
  });

  it('renders the wrong variant with the canonical answer', () => {
    render(<FeedbackPanel verdict="wrong" correctText="Ich bin müde" onNext={() => {}} />);
    expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
    expect(screen.getByText('Ich bin müde')).toBeInTheDocument();
  });

  it('omits the note line when no note is given', () => {
    const { container } = render(
      <FeedbackPanel verdict="wrong" correctText="Ich bin müde" onNext={() => {}} />
    );
    expect(container.querySelector('[style*="italic"]')).not.toBeInTheDocument();
  });

  it('calls onNext from the next button', async () => {
    const onNext = vi.fn();
    render(<FeedbackPanel verdict="correct" onNext={onNext} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
