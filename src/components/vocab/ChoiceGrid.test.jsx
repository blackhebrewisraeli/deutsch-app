import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChoiceGrid from './ChoiceGrid';

const CHOICES = ['bread', 'water', 'cheese', 'wine'];

describe('ChoiceGrid', () => {
  it('renders every option it is handed, in the order given', () => {
    // Order is the parent's business — VocabTab memoises the shuffle per card
    // so an unrelated re-render cannot move a button under the user's finger.
    render(<ChoiceGrid choices={CHOICES} onChoose={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(CHOICES);
  });

  it('reports the option that was clicked', async () => {
    const onChoose = vi.fn();
    render(<ChoiceGrid choices={CHOICES} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: 'cheese' }));
    expect(onChoose).toHaveBeenCalledWith('cheese');
  });

  it('renders nothing when there are no choices', () => {
    render(<ChoiceGrid choices={[]} onChoose={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
