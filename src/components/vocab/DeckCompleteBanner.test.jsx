import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckCompleteBanner from './DeckCompleteBanner';

describe('DeckCompleteBanner', () => {
  it('reports how many words were learned', () => {
    render(<DeckCompleteBanner learnedCount={7} onPracticeAgain={() => {}} />);
    expect(screen.getByText(/7 words learned/)).toBeInTheDocument();
    expect(screen.queryByText(/🎉/)).not.toBeInTheDocument();
  });

  it('centers the completion copy and the practice-again control', () => {
    const { container } = render(
      <DeckCompleteBanner learnedCount={7} onPracticeAgain={() => {}} />
    );
    expect(container.firstChild).toHaveStyle({
      justifyContent: 'center',
      textAlign: 'center',
    });
  });

  it('requests another practice round', async () => {
    const onPracticeAgain = vi.fn();
    render(<DeckCompleteBanner learnedCount={3} onPracticeAgain={onPracticeAgain} />);
    await userEvent.click(screen.getByRole('button', { name: 'PRACTICE AGAIN' }));
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
  });
});
