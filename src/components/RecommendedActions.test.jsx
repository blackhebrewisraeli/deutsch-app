import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecommendedActions from './RecommendedActions';
import { resolveRecommended } from './resolveRecommended';

describe('resolveRecommended', () => {
  it('promotes the first two missions that have pack copy', () => {
    const missions = [
      { id: 'srs-due', count: 5, tab: 'vocab', priority: 0 },
      { id: 'goal-remaining', count: 20, tab: 'chat', priority: 2 },
      { id: 'revisit-wrong', count: 3, tab: 'translate', priority: 3 },
    ];
    const { cards, remaining } = resolveRecommended(missions);
    expect(cards.map((c) => c.id)).toEqual(['srs-due', 'goal-remaining']);
    expect(remaining.map((m) => m.id)).toEqual(['revisit-wrong']);
    expect(cards[0].text).toMatch(/5 cards are due/i);
  });

  it('pads with pack fallbacks when fewer than two missions are open', () => {
    const { cards, remaining } = resolveRecommended([]);
    expect(remaining).toEqual([]);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(['continue-quiz', 'review-vocab']);
    expect(cards[0].text).toBe('Continue Quiz');
    expect(cards[1].text).toBe('Review Vocab');
    expect(cards[0].tab).toBe('translate');
    expect(cards[1].tab).toBe('vocab');
  });

  it('skips a mission with no pack copy rather than inventing a label', () => {
    const missions = [{ id: 'not-a-real-mission', count: 1, tab: 'chat' }];
    const { cards, remaining } = resolveRecommended(missions);
    expect(remaining.map((m) => m.id)).toEqual(['not-a-real-mission']);
    expect(cards.map((c) => c.id)).toEqual(['continue-quiz', 'review-vocab']);
  });
});

describe('RecommendedActions', () => {
  it('renders pack copy, never a hardcoded German sentence of its own', async () => {
    const onGo = vi.fn();
    render(
      <RecommendedActions
        missions={[{ id: 'srs-due', count: 5, tab: 'vocab', priority: 0 }]}
        onGo={onGo}
      />
    );
    expect(screen.getByText(/recommended for you/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 cards are due/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue quiz/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /5 cards are due/i }));
    expect(onGo).toHaveBeenCalledWith('vocab', expect.objectContaining({ id: 'srs-due' }));
  });

  it('routes a fallback card to the tab the pack named', async () => {
    const onGo = vi.fn();
    render(<RecommendedActions missions={[]} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button', { name: /review vocab/i }));
    expect(onGo).toHaveBeenCalledWith('vocab', expect.objectContaining({ id: 'review-vocab' }));
  });
});
