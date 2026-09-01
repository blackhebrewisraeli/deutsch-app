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
      user={user}
      profile={profile}
      level="a2"
      goal={50}
      onSignIn={() => {}}
      onSignOut={() => {}}
      onExport={() => {}}
      onDelete={() => {}}
      {...props}
    />
  );

describe('SettingsRoute', () => {
  it('is an inline panel, not a modal dialog', () => {
    renderRoute();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /einstellungen/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close settings/i })).not.toBeInTheDocument();
  });

  it('carries all four sections the spec lists', () => {
    renderRoute();
    // Profile — the handle is the one name now; display_name is gone.
    expect(screen.getByRole('textbox', { name: /handle/i })).toBeInTheDocument();
    // Learning — the SAME level control the header uses, not a second one
    expect(screen.getByRole('radiogroup', { name: /level/i })).toBeInTheDocument();
    // Appearance
    expect(screen.getByLabelText(/appearance/i)).toBeInTheDocument();
    // Account: the email lives here now, with the control that changes it.
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change email/i })).toBeInTheDocument();
    // Sync + danger zone, moved wholesale from Stats
    expect(screen.getByRole('button', { name: /export my data/i })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
  });

  it('drives the level through the shared control', async () => {
    const onLevelChange = vi.fn();
    renderRoute({ onLevelChange });
    const group = screen.getByRole('radiogroup', { name: /level/i });
    await userEvent.click(within(group).getByRole('radio', { name: /b1/i }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });

  it('persists the chosen level', async () => {
    renderRoute({ level: 'a1', onLevelChange: () => {} });
    const group = screen.getByRole('radiogroup', { name: /level/i });
    await userEvent.click(within(group).getByRole('radio', { name: /a2/i }));
    expect(localStorage.getItem('deutsch-level')).toBe('a2');
  });

  it('drives the daily goal', async () => {
    const onGoalChange = vi.fn();
    renderRoute({ onGoalChange });
    const buttons = screen.getAllByRole('button');
    const goalButton = buttons.find((b) => /XP/i.test(b.textContent ?? ''));
    await userEvent.click(goalButton);
    expect(onGoalChange).toHaveBeenCalled();
  });

  it('toggles sound', async () => {
    const onSoundChange = vi.fn();
    renderRoute({ soundOn: false, onSoundChange });
    await userEvent.click(screen.getByRole('button', { name: /sound: off/i }));
    expect(onSoundChange).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsRoute — Learning level', () => {
  it('names the level for a guest, with no bonus promised', () => {
    renderRoute({ level: 'a1' });
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });

  it.each([
    ['a1', /Word tiles/, /Assemble the full sentence/],
    ['a2', /Fill the blanks/, /Select the missing words/],
    ['b1', /Free typing/, /AI-graded translation/],
  ])('describes the %s exercise mode', (lvl, label, detail) => {
    renderRoute({ level: lvl });
    const line = screen.getByText(/Translate exercises:/);
    expect(line).toHaveTextContent(label);
    expect(line).toHaveTextContent(detail);
  });

  // Case-transforming the descriptor mangled the acronym ("ai-graded").
  it('keeps the AI acronym uppercase in the B1 descriptor', () => {
    renderRoute({ level: 'b1' });
    expect(screen.getByText(/Translate exercises:/)).toHaveTextContent('AI-graded');
    expect(screen.queryByText(/ai-graded/)).toBeNull();
  });

  it('describes only the selected level, not all three', () => {
    renderRoute({ level: 'a1' });
    const line = screen.getByText(/Translate exercises:/);
    expect(line).not.toHaveTextContent(/AI-graded/);
    expect(line).not.toHaveTextContent(/missing words/);
  });

  it('names the level XP bonus for an account holder above A1', () => {
    renderRoute({ level: 'b1', levelBoost: true });
    expect(screen.getByText(/×1\.5 XP per answer/)).toBeInTheDocument();
  });

  it('promises no bonus to a guest', () => {
    renderRoute({ level: 'b1' });
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });

  it('names the level but promises no bonus for an A1 account holder', () => {
    renderRoute({ level: 'a1', levelBoost: true });
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.queryByText(/XP per answer/)).toBeNull();
  });
});
