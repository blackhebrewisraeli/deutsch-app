import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeChip from './ThemeChip';
import { THEME_MODE_KEY, THEME_TONE_KEY } from '../lib/themeMode';

describe('ThemeChip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens a sheet with mode and tone pickers', async () => {
    render(<ThemeChip />);
    const chip = screen.getByRole('button', { name: /^appearance$/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /tone/i })).toBeInTheDocument();
  });

  it('persists a mode pick and dismisses on Escape', async () => {
    render(<ThemeChip />);
    await userEvent.click(screen.getByRole('button', { name: /^appearance$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe('dark');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /appearance/i })).not.toBeInTheDocument();
  });

  it('persists a tone pick', async () => {
    render(<ThemeChip />);
    await userEvent.click(screen.getByRole('button', { name: /^appearance$/i }));
    await userEvent.click(screen.getByRole('button', { name: /night-light/i }));
    expect(localStorage.getItem(THEME_TONE_KEY)).toBe('night');
  });

  it('closes when clicking outside the sheet', async () => {
    render(
      <div>
        <ThemeChip />
        <button type="button">outside</button>
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: /^appearance$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
