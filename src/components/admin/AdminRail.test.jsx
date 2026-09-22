import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminRail, AdminFilterRail } from './AdminRail';

const ITEMS = [
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Beta' },
  { key: 'c', label: 'Gamma' },
];

describe('AdminRail', () => {
  it('exposes a tablist with one selected tab', () => {
    render(<AdminRail items={ITEMS} activeKey="b" onPick={vi.fn()} ariaLabel="Rail" panelId="p" />);
    expect(screen.getByRole('tablist', { name: 'Rail' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps only the selected tab in the Tab order', () => {
    render(<AdminRail items={ITEMS} activeKey="b" onPick={vi.fn()} ariaLabel="Rail" panelId="p" />);
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves with the arrow keys and wraps at both ends', async () => {
    const onPick = vi.fn();
    render(<AdminRail items={ITEMS} activeKey="a" onPick={onPick} ariaLabel="Rail" panelId="p" />);
    const first = screen.getByRole('tab', { name: 'Alpha' });
    first.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(onPick).toHaveBeenLastCalledWith('b');

    // activeKey is a prop, so the component has not moved — pressing Left from
    // the FIRST item is what proves the wrap, not a second press after a state
    // change the test never applied.
    await userEvent.keyboard('{ArrowLeft}');
    expect(onPick).toHaveBeenLastCalledWith('c');

    await userEvent.keyboard('{End}');
    expect(onPick).toHaveBeenLastCalledWith('c');
    await userEvent.keyboard('{Home}');
    expect(onPick).toHaveBeenLastCalledWith('a');
  });

  it('ignores keys that are not navigation', async () => {
    const onPick = vi.fn();
    render(<AdminRail items={ITEMS} activeKey="a" onPick={onPick} ariaLabel="Rail" panelId="p" />);
    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('points every tab at the panel it controls', () => {
    render(<AdminRail items={ITEMS} activeKey="a" onPick={vi.fn()} ariaLabel="Rail" panelId="p" />);
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-controls', 'p-c');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('id', 'p-tab-c');
  });
});

describe('AdminFilterRail', () => {
  const OPTIONS = [
    { key: '', label: 'All' },
    { key: 'open', label: 'Open' },
  ];

  it('is a pressed-toggle group, not a tablist', async () => {
    const onPick = vi.fn();
    render(<AdminFilterRail options={OPTIONS} activeKey="" onPick={onPick} ariaLabel="Filter" />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onPick).toHaveBeenCalledWith('open');
  });

  it('leaves every filter reachable by Tab', () => {
    render(<AdminFilterRail options={OPTIONS} activeKey="" onPick={vi.fn()} ariaLabel="Filter" />);
    for (const name of ['All', 'Open']) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('tabindex', '-1');
    }
  });
});
