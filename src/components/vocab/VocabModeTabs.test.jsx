import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabModeTabs from './VocabModeTabs';

function Controlled({ initial = 'practice', onPick }) {
  const [active, setActive] = useState(initial);
  return (
    <VocabModeTabs
      active={active}
      onPick={(next) => {
        setActive(next);
        onPick?.(next);
      }}
    />
  );
}

describe('VocabModeTabs', () => {
  it('exposes a labelled tablist with the three modes', () => {
    render(<VocabModeTabs active="practice" onPick={() => {}} />);
    expect(screen.getByRole('tablist', { name: 'Vocabulary mode' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Custom' })).toHaveAttribute('aria-selected', 'false');
  });

  it('points each tab at a stable panel id', () => {
    render(<VocabModeTabs active="browse" onPick={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute(
      'aria-controls',
      'vocab-panel-browse'
    );
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('id', 'vocab-tab-browse');
  });

  it('does not fire onPick when the current tab is re-picked', async () => {
    const onPick = vi.fn();
    render(<VocabModeTabs active="practice" onPick={onPick} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Practice' }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('commits a different tab on click', async () => {
    const onPick = vi.fn();
    render(<VocabModeTabs active="practice" onPick={onPick} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(onPick).toHaveBeenCalledWith('browse');
  });

  it('is one tab stop, with arrow keys moving focus within it', async () => {
    render(<VocabModeTabs active="practice" onPick={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('tabindex', '-1');

    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus across every option without committing anything', async () => {
    const onPick = vi.fn();
    render(<VocabModeTabs active="practice" onPick={onPick} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}{End}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveFocus();
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    ['{ }', 'Space'],
    ['{Enter}', 'Enter'],
  ])('commits the focused option on %s', async (key) => {
    const onPick = vi.fn();
    render(<VocabModeTabs active="practice" onPick={onPick} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.keyboard(key);
    expect(onPick).toHaveBeenCalledWith('browse');
  });

  it('wraps at the ends and supports Home/End', async () => {
    render(<Controlled />);
    const at = (name) => screen.getByRole('tab', { name });
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(at('Custom')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(at('Practice')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(at('Custom')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(at('Practice')).toHaveFocus();
  });

  it('hands the tab stop back to the selected tab when focus leaves', async () => {
    render(
      <>
        <VocabModeTabs active="practice" onPick={() => {}} />
        <button type="button">after</button>
      </>
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('tabindex', '0');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('tabindex', '-1');
  });
});
