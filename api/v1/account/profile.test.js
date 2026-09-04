// api/v1/account/profile.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import {
  profileHandler as handler,
  buildPatch,
  EDITABLE_FIELDS,
  ownsAvatarPath,
} from '../../_lib/accountEndpoints.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

let seq = 0;
const req = (body, method = 'PATCH') => {
  seq += 1;
  return {
    method,
    headers: { 'x-forwarded-for': `192.168.5.${seq}`, authorization: 'Bearer tok' },
    body,
  };
};

// Records every table touched so the league denormalisation can be asserted.
let updates;
let profileRow;
let updateError;
const mockDb = () => ({
  from: vi.fn((table) => ({
    update: vi.fn((patch) => {
      updates.push({ table, patch });
      return { eq: vi.fn().mockResolvedValue({ error: updateError }) };
    }),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: profileRow }) })),
    })),
  })),
});

describe('buildPatch', () => {
  it('takes only the editable fields', () => {
    const patch = buildPatch({ handle: 'sam', user_id: 'someone-else', created_at: 'nope' });
    expect(Object.keys(patch)).toEqual(['handle']);
  });

  it('trims, and treats an emptied field as a deliberate clear', () => {
    expect(buildPatch({ handle: '  sam  ' }).handle).toBe('sam');
    expect(buildPatch({ handle: '   ' }).handle).toBeNull();
  });

  it('ignores non-strings rather than writing them', () => {
    expect(buildPatch({ handle: 42, avatar_emoji: {} })).toEqual({});
  });

  it('accepts a body that arrived unparsed', () => {
    expect(buildPatch(JSON.stringify({ handle: 'sam' }))).toEqual({ handle: 'sam' });
    expect(buildPatch('not json')).toEqual({});
  });

  it('covers exactly the columns Settings edits, and display_name is not one', () => {
    expect(EDITABLE_FIELDS).toEqual(['handle', 'avatar_emoji', 'avatar_path']);
    // The column still exists; it is simply no longer writable from the client.
    expect(EDITABLE_FIELDS).not.toContain('display_name');
    // An old client that still sends it is IGNORED by the allowlist, never an error.
    expect(buildPatch({ display_name: 'Sam', handle: 'sam' })).toEqual({ handle: 'sam' });
  });
});

describe('PATCH /api/v1/account/profile', () => {
  beforeEach(() => {
    updates = [];
    updateError = null;
    profileRow = { handle: 'sam', avatar_emoji: '🦊', created_at: 'x' };
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(mockDb());
  });
  afterEach(() => vi.clearAllMocks());

  it('rejects a non-PATCH method', async () => {
    const res = createRes();
    await handler(req({ handle: 'sam' }, 'POST'), res);
    expect(res.statusCode).toBe(405);
  });

  it('updates the profile and answers with the stored row', async () => {
    const res = createRes();
    await handler(req({ handle: 'sam' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(profileRow);
    expect(updates).toContainEqual({ table: 'profiles', patch: { handle: 'sam' } });
    // handle is denormalised onto league_members; a rename must reach the standings.
    expect(updates).toContainEqual({ table: 'league_members', patch: { handle: 'sam' } });
  });

  it('answers with the STORED row, not the submitted one', async () => {
    // The server owns handle uniqueness, so an optimistic client value must not
    // be echoed back as though it had been accepted.
    profileRow = { handle: 'stored', avatar_emoji: null, created_at: 'x' };
    const res = createRes();
    await handler(req({ handle: 'submitted' }), res);
    expect(res.body.handle).toBe('stored');
  });

  it('rejects an empty patch instead of writing nothing', async () => {
    const res = createRes();
    await handler(req({ nickname: 'nope' }), res);
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it('maps a unique-violation to human copy about the handle', async () => {
    updateError = { code: '23505', message: 'duplicate key' };
    const res = createRes();
    await handler(req({ handle: 'taken' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/taken/i);
  });

  // The handle is denormalised onto league_members, which is what the
  // leaderboard renders. league/handle.js already learned this; forgetting it
  // in a second writer is the predictable regression.
  it('re-syncs a renamed handle onto league_members', async () => {
    const res = createRes();
    await handler(req({ handle: 'newname' }), res);
    expect(res.statusCode).toBe(200);
    expect(updates).toContainEqual({ table: 'league_members', patch: { handle: 'newname' } });
  });

  it('leaves league_members alone when the handle is not part of the edit', async () => {
    const res = createRes();
    await handler(req({ avatar_emoji: '🦊' }), res);
    expect(updates.map((u) => u.table)).not.toContain('league_members');
  });

  it('refuses an over-long value rather than letting the database do it', async () => {
    const res = createRes();
    await handler(req({ handle: 'x'.repeat(25) }), res);
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
  });

  // Editing a display name is not destructive. Gating it would make an ordinary
  // edit demand a fresh sign-in, which is the friction we deliberately avoided.
  it('is NOT re-auth gated', async () => {
    const res = createRes();
    await handler(req({ handle: 'sam' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBeUndefined();
  });
});

// avatar_path names something OUTSIDE this row. Storage RLS stops a learner
// WRITING an object into another user's folder, but this column is ordinary
// text — nothing in the database stops them SAYING their avatar lives at
// someone else's path and wearing that person's picture.
describe('ownsAvatarPath', () => {
  it('accepts a path inside your own folder', () => {
    expect(ownsAvatarPath('u1/abc.webp', 'u1')).toBe(true);
  });

  it("rejects another user's folder", () => {
    expect(ownsAvatarPath('u2/abc.webp', 'u1')).toBe(false);
  });

  it('rejects a prefix that only LOOKS like yours', () => {
    // 'u1' must not authorise 'u10/…' — the separator is part of the check.
    expect(ownsAvatarPath('u10/abc.webp', 'u1')).toBe(false);
  });

  it('rejects traversal', () => {
    expect(ownsAvatarPath('u1/../u2/abc.webp', 'u1')).toBe(false);
  });

  it('allows clearing the avatar', () => {
    expect(ownsAvatarPath(null, 'u1')).toBe(true);
    expect(ownsAvatarPath(undefined, 'u1')).toBe(true);
  });

  it('rejects a non-string', () => {
    expect(ownsAvatarPath(42, 'u1')).toBe(false);
  });
});

describe('PATCH rejects an avatar path that is not yours', () => {
  it("refuses to point a profile at another user's object", async () => {
    const res = createRes();
    await handler(req({ avatar_path: 'someone-else/pic.webp' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body?.error?.message).toMatch(/not yours/i);
  });

  it('accepts your own', async () => {
    const res = createRes();
    await handler(req({ avatar_path: `${USER.userId}/pic.webp` }), res);
    expect(res.statusCode).toBe(200);
  });
});
