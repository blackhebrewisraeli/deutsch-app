import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';

// The increment RPC: service-role only, atomic counting, window cleanup.

const admin = adminClient();
const rpc = (key, windowStart) =>
  admin.rpc('increment_rate_limit', { p_key: key, p_window_start: windowStart });

let user;

beforeAll(async () => {
  user = await createSignedInUser('rpc');
});

describe('increment_rate_limit', () => {
  it('counts 1, 2, 3 within one window', async () => {
    const key = `test:${Date.now()}`;
    expect((await rpc(key, 1000)).data).toBe(1);
    expect((await rpc(key, 1000)).data).toBe(2);
    expect((await rpc(key, 1000)).data).toBe(3);
  });

  it('resets in a new window and cleans up the old one', async () => {
    const key = `test:cleanup:${Date.now()}`;
    await rpc(key, 1000);
    await rpc(key, 1000);
    expect((await rpc(key, 2000)).data).toBe(1);
    const { data } = await admin.from('rate_limits').select('window_start').eq('key', key);
    expect(data).toHaveLength(1);
    expect(Number(data[0].window_start)).toBe(2000);
  });

  it('tracks keys independently', async () => {
    const a = `test:a:${Date.now()}`;
    const b = `test:b:${Date.now()}`;
    expect((await rpc(a, 1000)).data).toBe(1);
    expect((await rpc(b, 1000)).data).toBe(1);
    expect((await rpc(a, 1000)).data).toBe(2);
  });

  it('is denied to authenticated users', async () => {
    const { error } = await user.client.rpc('increment_rate_limit', {
      p_key: 'attack',
      p_window_start: 0,
    });
    expect(error).not.toBeNull();
  });

  it('is denied to bare anon', async () => {
    const { anonClient } = await import('./helpers.js');
    const { error } = await anonClient().rpc('increment_rate_limit', {
      p_key: 'attack',
      p_window_start: 0,
    });
    expect(error).not.toBeNull();
  });
});
