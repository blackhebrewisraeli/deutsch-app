import { it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './handle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (body, method = 'PATCH') => ({ method, headers: { authorization: 'Bearer t' }, body });

afterEach(() => vi.clearAllMocks());

// Records the patch applied to each table: from(table).update(patch).eq(...)
function trackingDb(updateError = null) {
  const updates = {};
  return {
    updates,
    from: vi.fn((table) => ({
      update: vi.fn((patch) => {
        updates[table] = patch;
        return { eq: vi.fn().mockResolvedValue({ error: updateError }) };
      }),
    })),
  };
}

it('updates handle on profiles AND denormalized league_members, then returns it', async () => {
  requireAuth.mockResolvedValue(USER);
  const db = trackingDb();
  serviceClient.mockReturnValue(db);
  const res = createRes();
  await handler(req({ handle: 'NewName07' }), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.handle).toBe('NewName07');
  expect(db.updates.profiles).toEqual({ handle: 'NewName07' });
  expect(db.updates.league_members).toEqual({ handle: 'NewName07' });
});

it('does not touch league_members when only the avatar changes', async () => {
  requireAuth.mockResolvedValue(USER);
  const db = trackingDb();
  serviceClient.mockReturnValue(db);
  const res = createRes();
  await handler(req({ avatar_emoji: '🦊' }), res);
  expect(res.statusCode).toBe(200);
  expect(db.updates.profiles).toEqual({ avatar_emoji: '🦊' });
  expect(db.updates.league_members).toBeUndefined();
});

it('rejects a duplicate handle as bad_request', async () => {
  requireAuth.mockResolvedValue(USER);
  const eq = vi.fn().mockResolvedValue({ error: { code: '23505' } });
  serviceClient.mockReturnValue({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) });
  const res = createRes();
  await handler(req({ handle: 'Taken01' }), res);
  expect(res.statusCode).toBe(400);
});
