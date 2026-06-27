import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './handle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (body, method = 'PATCH') => ({ method, headers: { authorization: 'Bearer t' }, body });

afterEach(() => vi.clearAllMocks());

it('updates handle and returns it', async () => {
  requireAuth.mockResolvedValue(USER);
  const eq = vi.fn().mockResolvedValue({ error: null });
  serviceClient.mockReturnValue({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) });
  const res = createRes();
  await handler(req({ handle: 'NewName07' }), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.handle).toBe('NewName07');
});

it('rejects a duplicate handle as bad_request', async () => {
  requireAuth.mockResolvedValue(USER);
  const eq = vi.fn().mockResolvedValue({ error: { code: '23505' } });
  serviceClient.mockReturnValue({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) });
  const res = createRes();
  await handler(req({ handle: 'Taken01' }), res);
  expect(res.statusCode).toBe(400);
});
