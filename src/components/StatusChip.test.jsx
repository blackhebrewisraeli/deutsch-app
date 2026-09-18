import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusChip from './StatusChip';
import { SessionGuardContext } from '../lib/sessionGuard';

// Default XP props so each case only states what it is about. `xpLevel` is
// deliberately different from any CEFR code so a test asserting "A2" cannot
// pass against the XP number by accident.
const renderChip = (props = {}) =>
  render(
    <StatusChip
      level="a1"
      onRetakePlacement={() => {}}
      xpLevel={7}
      progress={0.4}
      rank="Fortgeschritten"
      xpIntoLevel={140}
      xpToNext={350}
      {...props}
    />
  );

const trigger = () => screen.getByRole('button', { name: /open status/i });

// Renders the chip under a guard that always reports a live session, which is
// what a learner mid-set looks like to the header.
const renderGuarded = (props = {}, session = 'exercise 4 of 10') =>
  render(
    <SessionGuardContext.Provider
      value={{ set: () => {}, clear: () => {}, activeSession: () => session }}
    >
      <StatusChip
        level="a1"
        onRetakePlacement={() => {}}
        xpLevel={7}
        progress={0.4}
        rank="Fortgeschritten"
        xpIntoLevel={140}
        xpToNext={350}
        {...props}
      />
    </SessionGuardContext.Provider>
  );

describe('StatusChip', () => {
  beforeEach(() => localStorage.clear());

  it('names both signals on one trigger and keeps the CEFR code on its face', () => {
    renderChip({ level: 'a2' });
    expect(trigger()).toHaveAccessibleName(/XP level 7, Fortgeschritten/i);
    expect(trigger()).toHaveAccessibleName(/practice level A2/i);
    expect(trigger()).toHaveTextContent('A2');
  });

  it('opts the trigger into the dark-plane focus ring', () => {
    renderChip({ level: 'a2' });
    expect(trigger()).toHaveAttribute('data-ui', 'button');
    expect(trigger()).toHaveAttribute('data-focus-on-dark');
  });

  it('is closed until clicked', async () => {
    renderChip();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger());
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('separates the earned level from the practice level under their own headings', async () => {
    renderChip({ level: 'a2' });
    await userEvent.click(trigger());
    const sheet = screen.getByRole('dialog', { name: 'Status' });
    expect(within(sheet).getByText('Progress')).toBeInTheDocument();
    expect(within(sheet).getByText('Practice level')).toBeInTheDocument();
    expect(within(sheet).getByText(/Level 7 · Fortgeschritten/)).toBeInTheDocument();
    expect(within(sheet).getByText(/A2 · Elementary/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('radiogroup')).toBeNull();
  });

  it('reports XP progress toward the next level', async () => {
    renderChip({ xpLevel: 7, xpIntoLevel: 140, xpToNext: 350 });
    await userEvent.click(trigger());
    expect(screen.getByText('140 / 350 XP to level 8')).toBeInTheDocument();
  });

  it('offers a retake, not a free level picker', async () => {
    const onRetakePlacement = vi.fn();
    renderChip({ onRetakePlacement });
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
    expect(onRetakePlacement).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('closes on Escape and returns focus', async () => {
    renderChip();
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    render(
      <div>
        <StatusChip
          level="a1"
          onRetakePlacement={() => {}}
          xpLevel={7}
          progress={0.4}
          rank="Fortgeschritten"
          xpIntoLevel={140}
          xpToNext={350}
        />
        <button type="button">elsewhere</button>
      </div>
    );
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays open when the click lands inside the sheet', async () => {
    renderChip();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByText('Practice level'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('with a practice session in flight', () => {
    it('asks before restarting, naming what is at stake', async () => {
      const onRetakePlacement = vi.fn();
      renderGuarded({ onRetakePlacement });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));

      expect(screen.getByText(/restarts your current set/i)).toHaveTextContent(/exercise 4 of 10/i);
      expect(onRetakePlacement).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^retake$/i })).toHaveFocus();
    });

    it('opens placement on confirm', async () => {
      const onRetakePlacement = vi.fn();
      renderGuarded({ onRetakePlacement });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
      await userEvent.click(screen.getByRole('button', { name: /^retake$/i }));

      expect(onRetakePlacement).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger()).toHaveFocus();
    });

    it('commits nothing on decline and returns to the retake control', async () => {
      const onRetakePlacement = vi.fn();
      renderGuarded({ onRetakePlacement });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
      await userEvent.click(screen.getByRole('button', { name: /keep going/i }));

      expect(onRetakePlacement).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retake placement/i })).toHaveFocus();
    });

    it('drops a half-asked question when the sheet is dismissed', async () => {
      const onRetakePlacement = vi.fn();
      renderGuarded({ onRetakePlacement });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();

      await userEvent.click(trigger());
      expect(screen.queryByRole('button', { name: /^retake$/i })).toBeNull();
      expect(screen.getByText('Practice level')).toBeInTheDocument();
      expect(onRetakePlacement).not.toHaveBeenCalled();
    });

    it('does not ask when the guard reports no session', async () => {
      const onRetakePlacement = vi.fn();
      renderGuarded({ onRetakePlacement }, null);
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
      expect(screen.queryByRole('button', { name: /keep going/i })).toBeNull();
      expect(onRetakePlacement).toHaveBeenCalledTimes(1);
    });
  });
});
