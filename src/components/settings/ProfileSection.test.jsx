import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSection from './ProfileSection';

const profile = { handle: 'sam', avatar_emoji: '🦊' };

const handleField = () => screen.getByRole('textbox', { name: /handle/i });
const avatarField = () => screen.getByRole('textbox', { name: /avatar/i });
const saveButton = () => screen.getByRole('button', { name: /save profile/i });

describe('ProfileSection', () => {
  it('shows the current profile in the fields', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(handleField()).toHaveValue('sam');
    expect(avatarField()).toHaveValue('🦊');
  });

  // display_name was a second name field that nothing ever populated. One
  // identity, one name — and this fails if it is ever added back.
  it('offers no Display name field', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: /display name/i })).not.toBeInTheDocument();
  });

  it('starts with an empty form when there is no profile row yet', () => {
    render(<ProfileSection profile={null} save={vi.fn()} />);
    expect(handleField()).toHaveValue('');
  });

  // A UNIQUE column makes a pointless round trip worse than merely wasteful.
  it('keeps Save disabled until something actually changes', async () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(saveButton()).toBeDisabled();
    await userEvent.type(handleField(), '!');
    expect(saveButton()).toBeEnabled();
  });

  it('disables Save again once the value is typed back to what it was', async () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    await userEvent.type(handleField(), '!');
    expect(saveButton()).toBeEnabled();
    await userEvent.keyboard('{Backspace}');
    expect(saveButton()).toBeDisabled();
  });

  it('sends both fields and reports success', async () => {
    const save = vi.fn().mockResolvedValue(profile);
    const onToast = vi.fn();
    render(<ProfileSection profile={profile} save={save} onToast={onToast} />);
    await userEvent.clear(handleField());
    await userEvent.type(handleField(), 'semion');
    await userEvent.click(saveButton());

    // display_name is gone from the payload entirely — not sent as null.
    expect(save).toHaveBeenCalledWith({
      handle: 'semion',
      avatar_emoji: '🦊',
    });
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/saved/i));
  });

  // The server owns handle uniqueness, so what it stored — not what was typed —
  // is what the form must end up showing.
  it('resets the fields to what the SERVER stored, not what was typed', async () => {
    const save = vi.fn().mockResolvedValue({ ...profile, handle: 'sam' });
    render(<ProfileSection profile={profile} save={save} />);
    await userEvent.clear(handleField());
    await userEvent.type(handleField(), 'wanted');
    await userEvent.click(saveButton());

    expect(handleField()).toHaveValue('sam');
    expect(saveButton()).toBeDisabled();
  });

  it('surfaces a taken handle inline and keeps the typed value for editing', async () => {
    const save = vi.fn().mockRejectedValue(new Error('That handle is taken.'));
    render(<ProfileSection profile={profile} save={save} />);
    await userEvent.clear(handleField());
    await userEvent.type(handleField(), 'taken');
    await userEvent.click(saveButton());

    expect(screen.getByText(/that handle is taken/i)).toBeInTheDocument();
    expect(handleField()).toHaveValue('taken');
    expect(saveButton()).toBeEnabled();
  });

  it('reports the saved row upward so the rest of the app can follow', async () => {
    const stored = { ...profile, handle: 'stored' };
    const onSaved = vi.fn();
    render(
      <ProfileSection
        profile={profile}
        save={vi.fn().mockResolvedValue(stored)}
        onSaved={onSaved}
      />
    );
    await userEvent.type(handleField(), '!');
    await userEvent.click(saveButton());
    expect(onSaved).toHaveBeenCalledWith(stored);
  });

  // Handle and avatar are profile fields here, not league fields, so they are
  // present whether or not leagues are switched on.
  it('offers handle and avatar without depending on the leagues flag', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(handleField()).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /avatar emoji/i })).toBeInTheDocument();
  });
});
