import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelPopover from './ModelPopover';

const trigger = () => screen.getByRole('button', { name: /^Modell:/ });
const sheet = () => screen.getByRole('dialog', { name: 'Modell' });

describe('ModelPopover trigger', () => {
  it('names the current preference and reports it closed', () => {
    render(<ModelPopover value="balanced" onChange={() => {}} />);
    const button = trigger();
    expect(button).toHaveAccessibleName('Modell: Balanced');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('falls back to Auto for a junk stored value', () => {
    render(<ModelPopover value="gpt-4o" onChange={() => {}} />);
    expect(trigger()).toHaveAccessibleName('Modell: Auto');
  });

  // WCAG 2.5.3: the accessible name has to contain the visible text, or voice
  // control cannot activate the control by what is printed on it.
  it('contains its own visible text in its accessible name', () => {
    render(<ModelPopover value="fast" onChange={() => {}} />);
    const button = trigger();
    expect(button).toHaveAccessibleName(expect.stringContaining('Modell'));
    expect(button).toHaveAccessibleName(expect.stringContaining('Fast'));
    expect(button.textContent).toContain('Modell');
    expect(button.textContent).toContain('Fast');
  });
});

describe('ModelPopover sheet', () => {
  it('opens the shared picker and flips aria-expanded', async () => {
    render(<ModelPopover value="auto" onChange={() => {}} userTier="free" />);
    await userEvent.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(sheet()).getByRole('group', { name: 'Chat model' })).toBeInTheDocument();
    for (const band of [/^Auto/, /^Fast/, /^Balanced/, /^Capable/]) {
      expect(within(sheet()).getByRole('button', { name: band })).toBeInTheDocument();
    }
  });

  // Non-modal, like the three header sheets: no aria-modal, no scrim, and no
  // focus trap. Tab is supposed to be able to leave a popover.
  it('is a non-modal popover, not a dialog that traps', async () => {
    render(<ModelPopover value="auto" onChange={() => {}} />);
    await userEvent.click(trigger());
    expect(sheet()).not.toHaveAttribute('aria-modal');
  });

  it('reports the pick, closes, and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    render(<ModelPopover value="auto" onChange={onChange} userTier="free" />);
    await userEvent.click(trigger());
    await userEvent.click(within(sheet()).getByRole('button', { name: /^Capable/ }));

    expect(onChange).toHaveBeenCalledWith('capable');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('dismisses on Escape and returns focus', async () => {
    render(<ModelPopover value="auto" onChange={() => {}} />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('dismisses on an outside click', async () => {
    render(
      <div>
        <ModelPopover value="auto" onChange={() => {}} />
        <button type="button">elsewhere</button>
      </div>
    );
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open for a click inside the sheet', async () => {
    render(<ModelPopover value="auto" onChange={() => {}} />);
    await userEvent.click(trigger());
    await userEvent.click(within(sheet()).getByText(/Auto keeps the router/i));
    expect(screen.queryByRole('dialog')).toBeInTheDocument();
  });

  // Routing is out of scope here, but the caption ModelPicker prints when a
  // pick is above the tier is the one piece of routing the learner sees, and
  // wrapping the picker must not hide it.
  it('keeps the tier fallback caption inside the sheet', async () => {
    render(<ModelPopover value="capable" onChange={() => {}} userTier="guest" />);
    await userEvent.click(trigger());
    expect(within(sheet()).getByText(/above your current plan/i)).toBeInTheDocument();
    // The trigger still names what the learner CHOSE, not what routing did.
    expect(trigger()).toHaveAccessibleName('Modell: Capable');
  });
});
