import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LevelSwitcher from './LevelSwitcher';

// The component is controlled, so a fixed `value` cannot express traversal:
// activeIndex would never move and Home/End would assert against a stale
// selection. This mirrors how App/StatsTab actually drive it.
function Controlled({ initial = 'a1', onChange }) {
  const [value, setValue] = useState(initial);
  return (
    <LevelSwitcher
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('LevelSwitcher', () => {
  it('exposes a labelled radiogroup with the three CEFR levels', () => {
    render(<LevelSwitcher value="a1" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Select learning level' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marks only the current level checked', () => {
    render(<LevelSwitcher value="a2" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /A2/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /A1/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /B1/ })).not.toBeChecked();
  });

  // The whole reason this component exists rather than reusing SegmentedPicker:
  // setUserLevel rejects uppercase, so emitting 'B1' would be silently dropped.
  it('reports lowercase level keys, never the uppercase label', async () => {
    const onChange = vi.fn();
    render(<LevelSwitcher value="a1" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
    expect(onChange).toHaveBeenCalledWith('b1');
    expect(onChange).not.toHaveBeenCalledWith('B1');
  });

  it('does not fire onChange when the current level is re-picked', async () => {
    const onChange = vi.fn();
    render(<LevelSwitcher value="a1" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /A1/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is one tab stop, with arrow keys moving focus within it', async () => {
    render(<LevelSwitcher value="a1" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /A1/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: /A2/ })).toHaveAttribute('tabindex', '-1');

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: /A1/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /A2/ })).toHaveFocus();
    // The roving tab stop follows focus, so a second Tab leaves the group
    // rather than walking the remaining options.
    expect(screen.getByRole('radio', { name: /A2/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: /A1/ })).toHaveAttribute('tabindex', '-1');
  });

  // Manual selection. Committing a level restarts the exercise set, and the
  // compact variant sits in a popover that closes on commit — following focus
  // made B1 unreachable from A1 by keyboard, because the first arrow press
  // closed the sheet. See the LevelChip suite for that end of it.
  it('moves focus across every option without committing anything', async () => {
    const onChange = vi.fn();
    render(<LevelSwitcher value="a1" onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}{End}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /A2/ })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /A1/ })).toBeChecked();
  });

  it.each([
    ['{ }', 'Space'],
    ['{Enter}', 'Enter'],
  ])('commits the focused option on %s', async (key) => {
    const onChange = vi.fn();
    render(<LevelSwitcher value="a1" onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard(key);
    expect(onChange).toHaveBeenCalledWith('a2');
  });

  it('wraps at the ends and supports Home/End', async () => {
    render(<Controlled />);
    const at = (name) => screen.getByRole('radio', { name });
    await userEvent.tab();
    // Left from the first option wraps to the last.
    await userEvent.keyboard('{ArrowLeft}');
    expect(at(/B1/)).toHaveFocus();
    // Right from the last wraps back to the first.
    await userEvent.keyboard('{ArrowRight}');
    expect(at(/A1/)).toHaveFocus();
    // Each of these must move, or the assertion passes on a no-op.
    await userEvent.keyboard('{End}');
    expect(at(/B1/)).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(at(/A1/)).toHaveFocus();
  });

  // An abandoned traversal must not leave the tab stop parked on a level the
  // learner never chose — tabbing back in should land on the current one.
  it('hands the tab stop back to the checked option when focus leaves', async () => {
    render(
      <>
        <LevelSwitcher value="a1" onChange={() => {}} />
        <button type="button">after</button>
      </>
    );
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: /B1/ })).toHaveAttribute('tabindex', '0');
    await userEvent.click(screen.getByRole('button', { name: 'after' }));
    expect(screen.getByRole('radio', { name: /A1/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: /B1/ })).toHaveAttribute('tabindex', '-1');
  });

  // A corrupt value must not leave every option at tabIndex -1, which would
  // make the control unreachable by keyboard.
  it('stays keyboard-reachable when the value is not a level', () => {
    render(<LevelSwitcher value="zz" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /A1/ })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });

  it('shows the exercise mode in the full variant only', () => {
    const { unmount } = render(<LevelSwitcher value="a1" onChange={() => {}} variant="full" />);
    expect(screen.getByText(/Word tiles/i)).toBeInTheDocument();
    unmount();
    render(<LevelSwitcher value="a1" onChange={() => {}} variant="compact" />);
    expect(screen.queryByText(/Word tiles/i)).toBeNull();
  });
});
