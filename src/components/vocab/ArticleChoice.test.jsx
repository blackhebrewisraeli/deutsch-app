import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleChoice from './ArticleChoice';

const ARTICLES = ['der', 'die', 'das'];

describe('ArticleChoice', () => {
  it('renders one button per article, in the pack order', () => {
    // Deliberately not shuffled: three fixed positions become muscle memory,
    // and reshuffling them every card taxes recognition without testing
    // anything.
    render(<ArticleChoice articles={ARTICLES} onChoose={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(ARTICLES);
  });

  it('reports the article that was clicked', async () => {
    const onChoose = vi.fn();
    render(<ArticleChoice articles={ARTICLES} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'die' }));
    expect(onChoose).toHaveBeenCalledWith('die');
  });

  it('renders whatever the pack declares, not a hardcoded three', () => {
    render(<ArticleChoice articles={['el', 'la']} onChoose={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['el', 'la']);
  });
});
