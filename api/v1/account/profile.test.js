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
    expect(buildPatch({ handle: 42, avatar_path: {} })).toEqual({});
  });

  it('honours an explicit null — that is how "Remove picture" is spelled', () => {
    // An object path has no empty-string form, so null is the ONLY way the
    // client can say "clear my avatar". Dropping it because it is not a string
    // made the patch `{}`, and the endpoint answered "Nothing to update." —
    // i.e. Remove picture was broken for every learner, admin included.
    expect(buildPatch({ avatar_path: null })).toEqual({ avatar_path: null });
    expect(buildPatch({ handle: null })).toEqual({ handle: null });
  });

  it('still distinguishes an absent key from a null one', () => {
    // Absent = "I am not talking about this field"; null = "clear it". Folding
    // them together is how a handle-only save would wipe the avatar.
    expect(buildPatch({ handle: 'sam' })).toEqual({ handle: 'sam' });
    expect('avatar_path' in buildPatch({ handle: 'sam' })).toBe(false);
    expect('avatar_path' in buildPatch({ handle: 'sam', avatar_path: null })).toBe(true);
  });

  it('treats undefined as absent, not as a clear', () => {
    // JSON.stringify drops undefined on the way out, so a body can never
    // actually carry it — but a direct caller can, and "the key was there but
    // empty" must not be read as a deliberate removal.
    expect(buildPatch({ avatar_path: undefined })).toEqual({});
  });

  it('accepts a body that arrived unparsed', () => {
    expect(buildPatch(JSON.stringify({ handle: 'sam' }))).toEqual({ handle: 'sam' });
    expect(buildPatch('not json')).toEqual({});
  });

  // display_name is writable again, DELIBERATELY. This assertion used to read
  // "and display_name is not one", recording a decision to leave the column
  // unused. The Social Profile v1 spec (§7,
  // docs/superpowers/specs/2026-09-21-social-profile-v1-design.md) supersedes
  // it in as many words: the profile header and the account sheet both render
  // a display name, so the client has to be able to set one. The column
  // already existed; nothing was migrated.
  //
  // The other four names stay out, and for a different reason — they are not
  // "not needed yet", they are privilege. avatar_emoji is a dead column, and
  // blocked_at / role / isAdmin are the admin lane. A learner PATCHing their
  // own profile must never reach them, so the negative half of this test is
  // the half that still guards something.
  it('covers exactly the columns Settings edits, now including display_name', () => {
    expect(EDITABLE_FIELDS).toEqual(['handle', 'avatar_path', 'display_name']);
    expect(EDITABLE_FIELDS).toContain('display_name');
    expect(EDITABLE_FIELDS).not.toContain('avatar_emoji');
    expect(EDITABLE_FIELDS).not.toContain('blocked_at');
    expect(EDITABLE_FIELDS).not.toContain('role');
    expect(EDITABLE_FIELDS).not.toContain('isAdmin');
    expect(buildPatch({ display_name: 'Sam', handle: 'sam' })).toEqual({
      handle: 'sam',
      display_name: 'Sam',
    });
    // An old client that still sends one of the forbidden names is IGNORED by
    // the allowlist, never an error.
    expect(buildPatch({ avatar_emoji: '🦊', handle: 'sam' })).toEqual({ handle: 'sam' });
    expect(buildPatch({ blocked_at: null, role: 'admin', isAdmin: true, handle: 'sam' })).toEqual({
      handle: 'sam',
    });
  });

  it('gives display_name the same trim / clear / absent semantics as handle', () => {
    expect(buildPatch({ display_name: '  Sam Vimes  ' }).display_name).toBe('Sam Vimes');
    // Emptied or explicitly nulled = "I no longer want a display name", which
    // falls the UI back to @handle rather than storing "".
    expect(buildPatch({ display_name: '   ' }).display_name).toBeNull();
    expect(buildPatch({ display_name: null })).toEqual({ display_name: null });
    expect('display_name' in buildPatch({ handle: 'sam' })).toBe(false);
  });
});

describe('PATCH /api/v1/account/profile', () => {
  beforeEach(() => {
    updates = [];
    updateError = null;
    profileRow = { handle: 'sam', avatar_path: null, created_at: 'x' };
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
    profileRow = { handle: 'stored', avatar_path: null, created_at: 'x' };
    const res = createRes();
    await handler(req({ handle: 'submitted' }), res);
    expect(res.body.handle).toBe('stored');
  });

  it('persists a display_name and reads it back in the stored row', async () => {
    profileRow = { handle: 'sam', avatar_path: null, created_at: 'x', display_name: 'Sam Vimes' };
    const res = createRes();
    await handler(req({ display_name: 'Sam Vimes' }), res);
    expect(res.statusCode).toBe(200);
    expect(updates).toContainEqual({ table: 'profiles', patch: { display_name: 'Sam Vimes' } });
    expect(res.body.display_name).toBe('Sam Vimes');
    // display_name is NOT denormalised onto league_members — the standings
    // render @handle, which is the stable social identifier. Only a handle
    // rename touches that table.
    expect(updates.some((u) => u.table === 'league_members')).toBe(false);
  });

  it('rejects a display_name longer than the column allows', async () => {
    const res = createRes();
    await handler(req({ display_name: 'x'.repeat(41) }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body?.error?.message).toMatch(/display name is too long/i);
    expect(updates).toHaveLength(0);
  });

  it('accepts a display_name exactly at the limit', async () => {
    const res = createRes();
    await handler(req({ display_name: 'x'.repeat(40) }), res);
    expect(res.statusCode).toBe(200);
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
    await handler(req({ avatar_path: `${USER.userId}/pic.webp` }), res);
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
