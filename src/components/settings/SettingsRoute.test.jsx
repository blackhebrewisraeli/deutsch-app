import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsRoute from './SettingsRoute';

// AccountSection branches on this, and it differs between a dev box and CI.
vi.mock('../../lib/auth.js', () => ({
  isAuthConfigured: () => true,
  // EmailSection reaches for these; the flow itself is tested in
  // EmailSection.test.jsx, so here they only need to exist.
  getAccessToken: vi.fn().mockResolvedValue(null),
  requestEmailChange: vi.fn(),
  verifyEmailChange: vi.fn(),
}));
vi.mock('../../lib/leagues', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, LEAGUES_ENABLED: true, updateHandle: vi.fn().mockResolvedValue({}) };
});
vi.mock('../../lib/profile', () => ({ updateProfile: vi.fn().mockResolvedValue({}) }));

const user = { id: 'u1', email: 'sam@example.com' };
const profile = { handle: 'sam', avatar_emoji: '🦊' };

const renderRoute = (props = {}) =>
  render(
    <SettingsRoute
      open
      onClose={() => {}}
      user={user}
      profile={profile}
      level="a2"
      goal={50}
      themeMode="light"
      onSignIn={() => {}}
      onSignOut={() => {}}
      onExport={() => {}}
      onDelete={() => {}}
      {...props}
    />
  );

describe('SettingsRoute', () => {
  it('renders nothing while closed', () => {
    const { container } = renderRoute({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('is a modal dialog with an accessible name', () => {
    renderRoute();
    const dialog = screen.getByRole('dialog', { name: /settings/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('carries all five sections the spec lists', () => {
    renderRoute();
    const dialog = screen.getByRole('dialog', { name: /settings/i });
    // Profile — the handle is the one name now; display_name is gone.
    expect(within(dialog).getByRole('textbox', { name: /handle/i })).toBeInTheDocument();
    // Learning — the SAME level control the header uses, not a second one
    expect(within(dialog).getByRole('radiogroup', { name: /level/i })).toBeInTheDocument();
    // Appearance
    expect(within(dialog).getByLabelText(/appearance/i)).toBeInTheDocument();
    // Account: the email lives here now, with the control that changes it.
    expect(within(dialog).getByText('sam@example.com')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /change email/i })).toBeInTheDocument();
    // Sync + danger zone, moved wholesale from Stats
    expect(within(dialog).getByRole('button', { name: /export my data/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/danger zone/i)).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const onClose = vi.fn();
    renderRoute({ onClose });
    await userEvent.click(screen.getByRole('button', { name: /close settings/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderRoute({ onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Unlike the three header chips, which are non-modal and must stay untrapped,
  // this is a full-screen surface and takes the standard trap.
  it('traps focus inside the panel', async () => {
    renderRoute();
    const dialog = screen.getByRole('dialog', { name: /settings/i });
    const focusables = within(dialog).getAllByRole('button');
    expect(focusables.length).toBeGreaterThan(1);

    // Tabbing from the last control wraps back inside rather than escaping.
    focusables[focusables.length - 1].focus();
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('drives the level through the shared control', async () => {
    const onLevelChange = vi.fn();
    renderRoute({ onLevelChange });
    const group = screen.getByRole('radiogroup', { name: /level/i });
    await userEvent.click(within(group).getByRole('radio', { name: /b1/i }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });

  it('drives the daily goal', async () => {
    const onGoalChange = vi.fn();
    renderRoute({ onGoalChange });
    const buttons = screen.getAllByRole('button');
    const goalButton = buttons.find((b) => /XP/i.test(b.textContent ?? ''));
    await userEvent.click(goalButton);
    expect(onGoalChange).toHaveBeenCalled();
  });
});
