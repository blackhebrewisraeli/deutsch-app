import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import useFocusTrap from './useFocusTrap.js';

// A stand-in for the three dialogs that share this: a container that takes
// focus programmatically (tabIndex -1) with siblings outside it that Tab must
// never reach while the trap is armed.
function Harness({ active = true, stops = 2, containerFocus = true }) {
  const ref = useRef(null);
  useFocusTrap(ref, active);
  return (
    <>
      <button type="button">before</button>
      <div ref={ref} tabIndex={containerFocus ? -1 : undefined} data-testid="panel">
        {Array.from({ length: stops }, (_, i) => (
          <button type="button" key={i}>
            stop {i}
          </button>
        ))}
      </div>
      <button type="button">after</button>
    </>
  );
}

const panel = () => screen.getByTestId('panel');

describe('useFocusTrap', () => {
  it('wraps Tab from the last stop back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'stop 1' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'stop 0' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first stop to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: 'stop 0' }).focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'stop 1' })).toHaveFocus();
  });

  // The container is the entry point the dialogs focus on open, so going
  // backwards off it has to wrap just as it would from the first real stop.
  it('wraps Shift+Tab off the container itself', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    panel().focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'stop 1' })).toHaveFocus();
  });

  it('leaves Tab alone between interior stops', async () => {
    const user = userEvent.setup();
    render(<Harness stops={3} />);
    screen.getByRole('button', { name: 'stop 0' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'stop 1' })).toHaveFocus();
  });

  // The error state of a dialog can render no controls at all.
  it('holds focus on the container when there is nothing to land on', async () => {
    const user = userEvent.setup();
    render(<Harness stops={0} />);
    panel().focus();

    await user.tab();

    expect(panel()).toHaveFocus();
  });

  it('does nothing while inactive', async () => {
    const user = userEvent.setup();
    render(<Harness active={false} />);
    screen.getByRole('button', { name: 'stop 1' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('stops trapping when it is deactivated', async () => {
    function Toggle() {
      const [active, setActive] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setActive(false)}>
            disarm
          </button>
          <Harness active={active} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Toggle />);
    await user.click(screen.getByRole('button', { name: 'disarm' }));

    screen.getByRole('button', { name: 'stop 1' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });
});

// Guard, in the style of noHardcodedHex / noPromptsInComponents. The three
// header sheets are NON-MODAL popovers: `aria-haspopup="dialog"` with no
// `aria-modal` and no scrim. Trapping Tab in one would be a regression dressed
// as an a11y fix — a non-modal popover is supposed to let Tab leave. The audit
// behind #144–#146 checked them and deliberately left them alone, so this
// stops the next pass at "completing the loop" from adopting the hook there.
it('is not adopted by the non-modal header sheets', async () => {
  const { readFileSync } = await import('node:fs');
  const nonModal = [
    'src/components/AccountChip.jsx',
    'src/components/StatusChip.jsx',
    'src/components/ThemeChip.jsx',
  ];
  const adopted = nonModal.filter((f) => /useFocusTrap/.test(readFileSync(f, 'utf8')));
  expect({ inspected: nonModal.length, adopted }).toEqual({ inspected: 3, adopted: [] });
});
