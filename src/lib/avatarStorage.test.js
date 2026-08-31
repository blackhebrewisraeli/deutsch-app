import { describe, it, expect, vi } from 'vitest';
import { avatarPathFor, uploadAvatar, removeAvatar, AVATAR_BUCKET } from './avatarStorage.js';

// With no injected client the module resolves one itself. Mocked to null so the
// "no backend configured" branch is reachable — passing `{ client: null }`
// would NOT reach it, because `null ?? await getSupabase()` falls through to
// the real resolver.
vi.mock('./auth.js', () => ({ getSupabase: vi.fn().mockResolvedValue(null) }));

const stubClient = (over = {}) => {
  const calls = { upload: [], remove: [] };
  const client = {
    storage: {
      from: (bucket) => ({
        upload: (path, blob, opts) => {
          calls.upload.push({ bucket, path, blob, opts });
          return Promise.resolve(over.uploadResult ?? { error: null });
        },
        remove: (paths) => {
          calls.remove.push({ bucket, paths });
          return Promise.resolve(over.removeResult ?? { error: null });
        },
      }),
    },
  };
  return { client, calls };
};

describe('avatarPathFor', () => {
  // The RLS policies compare (storage.foldername(name))[1] to auth.uid(), so a
  // path that does not START with the id is rejected by Postgres. This is not
  // tidiness — it is the whole ownership model.
  it('puts the user id FIRST, which is what the policies compare', () => {
    expect(avatarPathFor('user-1')).toMatch(/^user-1\//);
    expect(avatarPathFor('user-1').split('/')[0]).toBe('user-1');
  });

  it('ends in .webp, matching what prepareAvatar produces', () => {
    expect(avatarPathFor('u')).toMatch(/\.webp$/);
  });

  it('is exactly two segments — a deeper path breaks foldername[1]', () => {
    expect(avatarPathFor('u').split('/')).toHaveLength(2);
  });

  // A public bucket plus a derivable path would mean a user id yields the
  // picture. The random segment is what stops that.
  it('is never the same twice for one user', () => {
    const seen = new Set(Array.from({ length: 500 }, () => avatarPathFor('u')));
    expect(seen.size).toBe(500);
  });
});

describe('uploadAvatar', () => {
  it('uploads to the avatars bucket at an owned path', async () => {
    const { client, calls } = stubClient();
    const blob = new Blob(['x'], { type: 'image/webp' });
    const path = await uploadAvatar('u1', blob, { client });

    expect(calls.upload).toHaveLength(1);
    expect(calls.upload[0].bucket).toBe(AVATAR_BUCKET);
    expect(calls.upload[0].path).toBe(path);
    expect(path.startsWith('u1/')).toBe(true);
    expect(calls.upload[0].opts.contentType).toBe('image/webp');
  });

  // upsert:false is deliberate. The path is random, so a collision means
  // something is badly wrong; upsert would silently paper over it.
  it('never upserts', async () => {
    const { client, calls } = stubClient();
    await uploadAvatar('u1', new Blob(['x'], { type: 'image/webp' }), { client });
    expect(calls.upload[0].opts.upsert).toBe(false);
  });

  it('surfaces the storage error message', async () => {
    const { client } = stubClient({ uploadResult: { error: { message: 'Payload too large' } } });
    await expect(
      uploadAvatar('u1', new Blob(['x'], { type: 'image/webp' }), { client })
    ).rejects.toThrow(/payload too large/i);
  });

  it('refuses when there is no backend rather than silently doing nothing', async () => {
    await expect(uploadAvatar('u1', new Blob(['x']))).rejects.toThrow(/sign in/i);
  });
});

describe('removeAvatar', () => {
  it('removes the named object from the avatars bucket', async () => {
    const { client, calls } = stubClient();
    await expect(removeAvatar('u1/a.webp', { client })).resolves.toBe(true);
    expect(calls.remove[0]).toEqual({ bucket: AVATAR_BUCKET, paths: ['u1/a.webp'] });
  });

  it('does nothing when there is no previous object', async () => {
    const { client, calls } = stubClient();
    await expect(removeAvatar(null, { client })).resolves.toBe(false);
    expect(calls.remove).toHaveLength(0);
  });

  it('reports false when there is no backend, and does not throw', async () => {
    await expect(removeAvatar('u1/a.webp')).resolves.toBe(false);
  });

  // Best-effort BY DESIGN. If tidying up the old object could fail the whole
  // change, a learner whose new avatar uploaded fine would be told it did not.
  // An orphan costs 40 KB; a false failure costs their trust in the button.
  it('reports failure without throwing', async () => {
    const { client } = stubClient({ removeResult: { error: { message: 'nope' } } });
    await expect(removeAvatar('u1/a.webp', { client })).resolves.toBe(false);
  });

  it('swallows a thrown client error too', async () => {
    const client = {
      storage: {
        from: () => ({
          remove: () => {
            throw new Error('network');
          },
        }),
      },
    };
    await expect(removeAvatar('u1/a.webp', { client })).resolves.toBe(false);
  });
});

describe('the upload path satisfies the RLS policy predicate', () => {
  // Mirrors (storage.foldername(name))[1] = auth.uid()::text, so the shape the
  // client builds is checked against the rule the database enforces without
  // needing Docker. The real policy is exercised in supabase/tests/rls.
  const firstSegment = (name) => name.split('/')[0];

  it('accepts a path this user built', () => {
    expect(firstSegment(avatarPathFor('abc-123'))).toBe('abc-123');
  });

  it('would reject a path built for someone else', () => {
    expect(firstSegment(avatarPathFor('other-user'))).not.toBe('abc-123');
  });

  it('leaves no way to escape the folder with traversal', () => {
    const p = avatarPathFor('u1');
    expect(p).not.toContain('..');
    expect(p).not.toContain('//');
  });
});
