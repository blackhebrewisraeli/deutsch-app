import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsRoute from './SettingsRoute';
import { INTEREST_TOPICS } from '../../packs/de/interests';

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
vi.mock('../../lib/adminApi.js', () => ({
  fetchAdminMe: vi.fn(),
  fetchFeedback: vi.fn().mockResolvedValue({ items: [] }),
  updateFeedbackStatus: vi.fn(),
  deleteFeedback: vi.fn(),
  fetchAdminUsers: vi.fn().mockResolvedValue({ items: [] }),
  setUserBlocked: vi.fn(),
}));

const adminState = vi.hoisted(() => ({
  me: { isAdmin: false, isSystemAccount: false, blocked: false },
  status: 'ready',
}));

vi.mock('../../lib/useAdminSession.js', () => ({
  useAdminSession: (user) =>
    user ? { status: adminState.status, me: adminState.me } : { status: 'idle', me: null },
}));

const user = { id: 'u1', email: 'sam@example.com' };
const profile = { handle: 'sam' };

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
      interestTopics={INTEREST_TOPICS}
      enabledInterests={[]}
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

  it('carries the profile, learning, appearance, device, and account sections', () => {
    renderRoute();
    // Profile — the handle is the one name now; display_name is gone.
    expect(screen.getByRole('textbox', { name: /handle/i })).toBeInTheDocument();
    // Learning — placement is the primary writer; the switcher is advanced
    expect(screen.getByRole('button', { name: /retake placement/i })).toBeInTheDocument();
    expect(screen.getByText(/override classification/i)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /level/i })).not.toBeInTheDocument();
    // Interests — opt-in topical vocab (Phase 4)
    expect(screen.getByText('Interessen')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Interest topics' })).toBeInTheDocument();
    // KI-Modell — learner-facing Chat band (Phase 5)
    expect(screen.getByText('KI-Modell')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Chat model' })).toBeInTheDocument();
    // Appearance
    expect(screen.getByLabelText(/appearance/i)).toBeInTheDocument();
    // Device Cache Storage — guests need this too, so it is not inside Konto
    expect(screen.getByRole('button', { name: /clear offline cache/i })).toBeInTheDocument();
    // Account: the email lives here now, with the control that changes it.
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change email/i })).toBeInTheDocument();
    // Sync + danger zone, moved wholesale from Stats
    expect(screen.getByRole('button', { name: /export my data/i })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
  });

  it('hides the level switcher until the advanced override is opened', async () => {
    renderRoute();
    expect(screen.queryByRole('radiogroup', { name: /level/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(/override classification/i));
    expect(screen.getByRole('radiogroup', { name: /level/i })).toBeInTheDocument();
  });

  it('drives the level through the shared control', async () => {
    const onLevelChange = vi.fn();
    renderRoute({ onLevelChange });
    await userEvent.click(screen.getByText(/override classification/i));
    const group = screen.getByRole('radiogroup', { name: /level/i });
    await userEvent.click(within(group).getByRole('radio', { name: /b1/i }));
    expect(onLevelChange).toHaveBeenCalledWith('b1');
  });

  it('persists the chosen level', async () => {
    renderRoute({ level: 'a1', onLevelChange: () => {} });
    await userEvent.click(screen.getByText(/override classification/i));
    const group = screen.getByRole('radiogroup', { name: /level/i });
    await userEvent.click(within(group).getByRole('radio', { name: /a2/i }));
    expect(localStorage.getItem('deutsch-level')).toBe('a2');
  });

  it('offers a retake that calls through to the host', async () => {
    const onRetakePlacement = vi.fn();
    renderRoute({ onRetakePlacement });
    await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
    expect(onRetakePlacement).toHaveBeenCalledTimes(1);
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

  it('toggles an interest topic through onInterestsChange', async () => {
    const onInterestsChange = vi.fn();
    renderRoute({ enabledInterests: [], onInterestsChange });
    await userEvent.click(screen.getByRole('button', { name: /sport/i }));
    expect(onInterestsChange).toHaveBeenCalledWith(['sport']);
  });

  it('picks a chat model through onPreferredModelChange', async () => {
    const onPreferredModelChange = vi.fn();
    renderRoute({ preferredModel: 'auto', onPreferredModelChange });
    await userEvent.click(screen.getByRole('button', { name: /fast/i }));
    expect(onPreferredModelChange).toHaveBeenCalledWith('fast');
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

describe('SettingsRoute — Admin', () => {
  beforeEach(() => {
    adminState.me = { isAdmin: false, isSystemAccount: false, blocked: false };
    adminState.status = 'ready';
  });

  it('hides Admin for a regular signed-in user', () => {
    renderRoute();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('hides Admin for a guest even if leftover state claimed admin', () => {
    adminState.me = { isAdmin: true, isSystemAccount: true, blocked: false };
    renderRoute({ user: null });
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows Admin only after the server says isAdmin', async () => {
    adminState.me = { isAdmin: true, isSystemAccount: true, blocked: false };
    renderRoute();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('shows a blocked banner without admin chrome', () => {
    adminState.me = { isAdmin: false, isSystemAccount: false, blocked: true };
    renderRoute();
    expect(screen.getByText(/this account is blocked/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
