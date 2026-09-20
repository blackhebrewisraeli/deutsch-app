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

  // Both assertions below are the 320px bug ("SPOR / T", "MUSI / K"), split
  // into its two causes. Neither can be caught by a layout assertion in jsdom:
  // every rect there is 0x0, so the only observable form is the style the
  // component asks for.
  it('never asks for a mid-word break on a label', () => {
    render(<InterestPicker topics={INTEREST_TOPICS} enabled={[]} onChange={() => {}} />);
    for (const topic of INTEREST_TOPICS) {
      const label = screen.getByText(topic.label);
      expect(label.style.overflowWrap).not.toBe('anywhere');
      expect(label.style.wordBreak).not.toBe('break-all');
    }
  });

  it('sizes its tracks by available width, not by the topic count', () => {
    render(<InterestPicker topics={INTEREST_TOPICS} enabled={[]} onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Interest topics' });
    // Not `repeat(3, ...)`: three tracks at 320px leave ~77px per tile, which
    // is narrower than the widest uppercase label, and that overflow is what
    // the `anywhere` above was papering over. auto-fit keeps all three on one
    // row when there is room and drops to two when there is not.
    expect(group.style.gridTemplateColumns).not.toMatch(
      new RegExp(`^repeat\\(${INTEREST_TOPICS.length},`)
    );
    expect(group.style.gridTemplateColumns).toMatch(/^repeat\(auto-fit, minmax\(\d+px, 1fr\)\)$/);
  });
});
