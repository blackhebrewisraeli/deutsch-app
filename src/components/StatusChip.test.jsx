import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusChip from './StatusChip';
import { LEVEL_CHANGE_EVENT } from '../lib/levelPref';
import { SessionGuardContext } from '../lib/sessionGuard';

// Default XP props so each case only states what it is about. `xpLevel` is
// deliberately different from any CEFR code so a test asserting "A2" cannot
// pass against the XP number by accident.
const renderChip = (props = {}) =>
  render(
    <StatusChip
      level="a1"
      onLevelChange={() => {}}
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
        onLevelChange={() => {}}
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
    // Both "levels" are in the name, in the order the sheet presents them.
    // The badge used to carry the XP one as a `title`, which is not a name.
    expect(trigger()).toHaveAccessibleName(/XP level 7, Fortgeschritten/i);
    expect(trigger()).toHaveAccessibleName(/practice level A2/i);
    // Standing context, so it stays visible rather than moving into the sheet.
    expect(trigger()).toHaveTextContent('A2');
  });

  it('is closed until clicked', async () => {
    renderChip();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger());
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  // The reason the two controls could be merged at all: inside the sheet they
  // stay separate, each under its own heading. Without that this is just the
  // conflation the split was meant to avoid.
  it('separates the earned level from the chosen one under their own headings', async () => {
    renderChip({ level: 'a2' });
    await userEvent.click(trigger());
    const sheet = screen.getByRole('dialog', { name: 'Status' });
    expect(within(sheet).getByText('Progress')).toBeInTheDocument();
    expect(within(sheet).getByText('Practice level')).toBeInTheDocument();
    // The XP level is reported as text, never as a fourth radio.
    expect(within(sheet).getByText(/Level 7 · Fortgeschritten/)).toBeInTheDocument();
    expect(within(sheet).getAllByRole('radio')).toHaveLength(3);
  });

  it('reports XP progress toward the next level', async () => {
    renderChip({ xpLevel: 7, xpIntoLevel: 140, xpToNext: 350 });
    await userEvent.click(trigger());
    expect(screen.getByText('140 / 350 XP to level 8')).toBeInTheDocument();
  });

  it('shows codes only — the compact sheet must not carry the mode labels', async () => {
    renderChip();
    await userEvent.click(trigger());
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['A1', 'A2', 'B1']);
  });

  it('persists the pick, reports it, and closes', async () => {
    const onLevelChange = vi.fn();
    renderChip({ onLevelChange });
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
    expect(localStorage.getItem('deutsch-level')).toBe('b1');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Focus must come back to the trigger, not fall to <body>.
    expect(trigger()).toHaveFocus();
  });

  it('announces the change so other level consumers resync', async () => {
    const heard = vi.fn();
    window.addEventListener(LEVEL_CHANGE_EVENT, heard);
    renderChip();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('radio', { name: /A2/ }));
    expect(heard).toHaveBeenCalled();
    expect(heard.mock.calls[0][0].detail).toEqual({ level: 'a2' });
    window.removeEventListener(LEVEL_CHANGE_EVENT, heard);
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
          onLevelChange={() => {}}
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

  // Regression: the sheet closes on commit, so while selection followed focus
  // the first ArrowRight committed A2, closed the sheet and threw focus back
  // to the trigger. B1 could not be reached from A1 by keyboard at all — and
  // the whole suite was green, because the arrow cases only ever ran against
  // a bare LevelSwitcher outside a popover.
  it('lets the keyboard reach the far option without closing the sheet', async () => {
    const onLevelChange = vi.fn();
    renderChip({ onLevelChange });
    await userEvent.click(trigger());

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onLevelChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /B1/ })).toHaveFocus();

    await userEvent.keyboard('{ }');
    expect(onLevelChange).toHaveBeenCalledWith('b1');
    expect(onLevelChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  describe('with a practice session in flight', () => {
    it('asks before restarting, naming what is at stake', async () => {
      const onLevelChange = vi.fn();
      renderGuarded({ onLevelChange });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('radio', { name: /B1/ }));

      expect(screen.getByText(/restarts your current set/i)).toHaveTextContent(/exercise 4 of 10/i);
      // Nothing committed and nothing written until they answer.
      expect(onLevelChange).not.toHaveBeenCalled();
      expect(localStorage.getItem('deutsch-level')).toBeNull();
      // Focus lands on the confirm, not on a control that just unmounted.
      expect(screen.getByRole('button', { name: /switch to B1/i })).toHaveFocus();
    });

    it('commits on confirm', async () => {
      const onLevelChange = vi.fn();
      renderGuarded({ onLevelChange });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
      await userEvent.click(screen.getByRole('button', { name: /switch to B1/i }));

      expect(onLevelChange).toHaveBeenCalledWith('b1');
      expect(localStorage.getItem('deutsch-level')).toBe('b1');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger()).toHaveFocus();
    });

    it('commits nothing on decline and returns to the switcher', async () => {
      const onLevelChange = vi.fn();
      renderGuarded({ onLevelChange });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
      await userEvent.click(screen.getByRole('button', { name: /keep going/i }));

      expect(onLevelChange).not.toHaveBeenCalled();
      expect(localStorage.getItem('deutsch-level')).toBeNull();
      // Back to the choice, with focus on the level they are still on.
      expect(screen.getByRole('dialog', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /A1/ })).toHaveFocus();
    });

    it('drops a half-asked question when the sheet is dismissed', async () => {
      const onLevelChange = vi.fn();
      renderGuarded({ onLevelChange });
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();

      // Reopening must show the switcher, not the stale question.
      await userEvent.click(trigger());
      expect(screen.queryByRole('button', { name: /switch to B1/i })).toBeNull();
      expect(screen.getByText('Practice level')).toBeInTheDocument();
      expect(onLevelChange).not.toHaveBeenCalled();
    });

    // Negative control: the same component with nothing in flight must not
    // ask. A confirmation that always fires is one people click through.
    it('does not ask when the guard reports no session', async () => {
      const onLevelChange = vi.fn();
      renderGuarded({ onLevelChange }, null);
      await userEvent.click(trigger());
      await userEvent.click(screen.getByRole('radio', { name: /B1/ }));
      expect(screen.queryByRole('button', { name: /switch to B1/i })).toBeNull();
      expect(onLevelChange).toHaveBeenCalledWith('b1');
    });
  });

  // Escaping a traversal must leave the level alone — the point of manual
  // selection is that passing over A2 is not choosing it.
  it('commits nothing when a traversal is abandoned with Escape', async () => {
    const onLevelChange = vi.fn();
    renderChip({ onLevelChange });
    await userEvent.click(trigger());
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLevelChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('A1');
  });
});
