import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarPicker from './AvatarPicker';
import { ImagePrepError } from '../../lib/imagePrep.js';

const USER = 'u1';
const pngFile = () => new File(['bytes'], 'me.png', { type: 'image/png' });

/** Records the ORDER of every step, which is the thing worth asserting. */
const setup = (over = {}) => {
  const order = [];
  const prepare = over.prepare ?? vi.fn(async () => (order.push('prepare'), new Blob(['w'])));
  const upload = over.upload ?? vi.fn(async () => (order.push('upload'), 'u1/new.webp'));
  const save =
    over.save ??
    vi.fn(async (patch) => (order.push('save'), { avatar_path: patch.avatar_path, handle: 'sam' }));
  const remove = over.remove ?? vi.fn(async () => (order.push('remove'), true));
  const onSaved = vi.fn();
  const onToast = vi.fn();

  render(
    <AvatarPicker
      userId={USER}
      profile={over.profile ?? {}}
      prepare={prepare}
      upload={upload}
      save={save}
      remove={remove}
      onSaved={onSaved}
      onToast={onToast}
    />
  );
  return { order, prepare, upload, save, remove, onSaved, onToast };
};

const fileInput = () => screen.getByLabelText(/choose an avatar image/i);

describe('AvatarPicker — what it renders', () => {
  it('shows a generated identicon when there is no avatar at all', () => {
    setup();
    const img = document.querySelector('[data-avatar="identicon"]');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
    // Generated locally: no request leaves the page for it.
    expect(img.getAttribute('src')).not.toMatch(/^https?:/);
  });

  it('shows the emoji when there is one and no upload', () => {
    setup({ profile: { avatar_emoji: '🦊' } });
    expect(document.querySelector('[data-avatar="emoji"]')).toHaveTextContent('🦊');
  });

  it('offers Remove only once there is something to remove', () => {
    setup();
    expect(screen.queryByRole('button', { name: /remove picture/i })).not.toBeInTheDocument();
  });

  it('offers Remove when an upload exists', () => {
    setup({ profile: { avatar_path: 'u1/old.webp' } });
    expect(screen.getByRole('button', { name: /remove picture/i })).toBeInTheDocument();
  });

  it('accepts only the types the bucket allows — never SVG', () => {
    setup();
    const accept = fileInput().getAttribute('accept');
    expect(accept).toContain('image/webp');
    expect(accept).toContain('image/png');
    expect(accept).toContain('image/jpeg');
    expect(accept).not.toContain('svg');
  });
});

describe('AvatarPicker — the upload sequence', () => {
  it('processes, uploads, then saves — in that order', async () => {
    const { order, prepare, upload, save } = setup();
    await userEvent.upload(fileInput(), pngFile());

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(order).toEqual(['prepare', 'upload', 'save']);
    expect(prepare).toHaveBeenCalledWith(expect.any(File));
    expect(upload).toHaveBeenCalledWith(USER, expect.any(Blob));
    expect(save).toHaveBeenCalledWith({ avatar_path: 'u1/new.webp' });
  });

  // THE ORDERING RULE. Deleting before the row is repointed would leave the
  // profile naming an object that no longer exists — a broken avatar for
  // everyone who can see it — if the save then failed.
  it('saves BEFORE deleting the object it replaced', async () => {
    const { order, remove } = setup({ profile: { avatar_path: 'u1/old.webp' } });
    await userEvent.upload(fileInput(), pngFile());

    await waitFor(() => expect(remove).toHaveBeenCalledWith('u1/old.webp'));
    expect(order).toEqual(['prepare', 'upload', 'save', 'remove']);
    expect(order.indexOf('save')).toBeLessThan(order.indexOf('remove'));
  });

  it('has nothing to delete on a first upload', async () => {
    const { remove, save } = setup();
    await userEvent.upload(fileInput(), pngFile());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
  });

  it('reports the stored row upward and toasts', async () => {
    const { onSaved, onToast } = setup();
    await userEvent.upload(fileInput(), pngFile());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: 'u1/new.webp' }));
    expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/avatar updated/i));
  });

  // A rejected image must never reach the bucket. This is the EXIF guarantee at
  // the flow level: nothing uploads that has not been through prepare().
  it('never uploads when processing fails', async () => {
    const prepare = vi
      .fn()
      .mockRejectedValue(new ImagePrepError('Pick a JPEG, PNG or WebP image.'));
    const { upload, save } = setup({ prepare });
    await userEvent.upload(fileInput(), pngFile());

    await waitFor(() => expect(screen.getByText(/pick a jpeg/i)).toBeInTheDocument());
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not repoint the row, or delete the old object, when the upload fails', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('Payload too large'));
    const { save, remove } = setup({ profile: { avatar_path: 'u1/old.webp' }, upload });
    await userEvent.upload(fileInput(), pngFile());

    await waitFor(() => expect(screen.getByText(/payload too large/i)).toBeInTheDocument());
    expect(upload).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    // The critical half: a failed upload must not destroy the avatar the
    // learner still has.
    expect(remove).not.toHaveBeenCalled();
  });

  // A learner who picked a bad file and fixes it usually re-picks the SAME
  // filename; without clearing the input, no change event fires and the button
  // appears dead.
  it('clears the input so the same file can be picked again', async () => {
    setup();
    const input = fileInput();
    await userEvent.upload(input, pngFile());
    await waitFor(() => expect(input.value).toBe(''));
  });
});

describe('AvatarPicker — removing', () => {
  it('clears the row first, then deletes the object', async () => {
    const { order, save, remove } = setup({ profile: { avatar_path: 'u1/old.webp' } });
    await userEvent.click(screen.getByRole('button', { name: /remove picture/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('u1/old.webp'));
    expect(save).toHaveBeenCalledWith({ avatar_path: null });
    expect(order).toEqual(['save', 'remove']);
  });

  it('keeps the object when clearing the row fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Could not save your profile.'));
    const { remove } = setup({ profile: { avatar_path: 'u1/old.webp' }, save });
    await userEvent.click(screen.getByRole('button', { name: /remove picture/i }));

    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });
});
