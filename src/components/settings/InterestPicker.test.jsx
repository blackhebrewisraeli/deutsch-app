import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterestPicker from './InterestPicker';
import { INTEREST_TOPICS } from '../../packs/de/interests';

describe('InterestPicker', () => {
  it('exposes a labelled group of pressed toggles for the pack topics', () => {
    render(<InterestPicker topics={INTEREST_TOPICS} enabled={['sport']} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Interest topics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sport/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /tech/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /musik/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the toggled id set, catalog order', async () => {
    const onChange = vi.fn();
    render(<InterestPicker topics={INTEREST_TOPICS} enabled={['sport']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /tech/i }));
    expect(onChange).toHaveBeenCalledWith(['sport', 'tech']);
    await userEvent.click(screen.getByRole('button', { name: /sport/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
