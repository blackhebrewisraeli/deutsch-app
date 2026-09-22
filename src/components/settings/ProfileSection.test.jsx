import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSection from './ProfileSection';

const profile = { handle: 'sam' };
const profileWithPicture = { ...profile, avatar_path: 'u1/old.webp' };

const handleField = () => screen.getByRole('textbox', { name: /handle/i });
const displayNameField = () => screen.getByRole('textbox', { name: /display name/i });
const saveButton = () => screen.getByRole('button', { name: /save profile/i });

describe('ProfileSection', () => {
  it('shows the current handle', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(handleField()).toHaveValue('sam');
  });

  it('edits the display name separately from the unique handle', () => {
    render(<ProfileSection profile={{ ...profile, display_name: 'Sam Vimes' }} save={vi.fn()} />);
    expect(displayNameField()).toHaveValue('Sam Vimes');
    expect(handleField()).toHaveValue('sam');
    expect(screen.getByText('@', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
  });

  it('offers no Avatar emoji field', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(screen.queryByText(/avatar emoji/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /avatar/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('🦊')).not.toBeInTheDocument();
  });

  it('starts with an empty form when there is no profile row yet', () => {
    render(<ProfileSection profile={null} save={vi.fn()} />);
    expect(handleField()).toHaveValue('');
  });

  // A UNIQUE column makes a pointless round trip worse than merely wasteful.
  it('keeps Save disabled until the handle actually changes', async () => {
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

  it('sends both identity fields and reports success', async () => {
    const save = vi.fn().mockResolvedValue({ ...profile, display_name: 'Sam Vimes' });
    const onToast = vi.fn();
    render(<ProfileSection profile={profile} save={save} onToast={onToast} />);
    await userEvent.type(displayNameField(), 'Sam Vimes');
    await userEvent.clear(handleField());
    await userEvent.type(handleField(), 'semion');
    await userEvent.click(saveButton());

    expect(save).toHaveBeenCalledWith({ display_name: 'Sam Vimes', handle: 'semion' });
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/saved/i));
  });

  // The server owns handle uniqueness, so what it stored — not what was typed —
  // is what the form must end up showing.
  it('resets the handle to what the SERVER stored, not what was typed', async () => {
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

  // Handle and picture controls are profile fields here, not league fields,
  // so they are present whether or not leagues are switched on.
  it('offers handle and picture controls without depending on the leagues flag', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(handleField()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload a picture/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/choose an avatar image/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /avatar emoji/i })).not.toBeInTheDocument();
  });

  it('offers Remove picture when an uploaded avatar exists', () => {
    render(<ProfileSection profile={profileWithPicture} save={vi.fn()} />);
    expect(screen.getByRole('button', { name: /remove picture/i })).toBeInTheDocument();
  });

  it('hides Remove picture when there is no uploaded avatar', () => {
    render(<ProfileSection profile={profile} save={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /remove picture/i })).not.toBeInTheDocument();
  });
});
