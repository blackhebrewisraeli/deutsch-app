// api/v1/account/profile.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { buildPatch, EDITABLE_FIELDS } from './profile.js';
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
    const patch = buildPatch({ display_name: 'Sam', user_id: 'someone-else', created_at: 'nope' });
    expect(Object.keys(patch)).toEqual(['display_name']);
  });

  it('trims, and treats an emptied field as a deliberate clear', () => {
    expect(buildPatch({ display_name: '  Sam  ' }).display_name).toBe('Sam');
    expect(buildPatch({ display_name: '   ' }).display_name).toBeNull();
  });

  it('ignores non-strings rather than writing them', () => {
    expect(buildPatch({ display_name: 42, handle: null, avatar_emoji: {} })).toEqual({});
  });

  it('accepts a body that arrived unparsed', () => {
    expect(buildPatch(JSON.stringify({ handle: 'sam' }))).toEqual({ handle: 'sam' });
    expect(buildPatch('not json')).toEqual({});
  });

  it('covers exactly the three columns Settings edits', () => {
    expect(EDITABLE_FIELDS).toEqual(['display_name', 'handle', 'avatar_emoji']);
  });
});

describe('PATCH /api/v1/account/profile', () => {
  beforeEach(() => {
    updates = [];
    updateError = null;
    profileRow = { display_name: 'Sam', handle: 'sam', avatar_emoji: '🦊', created_at: 'x' };
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
    await handler(req({ display_name: 'Sam' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(profileRow);
    expect(updates).toContainEqual({ table: 'profiles', patch: { display_name: 'Sam' } });
  });

  it('answers with the STORED row, not the submitted one', async () => {
    // The server owns handle uniqueness, so an optimistic client value must not
    // be echoed back as though it had been accepted.
    profileRow = { display_name: 'Stored', handle: 'stored', avatar_emoji: null, created_at: 'x' };
    const res = createRes();
    await handler(req({ display_name: 'Submitted' }), res);
    expect(res.body.display_name).toBe('Stored');
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
    await handler(req({ display_name: 'Only the name' }), res);
    expect(updates.map((u) => u.table)).not.toContain('league_members');
  });

  it('refuses an over-long value rather than letting the database do it', async () => {
    const res = createRes();
    await handler(req({ display_name: 'x'.repeat(41) }), res);
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
  });

  // Editing a display name is not destructive. Gating it would make an ordinary
  // edit demand a fresh sign-in, which is the friction we deliberately avoided.
  it('is NOT re-auth gated', async () => {
    const res = createRes();
    await handler(req({ display_name: 'Sam' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBeUndefined();
  });
});
